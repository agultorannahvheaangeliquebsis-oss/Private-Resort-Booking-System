import { describe, expect, it } from "vitest";
import {
  availabilityOn,
  availableSlotsOn,
  bookingsConflict,
  coversDate,
  occupancyInterval,
  type Occupancy,
} from "./booking";

function occ(
  date: string,
  endDate: string,
  slot: Occupancy["slot"],
  startTime?: string | null,
  endTime?: string | null
): Occupancy {
  return { date, endDate, slot, startTime, endTime };
}

describe("occupancyInterval", () => {
  it("keeps DAY within a single calendar day (default window)", () => {
    const [start, end] = occupancyInterval(occ("2026-08-10", "2026-08-10", "DAY"));
    expect(end - start).toBe(12 * 60); // 6 AM - 6 PM
  });

  it("rolls NIGHT's default window into the next day", () => {
    const [start, end] = occupancyInterval(occ("2026-08-10", "2026-08-10", "NIGHT"));
    expect(end - start).toBe(12 * 60); // 6 PM - 6 AM (+1)
  });

  it("rolls OVERNIGHT's default window into the next day", () => {
    const [start, end] = occupancyInterval(occ("2026-08-10", "2026-08-10", "OVERNIGHT"));
    expect(end - start).toBe(22 * 60); // 2 PM - 12 NN (+1)
  });

  it("uses exact owner times over the slot default when both are set", () => {
    const [start, end] = occupancyInterval(
      occ("2026-08-10", "2026-08-10", "OVERNIGHT", "15:00", "10:00")
    );
    expect(end - start).toBe(19 * 60); // 3 PM - 10 AM (+1)
  });

  it("falls back to the slot default when only one exact time is set", () => {
    const withStart = occupancyInterval(occ("2026-08-10", "2026-08-10", "DAY", "08:00", null));
    const withEnd = occupancyInterval(occ("2026-08-10", "2026-08-10", "DAY", null, "20:00"));
    expect(withStart[1] - withStart[0]).toBe(10 * 60); // 8 AM - 6 PM (default end)
    expect(withEnd[1] - withEnd[0]).toBe(14 * 60); // 6 AM (default start) - 8 PM
  });

  it("spans multiple full days for a multi-night OVERNIGHT stay", () => {
    const [start, end] = occupancyInterval(occ("2026-08-10", "2026-08-12", "OVERNIGHT"));
    // Check-in 2 PM Aug 10 to checkout 12 NN Aug 12: 48h minus the 2h the
    // checkout falls short of another full 2 PM-to-2 PM day.
    expect(end - start).toBe(2 * 1440 - 2 * 60);
  });

  it("ignores an invalid or malformed exact time and falls back to the default", () => {
    const [start, end] = occupancyInterval(occ("2026-08-10", "2026-08-10", "DAY", "99:99", "not-a-time"));
    expect(end - start).toBe(12 * 60);
  });
});

describe("bookingsConflict", () => {
  it("flags identical single-day bookings of the same slot as a conflict", () => {
    const a = occ("2026-08-10", "2026-08-10", "DAY");
    const b = occ("2026-08-10", "2026-08-10", "DAY");
    expect(bookingsConflict(a, b)).toBe(true);
  });

  it("does not conflict DAY and NIGHT on the same date (disjoint windows)", () => {
    const day = occ("2026-08-10", "2026-08-10", "DAY");
    const night = occ("2026-08-10", "2026-08-10", "NIGHT");
    expect(bookingsConflict(day, night)).toBe(false);
  });

  it("conflicts NIGHT with the next day's DAY (night rolls into the next morning)", () => {
    const night = occ("2026-08-10", "2026-08-10", "NIGHT"); // 6 PM Aug 10 - 6 AM Aug 11
    const nextDay = occ("2026-08-11", "2026-08-11", "DAY"); // 6 AM - 6 PM Aug 11
    // Both windows touch exactly at 6 AM Aug 11; half-open interval means no overlap.
    expect(bookingsConflict(night, nextDay)).toBe(false);
  });

  it("conflicts an OVERNIGHT checkout with a same-day DAY booking that starts before noon checkout", () => {
    const overnight = occ("2026-08-09", "2026-08-10", "OVERNIGHT"); // ends 12 NN Aug 10
    const day = occ("2026-08-10", "2026-08-10", "DAY"); // starts 6 AM Aug 10
    expect(bookingsConflict(overnight, day)).toBe(true);
  });

  it("frees up the same night when an OVERNIGHT stay gets an early exact checkout", () => {
    const overnight = occ("2026-08-09", "2026-08-10", "OVERNIGHT", null, "10:00"); // ends 10 AM Aug 10
    const nightAfter = occ("2026-08-10", "2026-08-10", "NIGHT"); // starts 6 PM Aug 10
    expect(bookingsConflict(overnight, nightAfter)).toBe(false);
  });

  it("detects overlap between two multi-day stays that only partially share dates", () => {
    const a = occ("2026-08-10", "2026-08-12", "OVERNIGHT");
    const b = occ("2026-08-12", "2026-08-14", "OVERNIGHT");
    // a ends 12 NN Aug 12, b starts 2 PM Aug 12 - no overlap.
    expect(bookingsConflict(a, b)).toBe(false);
  });

  it("detects overlap when a multi-day stay's checkout is after the next stay's check-in time", () => {
    const a = occ("2026-08-10", "2026-08-12", "OVERNIGHT", null, "15:00"); // ends 3 PM Aug 12
    const b = occ("2026-08-12", "2026-08-14", "OVERNIGHT"); // starts 2 PM Aug 12
    expect(bookingsConflict(a, b)).toBe(true);
  });

  it("does not conflict bookings on entirely separate dates", () => {
    const a = occ("2026-08-10", "2026-08-10", "OVERNIGHT");
    const b = occ("2026-08-15", "2026-08-15", "OVERNIGHT");
    expect(bookingsConflict(a, b)).toBe(false);
  });
});

describe("coversDate", () => {
  it("is true for a date within a multi-day range, including both ends", () => {
    const b = { date: "2026-08-10", endDate: "2026-08-12" };
    expect(coversDate(b, "2026-08-10")).toBe(true);
    expect(coversDate(b, "2026-08-11")).toBe(true);
    expect(coversDate(b, "2026-08-12")).toBe(true);
  });

  it("is false just outside the range", () => {
    const b = { date: "2026-08-10", endDate: "2026-08-12" };
    expect(coversDate(b, "2026-08-09")).toBe(false);
    expect(coversDate(b, "2026-08-13")).toBe(false);
  });
});

describe("availableSlotsOn", () => {
  it("returns all slots when nothing is booked", () => {
    expect(availableSlotsOn("2026-08-10", [])).toEqual(["DAY", "NIGHT", "OVERNIGHT"]);
  });

  it("excludes DAY and OVERNIGHT (2 PM start falls inside DAY's window) but leaves NIGHT open", () => {
    const existing = [occ("2026-08-10", "2026-08-10", "DAY")];
    expect(availableSlotsOn("2026-08-10", existing)).toEqual(["NIGHT"]);
  });

  it("returns nothing when an OVERNIGHT stay already covers the date", () => {
    const existing = [occ("2026-08-10", "2026-08-10", "OVERNIGHT")];
    expect(availableSlotsOn("2026-08-10", existing)).toEqual([]);
  });
});

describe("availabilityOn", () => {
  it("is 'open' when no booking touches the date", () => {
    expect(availabilityOn("2026-08-10", [])).toBe("open");
  });

  it("is 'partial' when only some slots are taken", () => {
    const existing = [occ("2026-08-10", "2026-08-10", "DAY")];
    expect(availabilityOn("2026-08-10", existing)).toBe("partial");
  });

  it("is 'full' when every slot is taken", () => {
    const existing = [occ("2026-08-10", "2026-08-10", "OVERNIGHT")];
    expect(availabilityOn("2026-08-10", existing)).toBe("full");
  });

  it("is 'partial', not 'open', for a multi-day stay's interior date with no bookings that start there", () => {
    const existing = [occ("2026-08-10", "2026-08-12", "OVERNIGHT")];
    expect(availabilityOn("2026-08-11", existing)).toBe("full");
  });
});
