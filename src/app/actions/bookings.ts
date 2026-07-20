"use server";

import { Prisma } from "@prisma/client";
import type { BookingSlot, BookingStatus, ResourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BOOKING_SLOTS,
  RESOURCE_LABELS,
  RESOURCE_TYPES,
  SLOT_LABELS,
  slotsConflict,
} from "@/lib/booking";
import { dateKeyToUTC, isValidDateKey, todayKey } from "@/lib/dates";

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

export async function createBooking(
  _prev: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You must be signed in." };

  const resource = String(formData.get("resource") ?? "") as ResourceType;
  const slot = String(formData.get("slot") ?? "") as BookingSlot;
  const date = String(formData.get("date") ?? "");
  const statusRaw = String(formData.get("status") ?? "CONFIRMED");
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestPhone = optionalString(formData.get("guestPhone"));
  const guestEmail = optionalString(formData.get("guestEmail"));
  const notes = optionalString(formData.get("notes"));
  const paxRaw = optionalString(formData.get("pax"));

  // --- Validation ---------------------------------------------------------
  if (!RESOURCE_TYPES.includes(resource)) {
    return { ok: false, error: "Please choose what to book." };
  }
  if (!BOOKING_SLOTS.includes(slot)) {
    return { ok: false, error: "Please choose a booking type." };
  }
  if (!isValidDateKey(date)) {
    return { ok: false, error: "Please choose a valid date." };
  }
  if (date < todayKey()) {
    return { ok: false, error: "You can't book a date in the past." };
  }
  if (!guestName) {
    return { ok: false, error: "Guest name is required." };
  }

  let pax: number | null = null;
  if (paxRaw !== null) {
    const n = Number(paxRaw);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, error: "Number of guests must be a positive number." };
    }
    pax = n;
  }

  const status: BookingStatus =
    statusRaw === "PENDING" ? "PENDING" : "CONFIRMED";

  // --- Insert with conflict check ----------------------------------------
  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.booking.findMany({
          where: {
            resource,
            date: dateKeyToUTC(date),
            status: { not: "CANCELLED" },
          },
          select: { slot: true },
        });

        const clash = existing.find((b) => slotsConflict(b.slot, slot));
        if (clash) {
          throw new ConflictError(
            `${RESOURCE_LABELS[resource]} is already booked (${SLOT_LABELS[clash.slot]}) on this date.`
          );
        }

        await tx.booking.create({
          data: {
            resource,
            slot,
            status,
            date: dateKeyToUTC(date),
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
    if (error instanceof ConflictError) {
      return { ok: false, error: error.message };
    }
    // Partial unique index / serialization race: the slot was taken between
    // our check and insert.
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
  return { ok: true };
}

export async function cancelBooking(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing booking id");

  // Soft-cancel: frees the date/slot but keeps the record.
  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/dashboard");
}

export async function deleteBooking(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing booking id");

  await prisma.booking.delete({ where: { id } });
  revalidatePath("/dashboard");
}
