"use server";

import { Prisma } from "@prisma/client";
import type { BookingSlot, BookingStatus, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BOOKING_SLOTS,
  SLOT_LABELS,
  bookingsConflict,
  type Occupancy,
} from "@/lib/booking";
import {
  dateKeyToUTC,
  formatShortDate,
  isValidDateKey,
  nightsBetween,
  toDateKey,
  todayKey,
} from "@/lib/dates";
import { notifyAdmins } from "@/lib/push";

export type BookingActionState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined;

// Thrown inside the transaction to surface a booking conflict as a clean
// message rather than an unexpected error.
class ConflictError extends Error {}

function optionalString(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > 0 ? s : null;
}

/** Validate an optional "HH:MM" (24h) time field. */
function optionalTime(value: FormDataEntryValue | null): string | null {
  const s = optionalString(value);
  if (s === null) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    throw new ConflictError("Please enter a valid time.");
  }
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Throw ConflictError if `candidate` overlaps any other active booking.
 * Only bookings whose date range could touch the candidate's range are
 * fetched; the precise decision uses interval overlap (owner times aware).
 */
async function assertNoConflict(
  tx: TxClient,
  candidate: Occupancy,
  excludeId?: string
): Promise<void> {
  const rows = await tx.booking.findMany({
    where: {
      status: { not: "CANCELLED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      // Range overlap: existing.date <= candidate.endDate AND
      //                existing.endDate >= candidate.date
      date: { lte: dateKeyToUTC(candidate.endDate) },
      endDate: { gte: dateKeyToUTC(candidate.date) },
    },
    select: { date: true, endDate: true, slot: true, startTime: true, endTime: true },
  });

  const clash = rows.find((b) =>
    bookingsConflict(candidate, {
      date: toDateKey(b.date),
      endDate: toDateKey(b.endDate),
      slot: b.slot,
      startTime: b.startTime,
      endTime: b.endTime,
    })
  );

  if (clash) {
    const when =
      toDateKey(clash.date) === toDateKey(clash.endDate)
        ? formatShortDate(toDateKey(clash.date))
        : `${formatShortDate(toDateKey(clash.date))}–${formatShortDate(toDateKey(clash.endDate))}`;
    throw new ConflictError(
      `The resort is already booked (${SLOT_LABELS[clash.slot]}, ${when}).`
    );
  }
}

/** Shared parsing/validation for the date range + slot fields. */
function parseRange(formData: FormData):
  | { ok: true; slot: BookingSlot; date: string; endDate: string }
  | { ok: false; error: string } {
  let slot = String(formData.get("slot") ?? "") as BookingSlot;
  const date = String(formData.get("date") ?? "");
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const endDate = endDateRaw || date;

  if (!isValidDateKey(date) || !isValidDateKey(endDate)) {
    return { ok: false, error: "Please choose valid dates." };
  }
  if (endDate < date) {
    return { ok: false, error: "Check-out can't be before check-in." };
  }
  if (date < todayKey()) {
    return { ok: false, error: "You can't book a date in the past." };
  }
  // A multi-day stay is always an overnight; a single day keeps its slot.
  if (nightsBetween(date, endDate) >= 1) slot = "OVERNIGHT";
  if (!BOOKING_SLOTS.includes(slot)) {
    return { ok: false, error: "Please choose a booking type." };
  }
  return { ok: true, slot, date, endDate };
}

async function notifyNewBooking(opts: {
  slot: BookingSlot;
  date: string;
  endDate: string;
  guestName: string;
  pax: number | null;
  status: BookingStatus;
  isRequest: boolean;
}) {
  const when =
    opts.date === opts.endDate
      ? formatShortDate(opts.date)
      : `${formatShortDate(opts.date)}–${formatShortDate(opts.endDate)}`;
  const details = [
    opts.guestName,
    SLOT_LABELS[opts.slot],
    when,
    opts.pax ? `${opts.pax} pax` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  await notifyAdmins({
    title: opts.isRequest ? "📩 New request" : "🏝️ New booking",
    body: details,
    url: "/dashboard",
    tag: opts.isRequest ? "new-request" : "new-booking",
  });
}

// --- Staff booking (dashboard) -------------------------------------------

export async function createBooking(
  _prev: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You must be signed in." };

  const parsed = parseRange(formData);
  if (!parsed.ok) return parsed;
  const { slot, date, endDate } = parsed;

  const statusRaw = String(formData.get("status") ?? "CONFIRMED");
  const status: BookingStatus = statusRaw === "PENDING" ? "PENDING" : "CONFIRMED";
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestPhone = optionalString(formData.get("guestPhone"));
  const guestEmail = optionalString(formData.get("guestEmail"));
  const notes = optionalString(formData.get("notes"));
  const paxRaw = optionalString(formData.get("pax"));
  const functionHallAircon = formData.get("functionHallAircon") === "on";

  let startTime: string | null;
  let endTime: string | null;
  try {
    startTime = optionalTime(formData.get("startTime"));
    endTime = optionalTime(formData.get("endTime"));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (!guestName) return { ok: false, error: "Guest name is required." };

  let pax: number | null = null;
  if (paxRaw !== null) {
    const n = Number(paxRaw);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, error: "Number of guests must be a positive number." };
    }
    pax = n;
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await assertNoConflict(tx, {
          date,
          endDate,
          slot,
          startTime,
          endTime,
        });
        await tx.booking.create({
          data: {
            slot,
            status,
            source: "STAFF",
            date: dateKeyToUTC(date),
            endDate: dateKeyToUTC(endDate),
            startTime,
            endTime,
            functionHallAircon,
            guestName,
            guestPhone,
            guestEmail,
            pax,
            notes,
            createdById: session.user.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, error: error.message };
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return {
        ok: false,
        error: "That slot was just booked by someone else. Please refresh.",
      };
    }
    throw error;
  }

  await notifyNewBooking({
    slot,
    date,
    endDate,
    guestName,
    pax,
    status,
    isRequest: false,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

// --- Public guest request (no auth) --------------------------------------

export async function createRequest(
  _prev: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const parsed = parseRange(formData);
  if (!parsed.ok) return parsed;
  const { slot, date, endDate } = parsed;

  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestPhone = optionalString(formData.get("guestPhone"));
  const guestEmail = optionalString(formData.get("guestEmail"));
  const notes = optionalString(formData.get("notes"));
  const paxRaw = optionalString(formData.get("pax"));
  const functionHallAircon = formData.get("functionHallAircon") === "on";

  if (!guestName) return { ok: false, error: "Please enter your name." };
  if (!guestPhone) {
    return { ok: false, error: "Please enter your contact number." };
  }
  if (paxRaw === null) {
    return { ok: false, error: "Please enter the number of guests." };
  }
  const pax = Number(paxRaw);
  if (!Number.isInteger(pax) || pax < 1) {
    return { ok: false, error: "Number of guests must be a positive number." };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Guest requests carry no exact times yet — the slot's default window
        // decides whether the date is still open to request.
        await assertNoConflict(tx, { date, endDate, slot });
        await tx.booking.create({
          data: {
            slot,
            status: "PENDING",
            source: "GUEST",
            date: dateKeyToUTC(date),
            endDate: dateKeyToUTC(endDate),
            functionHallAircon,
            guestName,
            guestPhone,
            guestEmail,
            pax,
            notes,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, error: error.message };
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return {
        ok: false,
        error: "Those dates were just taken. Please pick another.",
      };
    }
    throw error;
  }

  await notifyNewBooking({
    slot,
    date,
    endDate,
    guestName,
    pax,
    status: "PENDING",
    isRequest: true,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/book");
  return { ok: true };
}

// --- Owner: confirm a pending request (and set exact times) --------------

export async function confirmBooking(
  _prev: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You must be signed in." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing booking id." };

  let startTime: string | null;
  let endTime: string | null;
  try {
    startTime = optionalTime(formData.get("startTime"));
    endTime = optionalTime(formData.get("endTime"));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id } });
        if (!booking) throw new ConflictError("That request no longer exists.");

        // Re-check with the (possibly new) exact times against everyone else.
        await assertNoConflict(
          tx,
          {
            date: toDateKey(booking.date),
            endDate: toDateKey(booking.endDate),
            slot: booking.slot,
            startTime,
            endTime,
          },
          id
        );

        await tx.booking.update({
          where: { id },
          data: { status: "CONFIRMED", startTime, endTime },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/book");
  return { ok: true };
}

// --- Owner: decline / cancel / delete ------------------------------------

export async function declineBooking(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing booking id");

  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/book");
}

export async function cancelBooking(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing booking id");

  // Soft-cancel: frees the dates but keeps the record.
  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/book");
}

export async function deleteBooking(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing booking id");

  await prisma.booking.delete({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/book");
}
