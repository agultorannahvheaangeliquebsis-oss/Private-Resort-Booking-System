"use server";

import type { BookingSlot, BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { toDateKey } from "@/lib/dates";

export type StatusResult = {
  reference: string;
  guestName: string;
  slot: BookingSlot;
  status: BookingStatus;
  date: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  functionHallAircon: boolean;
  pax: number | null;
};

export type StatusLookupState =
  | { ok: true; result: StatusResult }
  | { ok: false; error: string }
  | undefined;

/** Digits only, for a forgiving phone-number comparison. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export async function lookupBooking(
  _prev: StatusLookupState,
  formData: FormData
): Promise<StatusLookupState> {
  const ip = await getClientIp();
  const limited = rateLimit(`statusLookup:${ip}`, 10, 15 * 60 * 1000);
  if (!limited.ok) {
    return {
      ok: false,
      error: "Too many attempts. Please try again in a few minutes.",
    };
  }

  const reference = String(formData.get("reference") ?? "")
    .trim()
    .toUpperCase();
  const phone = digitsOnly(String(formData.get("phone") ?? ""));

  const genericError =
    "No booking found with that reference and phone number.";

  if (!reference || !phone) return { ok: false, error: genericError };

  const booking = await prisma.booking.findUnique({ where: { reference } });
  if (!booking || digitsOnly(booking.guestPhone ?? "") !== phone) {
    return { ok: false, error: genericError };
  }

  return {
    ok: true,
    result: {
      reference: booking.reference,
      guestName: booking.guestName,
      slot: booking.slot,
      status: booking.status,
      date: toDateKey(booking.date),
      endDate: toDateKey(booking.endDate),
      startTime: booking.startTime,
      endTime: booking.endTime,
      functionHallAircon: booking.functionHallAircon,
      pax: booking.pax,
    },
  };
}
