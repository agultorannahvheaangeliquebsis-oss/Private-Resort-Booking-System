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

// Two taps on the same cell within this window count as a double-tap.
const DOUBLE_TAP_MS = 350;

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

/**
 * Booked/empty state for a single date — shared by the desktop side panel
 * and the mobile double-tap sheet so the two stay in sync for free.
 */
function SelectedDatePanel({
  date,
  bookings,
  occupancy,
  onAdd,
  onRefresh,
  hideHeader,
}: {
  date: string;
  bookings: BookingLite[];
  occupancy: Occupancy[];
  onAdd: () => void;
  onRefresh: () => void;
  hideHeader?: boolean;
}) {
  const openSlots = availableSlotsOn(date, occupancy);

  return (
    <>
      {!hideHeader && (
        <>
          <h3 className="text-base font-extrabold text-navy-800">
            {formatLongDate(date)}
          </h3>
          <p className="mb-4 text-xs text-navy-400">
            {bookings.length === 0
              ? "No reservations yet."
              : `${bookings.length} reservation${bookings.length > 1 ? "s" : ""}`}
          </p>
        </>
      )}

      <div className="rounded-lg border border-sky-border bg-sky-bg/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-navy-700">Whole Resort</span>
          <button
            onClick={onAdd}
            disabled={openSlots.length === 0}
            className="rounded-lg bg-navy-700 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add
          </button>
        </div>

        {bookings.length === 0 ? (
          <p className="text-xs text-navy-400">Available.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bookings.map((b) => {
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
                      <p className="text-xs text-navy-400">{dateRange(b)}</p>
                      <p className="text-xs font-medium text-navy-500">
                        {times ?? "Time to be set"}
                      </p>
                      {b.guestPhone && (
                        <p className="text-xs text-navy-400">{b.guestPhone}</p>
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
                    <ConfirmControl booking={b} onDone={onRefresh} />
                  ) : (
                    <form action={cancelBooking} className="mt-2 text-right">
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
    </>
  );
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");

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

  function navigateToMonth(targetYear: number, targetMonth0: number) {
    if (targetYear === year && targetMonth0 === month0) return;
    setSlideDir(
      targetYear > year || (targetYear === year && targetMonth0 > month0)
        ? "forward"
        : "back"
    );
    const key = `${targetYear}-${String(targetMonth0 + 1).padStart(2, "0")}`;
    router.push(`/dashboard/calendar?ym=${key}`);
  }

  function goMonth(delta: number) {
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    navigateToMonth(d.getUTCFullYear(), d.getUTCMonth());
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

  // Single tap selects (mouse or touch — both fire onClick). A second tap on
  // the same cell within DOUBLE_TAP_MS opens the detail sheet. The sheet's
  // own markup is `lg:hidden`, so on desktop this is a harmless no-op and
  // the side panel (always visible there) stays the source of truth.
  const lastTapKeyRef = useRef<string | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleCellActivate(key: string) {
    setSelected(key);
    if (lastTapKeyRef.current === key) {
      lastTapKeyRef.current = null;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setSheetOpen(true);
      return;
    }
    lastTapKeyRef.current = key;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      lastTapKeyRef.current = null;
    }, DOUBLE_TAP_MS);
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
        <div className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-navy-800 sm:text-xl">
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
                onClick={() => {
                  const [ty, tm] = today.split("-").map(Number);
                  navigateToMonth(ty, tm - 1);
                }}
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
            <span className="ml-auto hidden text-[11px] text-navy-400 lg:inline">
              Double-tap a date for details
            </span>
          </div>

          <div
            className="overflow-hidden touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div
              key={ymKey}
              className={[
                "grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2",
                slideDir === "forward" ? "animate-cal-forward" : "animate-cal-back",
              ].join(" ")}
            >
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-navy-400 sm:py-1.5 sm:text-xs"
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
                    onClick={() => handleCellActivate(cell.key)}
                    className={[
                      "flex min-h-19.5 flex-col rounded-lg border p-1.5 text-left transition sm:min-h-24 sm:p-2 md:min-h-27.5 lg:min-h-30.5",
                      tint,
                      isSelected
                        ? "border-navy-500 ring-2 ring-navy-300"
                        : "border-sky-border hover:border-navy-300",
                      cell.inMonth ? "" : "opacity-40",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mb-1 inline-flex h-6 w-6 items-center justify-center text-xs font-bold sm:h-7 sm:w-7 sm:text-sm",
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
                              "truncate rounded bg-navy-600 px-1 py-0.5 text-[10px] font-semibold leading-tight text-white sm:text-[11px]",
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
        </div>
      </section>

      {/* Selected-date panel — desktop only; mobile uses the double-tap sheet below */}
      <section className="hidden lg:block">
        <div className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5 md:p-6">
          <SelectedDatePanel
            date={selected}
            bookings={selectedBookings}
            occupancy={occupancy}
            onAdd={() => setModal(true)}
            onRefresh={refresh}
          />
        </div>
      </section>

      {/* Floating action button — quick add, always reachable */}
      <button
        onClick={() => setModal(true)}
        aria-label="New reservation"
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-sunset-400 text-3xl font-bold leading-none text-navy-900 shadow-lg shadow-navy-900/25 transition hover:bg-sunset-500 active:scale-95"
      >
        +
      </button>

      {/* Mobile double-tap sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-sky-border bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-sheet-up">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-sky-border" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-navy-800">
                {formatLongDate(selected)}
              </h3>
              <button
                onClick={() => setSheetOpen(false)}
                className="text-navy-400 hover:text-navy-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <SelectedDatePanel
              date={selected}
              bookings={selectedBookings}
              occupancy={occupancy}
              onAdd={() => {
                setSheetOpen(false);
                setModal(true);
              }}
              onRefresh={refresh}
              hideHeader
            />
          </div>
        </div>
      )}

      {/* Booking modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-navy-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-card border border-sky-border bg-white p-5 shadow-2xl">
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
        </div>
      )}
    </div>
  );
}
