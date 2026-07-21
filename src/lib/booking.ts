import type { BookingSlot, ResourceType } from "@prisma/client";
import { dayIndex, formatTime, type DateKey } from "./dates";

// --- Display labels -------------------------------------------------------

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  RESORT: "Whole Resort",
  FUNCTION_HALL: "Function Hall",
};

export const SLOT_LABELS: Record<BookingSlot, string> = {
  DAY: "Day Tour",
  NIGHT: "Night Tour",
  OVERNIGHT: "Overnight",
};

export const RESOURCE_TYPES: ResourceType[] = ["RESORT", "FUNCTION_HALL"];
export const BOOKING_SLOTS: BookingSlot[] = ["DAY", "NIGHT", "OVERNIGHT"];

// --- Slot time windows ----------------------------------------------------
//
// Guests only pick a coarse slot; the owner enters exact times later. Until
// then availability falls back to these default windows, expressed in minutes
// from midnight of the check-in date. NIGHT and OVERNIGHT cross midnight, so
// their end minute lands on the following day.

type Window = { start: number; end: number };

const H = (h: number, m = 0) => h * 60 + m;

export const SLOT_WINDOWS: Record<BookingSlot, Window> = {
  DAY: { start: H(6), end: H(18) }, //  6:00 AM – 6:00 PM
  NIGHT: { start: H(18), end: H(6) }, //  6:00 PM – 6:00 AM (+1)
  OVERNIGHT: { start: H(14), end: H(12) }, //  2:00 PM – 12:00 NN (+1)
};

/** A short human hint of a slot's default hours, e.g. "6:00 AM – 6:00 PM". */
export function slotWindowLabel(slot: BookingSlot): string {
  const w = SLOT_WINDOWS[slot];
  const fmt = (min: number) => formatTime(`${Math.floor(min / 60) % 24}:${String(min % 60).padStart(2, "0")}`);
  return `${fmt(w.start)} – ${fmt(w.end)}`;
}

// --- Occupancy intervals --------------------------------------------------

/** The minimal booking shape the availability math needs. */
export type Occupancy = {
  date: DateKey; // check-in
  endDate: DateKey; // check-out (== date for single-day)
  slot: BookingSlot;
  startTime?: string | null;
  endTime?: string | null;
};

/** Parse "HH:MM" to minutes-from-midnight, or null if blank/invalid. */
function parseMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Absolute [start, end) minutes for a booking on the shared timeline
 * (minutes since the Unix epoch). Uses the owner's exact times when present,
 * otherwise the slot's default window. This is the whole conflict model:
 * two bookings clash iff their intervals overlap.
 */
export function occupancyInterval(b: Occupancy): [number, number] {
  const win = SLOT_WINDOWS[b.slot];
  const startMin = parseMinutes(b.startTime) ?? win.start;
  const endMin = parseMinutes(b.endTime) ?? win.end;

  const startAbs = dayIndex(b.date) * 1440 + startMin;
  let endAbs = dayIndex(b.endDate) * 1440 + endMin;

  // Single-day NIGHT/OVERNIGHT (or any end-before-start) rolls to next day.
  if (endAbs <= startAbs) endAbs += 1440;

  return [startAbs, endAbs];
}

/** Half-open interval overlap. */
function intervalsOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/** Do two bookings occupy overlapping time? (Caller filters by resource.) */
export function bookingsConflict(a: Occupancy, b: Occupancy): boolean {
  return intervalsOverlap(occupancyInterval(a), occupancyInterval(b));
}

/** True if a booking's date range covers the given calendar date. */
export function coversDate(b: Pick<Occupancy, "date" | "endDate">, key: DateKey): boolean {
  return key >= b.date && key <= b.endDate;
}

/**
 * A candidate single-day booking of `slot` on `date`, used to test what a
 * guest could still request. Default times (no owner override yet).
 */
function candidate(date: DateKey, slot: BookingSlot): Occupancy {
  return { date, endDate: date, slot };
}

/**
 * Which slots a guest could still request on `date` for one resource, given
 * the bookings already on that resource. `existing` may include multi-day
 * stays; their intervals are honored automatically.
 */
export function availableSlotsOn(
  date: DateKey,
  existing: Occupancy[]
): BookingSlot[] {
  return BOOKING_SLOTS.filter(
    (slot) => !existing.some((b) => bookingsConflict(candidate(date, slot), b))
  );
}

// --- Coarse availability for calendar coloring ----------------------------

export type Availability = "open" | "partial" | "full";

export function availabilityOn(date: DateKey, existing: Occupancy[]): Availability {
  const touches = existing.filter((b) => coversDate(b, date));
  if (touches.length === 0) return "open";
  return availableSlotsOn(date, existing).length === 0 ? "full" : "partial";
}
