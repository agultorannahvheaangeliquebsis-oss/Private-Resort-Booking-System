import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  buildMonthGrid,
  dateKeyToUTC,
  datesInRange,
  dayIndex,
  formatShortDate,
  formatTime,
  isValidDateKey,
  monthLabel,
  nightsBetween,
  toDateKey,
} from "./dates";

describe("toDateKey / dateKeyToUTC", () => {
  it("round-trips a date key through UTC midnight", () => {
    expect(toDateKey(dateKeyToUTC("2026-08-10"))).toBe("2026-08-10");
  });

  it("normalizes a Date to its UTC calendar day", () => {
    const d = new Date("2026-08-10T00:00:00.000Z");
    expect(toDateKey(d)).toBe("2026-08-10");
  });
});

describe("isValidDateKey", () => {
  it("accepts a well-formed calendar date", () => {
    expect(isValidDateKey("2026-08-10")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isValidDateKey("2026/08/10")).toBe(false);
    expect(isValidDateKey("08-10-2026")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
  });

  it("rejects calendar dates that don't exist", () => {
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
  });

  it("accepts a leap day only in a leap year", () => {
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
  });
});

describe("dayIndex", () => {
  it("increases by exactly 1 per calendar day", () => {
    expect(dayIndex("2026-08-11") - dayIndex("2026-08-10")).toBe(1);
  });

  it("is stable across a month boundary", () => {
    expect(dayIndex("2026-09-01") - dayIndex("2026-08-31")).toBe(1);
  });
});

describe("addDaysKey", () => {
  it("adds days forward across a month boundary", () => {
    expect(addDaysKey("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("subtracts days for a negative delta", () => {
    expect(addDaysKey("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("rolls forward across a year boundary", () => {
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("datesInRange", () => {
  it("is inclusive of both endpoints", () => {
    expect(datesInRange("2026-08-10", "2026-08-12")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
  });

  it("returns a single date when start equals end", () => {
    expect(datesInRange("2026-08-10", "2026-08-10")).toEqual(["2026-08-10"]);
  });

  it("returns an empty range when end is before start", () => {
    expect(datesInRange("2026-08-12", "2026-08-10")).toEqual([]);
  });
});

describe("nightsBetween", () => {
  it("is 0 for a single-day booking", () => {
    expect(nightsBetween("2026-08-10", "2026-08-10")).toBe(0);
  });

  it("counts one night per day of stay", () => {
    expect(nightsBetween("2026-08-10", "2026-08-12")).toBe(2);
  });

  it("clamps to 0 rather than going negative", () => {
    expect(nightsBetween("2026-08-12", "2026-08-10")).toBe(0);
  });
});

describe("buildMonthGrid", () => {
  it("always returns a 6x7 grid", () => {
    expect(buildMonthGrid(2026, 7).length).toBe(42); // August 2026 (month0 = 7)
  });

  it("marks days outside the target month as not in-month", () => {
    const grid = buildMonthGrid(2026, 7); // August 2026
    expect(grid[0].inMonth).toBe(false); // padded from July
    const inMonthDays = grid.filter((c) => c.inMonth);
    expect(inMonthDays.length).toBe(31); // August has 31 days
  });

  it("starts each row on Sunday", () => {
    const grid = buildMonthGrid(2026, 7);
    const firstCellDate = dateKeyToUTC(grid[0].key);
    expect(firstCellDate.getUTCDay()).toBe(0);
  });
});

describe("monthLabel", () => {
  it("formats a year and 0-indexed month", () => {
    expect(monthLabel(2026, 0)).toBe("January 2026");
    expect(monthLabel(2026, 11)).toBe("December 2026");
  });
});

describe("formatShortDate", () => {
  it("formats a date key without a year", () => {
    expect(formatShortDate("2026-08-10")).toBe("Aug 10");
  });
});

describe("formatTime", () => {
  it("formats midnight and noon correctly", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });

  it("formats a standard afternoon time", () => {
    expect(formatTime("14:30")).toBe("2:30 PM");
  });

  it("returns null for blank or malformed input", () => {
    expect(formatTime(null)).toBeNull();
    expect(formatTime(undefined)).toBeNull();
    expect(formatTime("")).toBeNull();
    expect(formatTime("not-a-time")).toBeNull();
  });

  it("returns null for an out-of-range time", () => {
    expect(formatTime("25:00")).toBeNull();
    expect(formatTime("10:60")).toBeNull();
  });
});
