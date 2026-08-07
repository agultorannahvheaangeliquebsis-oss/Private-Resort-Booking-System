"use server";

import { Prisma } from "@prisma/client";
import type { BookingSlot, BookingStatus, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { generateReference } from "@/lib/reference";
import {
  BOOKING_SLOTS,
  MAX_GUESTS,
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
import {
  sendBookingConfirmedEmail,
  sendRequestDeclinedEmail,
  sendRequestReceivedEmail,
} from "@/lib/mailer";

export type BookingActionState =
  | { ok: true; reference?: string }
  | { ok: false; error: string }
  | undefined;

// Thrown inside the transaction to surface a booking conflict as a clean
// message rather than an unexpected error.
class ConflictError extends Error {}

// Thrown for a plain input-validation problem (e.g. a malformed time), kept
// distinct from ConflictError since it's a form error, not a scheduling clash.
class ValidationError extends Error {}

/** True if a Prisma unique-constraint error was specifically on `reference`. */
function isReferenceClash(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes("reference")
  );
}

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
    throw new ValidationError("Please enter a valid time.");
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
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Only administrators can manage bookings." };
  }

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
    if (n > MAX_GUESTS) {
      return { ok: false, error: `Maximum of ${MAX_GUESTS} guests allowed.` };
    }
    pax = n;
  }

  let reference = generateReference();
  for (let attempt = 0; ; attempt++) {
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
              reference,
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
              createdById: admin.id,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      break;
    } catch (error) {
      if (isReferenceClash(error) && attempt === 0) {
        reference = generateReference();
        continue;
      }
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
  const ip = await getClientIp();
  const limited = rateLimit(`createRequest:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.ok) {
    return {
      ok: false,
      error: "Too many requests. Please try again in a few minutes.",
    };
  }

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
  if (pax > MAX_GUESTS) {
    return { ok: false, error: `Maximum of ${MAX_GUESTS} guests allowed.` };
  }

  let reference = generateReference();
  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          // Guest requests carry no exact times yet — the slot's default window
          // decides whether the date is still open to request.
          await assertNoConflict(tx, { date, endDate, slot });
          await tx.booking.create({
            data: {
              reference,
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
      break;
    } catch (error) {
      if (isReferenceClash(error) && attempt === 0) {
        reference = generateReference();
        continue;
      }
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

  if (guestEmail) {
    await sendRequestReceivedEmail({
      to: guestEmail,
      guestName,
      reference,
      slot,
      date,
      endDate,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/book");
  return { ok: true, reference };
}

// --- Staff: edit an existing booking's details ----------------------------
//
// Leaves status/source untouched — confirm/decline/cancel remain the only
// way to change those. A cancelled booking can't be edited back to life.

export async function updateBooking(
  _prev: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Only administrators can manage bookings." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing booking id." };

  const parsed = parseRange(formData);
  if (!parsed.ok) return parsed;
  const { slot, date, endDate } = parsed;

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
    if (n > MAX_GUESTS) {
      return { ok: false, error: `Maximum of ${MAX_GUESTS} guests allowed.` };
    }
    pax = n;
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.booking.findUnique({ where: { id } });
        if (!existing) throw new ConflictError("That booking no longer exists.");
        if (existing.status === "CANCELLED") {
          throw new ConflictError("Cancelled bookings can't be edited.");
        }

        await assertNoConflict(tx, { date, endDate, slot, startTime, endTime }, id);

        await tx.booking.update({
          where: { id },
          data: {
            slot,
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
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Only administrators can manage bookings." };
  }

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

  let confirmed: {
    reference: string;
    guestName: string;
    guestEmail: string | null;
    slot: BookingSlot;
    date: string;
    endDate: string;
  };

  try {
    confirmed = await prisma.$transaction(
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

        return {
          reference: booking.reference,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          slot: booking.slot,
          date: toDateKey(booking.date),
          endDate: toDateKey(booking.endDate),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, error: error.message };
    throw error;
  }

  if (confirmed.guestEmail) {
    await sendBookingConfirmedEmail({
      to: confirmed.guestEmail,
      guestName: confirmed.guestName,
      reference: confirmed.reference,
      slot: confirmed.slot,
      date: confirmed.date,
      endDate: confirmed.endDate,
      startTime,
      endTime,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/book");
  return { ok: true };
}

// --- Owner: decline / cancel ----------------------------------------------

// Soft-cancel: frees the dates but keeps the record. Declining a pending
// request and cancelling a confirmed booking are the same operation under
// the hood — kept as two exported names since callers address them by intent.
async function setCancelled(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing booking id");

  const before = await prisma.booking.findUnique({ where: { id } });

  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  // Only email for an actual decline of a guest-submitted request — a staff
  // member cancelling an already-confirmed stay is handled directly with the
  // guest, not through an automated notice.
  if (before && before.status === "PENDING" && before.source === "GUEST" && before.guestEmail) {
    await sendRequestDeclinedEmail({
      to: before.guestEmail,
      guestName: before.guestName,
      reference: before.reference,
      slot: before.slot,
      date: toDateKey(before.date),
      endDate: toDateKey(before.endDate),
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/book");
}

export async function declineBooking(formData: FormData): Promise<void> {
  await setCancelled(formData);
}

export async function cancelBooking(formData: FormData): Promise<void> {
  await setCancelled(formData);
}
