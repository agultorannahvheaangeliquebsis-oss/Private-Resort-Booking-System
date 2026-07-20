import type { BookingSlot, ResourceType } from "@prisma/client";

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

// --- Overlap rules --------------------------------------------------------

type Period = "day" | "night";

/**
 * Which parts of a date each slot occupies. This is the whole model:
 *   DAY + NIGHT can coexist; OVERNIGHT occupies both and blocks the date.
 */
export const SLOT_PERIODS: Record<BookingSlot, Period[]> = {
  DAY: ["day"],
  NIGHT: ["night"],
  OVERNIGHT: ["day", "night"],
};

/** Two slots (on the same resource + date) conflict if their periods intersect. */
export function slotsConflict(a: BookingSlot, b: BookingSlot): boolean {
  return SLOT_PERIODS[a].some((p) => SLOT_PERIODS[b].includes(p));
}

/**
 * Given the slots already booked for a resource on a date, return the slots
 * that can still be booked without conflict.
 */
export function availableSlots(taken: BookingSlot[]): BookingSlot[] {
  return BOOKING_SLOTS.filter((s) => !taken.some((t) => slotsConflict(s, t)));
}

/** Coarse availability of a resource on one date, for calendar coloring. */
export type Availability = "open" | "partial" | "full";

export function availabilityFor(taken: BookingSlot[]): Availability {
  if (taken.length === 0) return "open";
  return availableSlots(taken).length === 0 ? "full" : "partial";
}
