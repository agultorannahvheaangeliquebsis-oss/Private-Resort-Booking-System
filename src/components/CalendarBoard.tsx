"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingSlot, BookingSource, BookingStatus } from "@prisma/client";
import { cancelBooking } from "@/app/actions/bookings";
import {
  SLOT_LABELS,
  availabilityOn,
  availableSlotsOn,
  coversDate,
  type Occupancy,
} from "@/lib/booking";
import { ConfirmControl, StatusBadge } from "./ConfirmControl";
import {
  formatLongDate,
  formatShortDate,
  formatTime,
  monthLabel,
  nightsBetween,
  type MonthCell,
} from "@/lib/dates";
import { BookingForm } from "./BookingForm";

export type BookingLite = {
  id: string;
  slot: BookingSlot;
  status: BookingStatus;
  source: BookingSource;
  date: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  functionHallAircon: boolean;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  pax: number | null;
  notes: string | null;
};

const SLOT_SHORT: Record<BookingSlot, string> = {
  DAY: "Day",
  NIGHT: "Night",
  OVERNIGHT: "Overnight",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const asOccupancy = (b: BookingLite): Occupancy => ({
  date: b.date,
  endDate: b.endDate,
  slot: b.slot,
  startTime: b.startTime,
  endTime: b.endTime,
});

/** "2 PM – 12 NN" style range, or a fallback when no exact times are set. */
function timeRange(b: BookingLite): string | null {
  const start = formatTime(b.startTime);
  const end = formatTime(b.endTime);
  if (start && end) return `${start} – ${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return null;
}

function dateRange(b: BookingLite): string {
  if (b.date === b.endDate) return formatLongDate(b.date);
  const nights = nightsBetween(b.date, b.endDate);
  return `${formatShortDate(b.date)} → ${formatShortDate(b.endDate)} · ${nights} night${nights > 1 ? "s" : ""}`;
}

export function CalendarBoard({
  year,
  month0,
  cells,
  bookings,
  today,
}: {
  year: number;
  month0: number;
  cells: MonthCell[];
  bookings: BookingLite[];
  today: string;
}) {
  const router = useRouter();

  const firstInMonth = cells.find((c) => c.inMonth)!.key;
  const todayInMonth = cells.some((c) => c.inMonth && c.key === today);
  const defaultSelected = todayInMonth ? today : firstInMonth;

  const [selected, setSelected] = useState(defaultSelected);
  const [modal, setModal] = useState(false);

  // Reset the selected day when the visible month changes. Adjusting state
  // during render (not in an effect) is React's recommended pattern here.
  const ymKey = `${year}-${month0}`;
  const [prevYmKey, setPrevYmKey] = useState(ymKey);
  if (ymKey !== prevYmKey) {
    setPrevYmKey(ymKey);
    setSelected(defaultSelected);
  }

  const occupancy = useMemo(() => bookings.map(asOccupancy), [bookings]);

  // Bookings covering each date (multi-day stays appear on every day).
  const coverByDate = useMemo(() => {
    const map = new Map<string, BookingLite[]>();
    for (const cell of cells) {
      const list = bookings.filter((b) => coversDate(b, cell.key));
      if (list.length) map.set(cell.key, list);
    }
    return map;
  }, [bookings, cells]);

  const selectedBookings = coverByDate.get(selected) ?? [];

  function goMonth(delta: number) {
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    router.push(`/dashboard/calendar?ym=${key}`);
  }

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    goMonth(dx < 0 ? 1 : -1);
  }

  function refresh() {
    router.refresh();
  }
  function closeModalAndRefresh() {
    setModal(false);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Calendar */}
      <section className="lg:col-span-2">
        <div className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-navy-800">
              {monthLabel(year, month0)}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => goMonth(-1)}
                className="rounded-lg border border-sky-border bg-white px-2.5 py-1.5 text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
                aria-label="Previous month"
              >
                ‹
              </button>
              <button
                onClick={() => router.push("/dashboard/calendar")}
                className="rounded-lg border border-sky-border bg-white px-3 py-1.5 text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
              >
                Today
              </button>
              <button
                onClick={() => goMonth(1)}
                className="rounded-lg border border-sky-border bg-white px-2.5 py-1.5 text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-navy-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-sky-border bg-white" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-sunset-100 ring-1 ring-sunset-300" />
              Partly booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-navy-100 ring-1 ring-navy-300" />
              Fully booked
            </span>
          </div>

          <div
            className="grid grid-cols-7 gap-1 touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-navy-400"
              >
                {w}
              </div>
            ))}

            {cells.map((cell) => {
              const dayBookings = coverByDate.get(cell.key) ?? [];
              const resortAvail = availabilityOn(cell.key, occupancy);

              const isSelected = cell.key === selected;
              const isToday = cell.key === today;

              const tint =
                resortAvail === "full"
                  ? "bg-navy-100"
                  : resortAvail === "partial"
                    ? "bg-sunset-50"
                    : "bg-white";

              return (
                <button
                  key={cell.key}
                  onClick={() => setSelected(cell.key)}
                  className={[
                    "flex min-h-[68px] flex-col rounded-lg border p-1.5 text-left transition sm:min-h-[84px]",
                    tint,
                    isSelected
                      ? "border-navy-500 ring-2 ring-navy-300"
                      : "border-sky-border hover:border-navy-300",
                    cell.inMonth ? "" : "opacity-40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mb-1 inline-flex h-5 w-5 items-center justify-center text-xs font-bold",
                      isToday
                        ? "rounded-full bg-navy-700 text-white"
                        : "text-navy-700",
                    ].join(" ")}
                  >
                    {cell.day}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    {dayBookings.map((b) => {
                      const multi = b.date !== b.endDate;
                      const cont =
                        multi && b.date !== cell.key ? "‹ " : "";
                      const tail =
                        multi && b.endDate !== cell.key ? " ›" : "";
                      return (
                        <span
                          key={b.id}
                          className={[
                            "truncate rounded bg-navy-600 px-1 text-[10px] font-semibold leading-tight text-white",
                            b.status === "PENDING" ? "opacity-60" : "",
                          ].join(" ")}
                        >
                          {cont}
                          {SLOT_SHORT[b.slot]}
                          {b.functionHallAircon ? " ❄" : ""}
                          {tail}
                        </span>
                      );
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Selected-date panel */}
      <section>
        <div className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
          <h3 className="text-base font-extrabold text-navy-800">
            {formatLongDate(selected)}
          </h3>
          <p className="mb-4 text-xs text-navy-400">
            {selectedBookings.length === 0
              ? "No reservations yet."
              : `${selectedBookings.length} reservation${selectedBookings.length > 1 ? "s" : ""}`}
          </p>

          {(() => {
            const openSlots = availableSlotsOn(selected, occupancy);
            return (
              <div className="rounded-lg border border-sky-border bg-sky-bg/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-navy-700">
                    Whole Resort
                  </span>
                  <button
                    onClick={() => setModal(true)}
                    disabled={openSlots.length === 0}
                    className="rounded-lg bg-navy-700 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    + Add
                  </button>
                </div>

                {selectedBookings.length === 0 ? (
                  <p className="text-xs text-navy-400">Available.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {selectedBookings.map((b) => {
                      const times = timeRange(b);
                      return (
                        <li
                          key={b.id}
                          className="rounded-lg border border-sky-border bg-white p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-navy-800">
                                {b.guestName}
                                {b.source === "GUEST" && (
                                  <span className="ml-1.5 rounded bg-sky-panel px-1 text-[9px] font-bold uppercase text-navy-500">
                                    Guest
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-navy-500">
                                {SLOT_LABELS[b.slot]}
                                {b.pax ? ` · ${b.pax} pax` : ""}
                                {b.functionHallAircon ? " · Hall + aircon" : ""}
                              </p>
                              <p className="text-xs text-navy-400">
                                {dateRange(b)}
                              </p>
                              <p className="text-xs font-medium text-navy-500">
                                {times ?? "Time to be set"}
                              </p>
                              {b.guestPhone && (
                                <p className="text-xs text-navy-400">
                                  {b.guestPhone}
                                </p>
                              )}
                              {b.notes && (
                                <p className="mt-1 text-xs italic text-navy-400">
                                  {b.notes}
                                </p>
                              )}
                            </div>
                            <StatusBadge status={b.status} />
                          </div>

                          {b.status === "PENDING" ? (
                            <ConfirmControl booking={b} onDone={refresh} />
                          ) : (
                            <form
                              action={cancelBooking}
                              className="mt-2 text-right"
                            >
                              <input type="hidden" name="id" value={b.id} />
                              <button
                                type="submit"
                                onClick={(e) => {
                                  if (
                                    !window.confirm(
                                      `Cancel ${b.guestName}'s reservation?`
                                    )
                                  )
                                    e.preventDefault();
                                }}
                                className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
                              >
                                Cancel reservation
                              </button>
                            </form>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* Booking modal */}
      {modal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-card border border-sky-border bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-navy-800">
                New reservation
              </h3>
              <button
                onClick={() => setModal(false)}
                className="text-navy-400 hover:text-navy-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <BookingForm
              date={selected}
              occupancy={occupancy}
              onSuccess={closeModalAndRefresh}
              onCancel={() => setModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
