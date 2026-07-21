"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingSlot, BookingStatus } from "@prisma/client";
import { createRequest, type BookingActionState } from "@/app/actions/bookings";
import {
  MAX_GUESTS,
  SLEEPING_CAPACITY,
  SLOT_LABELS,
  availabilityOn,
  availableSlotsOn,
  coversDate,
  slotWindowLabel,
  type Occupancy,
} from "@/lib/booking";
import {
  formatLongDate,
  formatShortDate,
  formatTime,
  monthLabel,
  nightsBetween,
  type MonthCell,
} from "@/lib/dates";
import { Brandmark } from "./Brandmark";

export type PublicBookingLite = {
  slot: BookingSlot;
  status: BookingStatus;
  date: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
};

const SLOT_SHORT: Record<BookingSlot, string> = {
  DAY: "Day",
  NIGHT: "Night",
  OVERNIGHT: "Overnight",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Two taps on the same cell within this window count as a double-tap.
const DOUBLE_TAP_MS = 350;

const inputClass =
  "rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200";

/** Booked-block time text: exact times if set, else the default window. */
function blockTime(b: PublicBookingLite): string {
  const start = formatTime(b.startTime);
  const end = formatTime(b.endTime);
  if (start && end) return `${start} – ${end}`;
  return slotWindowLabel(b.slot);
}

// --- Request form ---------------------------------------------------------

function RequestForm({
  initialDate,
  occupancy,
  onDone,
}: {
  initialDate: string;
  occupancy: Occupancy[];
  onDone: () => void;
}) {
  const [checkIn, setCheckIn] = useState(initialDate);
  const [checkOut, setCheckOut] = useState(initialDate);
  const [pax, setPax] = useState("1");
  const [state, action, pending] = useActionState<BookingActionState, FormData>(
    createRequest,
    undefined
  );

  function bumpPax(delta: number) {
    setPax((p) =>
      String(Math.min(MAX_GUESTS, Math.max(1, (parseInt(p, 10) || 0) + delta)))
    );
  }

  const nights = nightsBetween(checkIn, checkOut);
  const isMultiDay = nights >= 1;

  const openSlots = useMemo(
    () => availableSlotsOn(checkIn, occupancy),
    [occupancy, checkIn]
  );

  // Keep check-out at or after check-in.
  function onCheckInChange(value: string) {
    setCheckIn(value);
    if (checkOut < value) setCheckOut(value);
  }

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h3 className="text-lg font-extrabold text-navy-800">Request sent!</h3>
        <p className="max-w-xs text-sm text-navy-500">
          Fabian&apos;s Azzure will contact you to confirm your reservation and
          the exact time. Thank you!
        </p>
        <button
          onClick={onDone}
          className="mt-1 rounded-lg bg-navy-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-navy-800"
        >
          Done
        </button>
      </div>
    );
  }

  const noSlots = !isMultiDay && openSlots.length === 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="date" value={checkIn} />
      <input type="hidden" name="endDate" value={checkOut} />
      {isMultiDay && <input type="hidden" name="slot" value="OVERNIGHT" />}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-navy-700">Check-in</span>
          <input
            type="date"
            value={checkIn}
            min={initialDate < checkIn ? initialDate : undefined}
            onChange={(e) => onCheckInChange(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-navy-700">Check-out</span>
          <input
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      {isMultiDay && (
        <p className="rounded-lg bg-sky-panel/60 px-3 py-2 text-xs font-medium text-navy-600">
          {nights}-night overnight stay · {formatShortDate(checkIn)} →{" "}
          {formatShortDate(checkOut)}
        </p>
      )}

      {!isMultiDay && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-navy-700">
            Booking type
          </span>
          <select name="slot" className={inputClass} disabled={noSlots} required>
            {openSlots.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      {noSlots ? (
        <p className="rounded-lg bg-navy-100 px-3 py-2 text-sm font-medium text-navy-700">
          The resort is fully booked that day. Try another date.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-700">
              Your name <span className="text-red-500">*</span>
            </span>
            <input name="guestName" required className={inputClass} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-navy-700">
                Contact number <span className="text-red-500">*</span>
              </span>
              <input
                name="guestPhone"
                inputMode="tel"
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-navy-700">
                No. of sleeping guests <span className="text-red-500">*</span>
              </span>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-sky-border bg-white transition focus-within:border-navy-400 focus-within:ring-2 focus-within:ring-navy-200">
                <button
                  type="button"
                  onClick={() => bumpPax(-1)}
                  aria-label="Fewer guests"
                  className="px-3 text-lg font-bold text-navy-600 transition hover:bg-sky-panel"
                >
                  −
                </button>
                <input
                  name="pax"
                  inputMode="numeric"
                  required
                  value={pax}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    const n = parseInt(digits, 10);
                    setPax(
                      digits === ""
                        ? ""
                        : String(Math.min(MAX_GUESTS, n || 0))
                    );
                  }}
                  className="w-full min-w-0 border-x border-sky-border px-2 py-2 text-center text-sm text-navy-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => bumpPax(1)}
                  aria-label="More guests"
                  className="px-3 text-lg font-bold text-navy-600 transition hover:bg-sky-panel"
                >
                  +
                </button>
              </div>
            </label>
          </div>

          {Number(pax) > SLEEPING_CAPACITY && (
            <p className="rounded-lg bg-sunset-100 px-3 py-2 text-xs font-medium text-navy-700">
              Sleeping capacity is {SLEEPING_CAPACITY}. Guests beyond that (up
              to {MAX_GUESTS} max) carry additional charges.
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-700">
              Email <span className="font-normal text-navy-400">(optional)</span>
            </span>
            <input name="guestEmail" type="email" className={inputClass} />
          </label>

          <label className="flex items-start gap-2 rounded-lg border border-sky-border bg-sky-panel/40 px-3 py-2.5">
            <input
              type="checkbox"
              name="functionHallAircon"
              className="mt-0.5 h-4 w-4 rounded border-sky-border text-navy-700 focus:ring-navy-300"
            />
            <span className="text-xs text-navy-700">
              <span className="font-semibold">
                Use the function hall with air-conditioning
              </span>
              <br />
              <span className="text-navy-500">
                Additional charges apply.
              </span>
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-700">
              Message / requests
            </span>
            <textarea name="notes" rows={2} className={inputClass} />
          </label>

          <p className="text-[11px] text-navy-400">
            We&apos;ll use your contact number to confirm. The owner confirms
            every reservation.
          </p>
        </>
      )}

      {state && !state.ok && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-sky-border bg-white px-4 py-2 text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || noSlots}
          className="rounded-lg bg-sunset-400 px-4 py-2 text-sm font-bold text-navy-900 shadow-sm transition hover:bg-sunset-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}

// --- Selected-date availability --------------------------------------------

/**
 * Booked/open state for a single date — shared by the desktop side panel
 * and the mobile double-tap sheet so the two stay in sync for free.
 */
function SelectedDatePanel({
  date,
  isPast,
  booked,
  openSlots,
  onRequest,
  hideHeader,
}: {
  date: string;
  isPast: boolean;
  booked: PublicBookingLite[];
  openSlots: BookingSlot[];
  onRequest: () => void;
  hideHeader?: boolean;
}) {
  return (
    <>
      {!hideHeader && (
        <>
          <h3 className="text-base font-extrabold text-navy-800">
            {formatLongDate(date)}
          </h3>
          <p className="mb-4 text-xs text-navy-400">
            {isPast ? "This date has passed." : "Availability"}
          </p>
        </>
      )}

      <div className="rounded-lg border border-sky-border bg-sky-bg/60 p-3">
        <span className="text-sm font-bold text-navy-700">Whole Resort</span>

        {booked.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {booked.map((b, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-xs"
              >
                <span className="font-semibold text-navy-700">
                  {SLOT_LABELS[b.slot]}
                  <span className="ml-1 font-normal text-navy-400">
                    {blockTime(b)}
                  </span>
                </span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    b.status === "CONFIRMED"
                      ? "bg-navy-100 text-navy-600"
                      : "bg-amber-100 text-amber-700",
                  ].join(" ")}
                >
                  {b.status === "CONFIRMED" ? "Booked" : "On hold"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {openSlots.length > 0 ? (
            openSlots.map((s) => (
              <span
                key={s}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
              >
                {SLOT_LABELS[s]} open
              </span>
            ))
          ) : (
            <span className="text-xs text-navy-400">Fully booked.</span>
          )}
        </div>

        {!isPast && openSlots.length > 0 && (
          <button
            onClick={onRequest}
            className="mt-3 w-full rounded-lg bg-navy-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-navy-800"
          >
            Request the Resort
          </button>
        )}
      </div>
    </>
  );
}

// --- Main public view -----------------------------------------------------

export function PublicBooking({
  year,
  month0,
  cells,
  bookings,
  today,
}: {
  year: number;
  month0: number;
  cells: MonthCell[];
  bookings: PublicBookingLite[];
  today: string;
}) {
  const router = useRouter();

  const firstInMonth = cells.find((c) => c.inMonth)!.key;
  const todayInMonth = cells.some((c) => c.inMonth && c.key === today);
  const defaultSelected = todayInMonth ? today : firstInMonth;

  const [selected, setSelected] = useState(defaultSelected);
  const [formOpen, setFormOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Reset the selected day when the visible month changes (render-time pattern).
  const ymKey = `${year}-${month0}`;
  const [prevYmKey, setPrevYmKey] = useState(ymKey);
  if (ymKey !== prevYmKey) {
    setPrevYmKey(ymKey);
    setSelected(defaultSelected);
  }

  const occupancy = useMemo<Occupancy[]>(
    () =>
      bookings.map((b) => ({
        date: b.date,
        endDate: b.endDate,
        slot: b.slot,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    [bookings]
  );

  const coverByDate = useMemo(() => {
    const map = new Map<string, PublicBookingLite[]>();
    for (const cell of cells) {
      const list = bookings.filter((b) => coversDate(b, cell.key));
      if (list.length) map.set(cell.key, list);
    }
    return map;
  }, [bookings, cells]);

  const isPast = selected < today;
  const selectedBooked = coverByDate.get(selected) ?? [];
  const selectedOpenSlots = availableSlotsOn(selected, occupancy);
  const canRequestSelected = !isPast && selectedOpenSlots.length > 0;

  function goMonth(delta: number) {
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    router.push(`/book?ym=${key}`);
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

  // Single tap selects. A second tap on the same cell within DOUBLE_TAP_MS
  // opens the detail sheet. The sheet is `lg:hidden`, so on desktop this is
  // a harmless no-op and the side panel (always visible there) stays put.
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-sky-border bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Brandmark className="h-11 w-11 shrink-0" />
          <div className="leading-tight">
            <p className="text-lg font-extrabold tracking-tight text-navy-800">
              Fabian&apos;s Azzure
            </p>
            <p className="text-xs font-medium text-sunset-500">
              Private Resort · Check availability
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-navy-800">
            Find an open date
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Tap a date to see what&apos;s open, then send a request. We&apos;ll
            reach out to confirm your reservation and the exact time.
          </p>
        </div>

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
                    onClick={() => router.push("/book")}
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

              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-navy-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-sky-border bg-white" />
                  Open
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-sunset-100 ring-1 ring-sunset-300" />
                  Some slots left
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-navy-100 ring-1 ring-navy-300" />
                  Fully booked
                </span>
              </div>

              <div
                className="grid grid-cols-7 gap-1 touch-pan-y sm:gap-1.5 md:gap-2"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
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
                  const avail = availabilityOn(cell.key, occupancy);
                  const past = cell.key < today;
                  const isSelected = cell.key === selected;
                  const isToday = cell.key === today;

                  const tint =
                    avail === "full"
                      ? "bg-navy-100"
                      : avail === "partial"
                        ? "bg-sunset-50"
                        : "bg-white";

                  return (
                    <button
                      key={cell.key}
                      onClick={() => handleCellActivate(cell.key)}
                      className={[
                        "flex min-h-18 flex-col rounded-lg border p-1.5 text-left transition sm:min-h-22 sm:p-2 md:min-h-26 lg:min-h-30",
                        tint,
                        isSelected
                          ? "border-navy-500 ring-2 ring-navy-300"
                          : "border-sky-border hover:border-navy-300",
                        cell.inMonth ? "" : "opacity-40",
                        past ? "opacity-50" : "",
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
                        {dayBookings.map((b, i) => (
                          <span
                            key={i}
                            className="truncate rounded bg-navy-200 px-1 py-0.5 text-[10px] font-semibold leading-tight text-navy-700 sm:text-[11px]"
                          >
                            {SLOT_SHORT[b.slot]}
                          </span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Selected-date panel — desktop only; mobile uses the double-tap sheet */}
          <section className="hidden lg:block">
            <div className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5 md:p-6">
              <SelectedDatePanel
                date={selected}
                isPast={isPast}
                booked={selectedBooked}
                openSlots={selectedOpenSlots}
                onRequest={() => setFormOpen(true)}
              />
            </div>
          </section>
        </div>
      </main>

      {/* Floating action button — quick request, always reachable */}
      <button
        onClick={() => setFormOpen(true)}
        disabled={!canRequestSelected}
        aria-label="Request a booking"
        title={
          canRequestSelected
            ? "Request a booking"
            : "Select an open date to request a booking"
        }
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-sunset-400 text-3xl font-bold leading-none text-navy-900 shadow-lg shadow-navy-900/25 transition hover:bg-sunset-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
              isPast={isPast}
              booked={selectedBooked}
              openSlots={selectedOpenSlots}
              onRequest={() => {
                setSheetOpen(false);
                setFormOpen(true);
              }}
              hideHeader
            />
          </div>
        </div>
      )}

      {/* Request modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-navy-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false);
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-card border border-sky-border bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-navy-800">
                  Request a booking
                </h3>
                <button
                  onClick={() => setFormOpen(false)}
                  className="text-navy-400 hover:text-navy-700"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <RequestForm
                initialDate={selected}
                occupancy={occupancy}
                onDone={() => {
                  setFormOpen(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
