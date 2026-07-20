"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BookingSlot,
  BookingStatus,
  ResourceType,
} from "@prisma/client";
import { cancelBooking } from "@/app/actions/bookings";
import {
  RESOURCE_LABELS,
  RESOURCE_TYPES,
  SLOT_LABELS,
  availabilityFor,
} from "@/lib/booking";
import {
  formatLongDate,
  monthLabel,
  type MonthCell,
} from "@/lib/dates";
import { BookingForm } from "./BookingForm";

export type BookingLite = {
  id: string;
  resource: ResourceType;
  slot: BookingSlot;
  status: BookingStatus;
  date: string;
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

function StatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    CONFIRMED: "bg-emerald-100 text-emerald-800",
    PENDING: "bg-amber-100 text-amber-800",
    CANCELLED: "bg-gray-100 text-gray-500",
  };
  const labels: Record<BookingStatus, string> = {
    CONFIRMED: "Confirmed",
    PENDING: "Pending",
    CANCELLED: "Cancelled",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
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
  const [modal, setModal] = useState<null | { resource: ResourceType }>(null);

  // Reset selection when the visible month changes.
  useEffect(() => {
    setSelected(defaultSelected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month0]);

  const byDate = useMemo(() => {
    const map = new Map<string, BookingLite[]>();
    for (const b of bookings) {
      const list = map.get(b.date);
      if (list) list.push(b);
      else map.set(b.date, [b]);
    }
    return map;
  }, [bookings]);

  const selectedBookings = byDate.get(selected) ?? [];

  function goMonth(delta: number) {
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    router.push(`/dashboard?ym=${key}`);
  }

  function closeModalAndRefresh() {
    setModal(null);
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
                onClick={() => router.push("/dashboard")}
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
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-navy-600 px-1 text-[10px] font-bold text-white">
                Resort
              </span>
              <span className="rounded bg-sunset-400 px-1 text-[10px] font-bold text-navy-900">
                Hall
              </span>
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-navy-400"
              >
                {w}
              </div>
            ))}

            {cells.map((cell) => {
              const dayBookings = byDate.get(cell.key) ?? [];
              const resortSlots = dayBookings
                .filter((b) => b.resource === "RESORT")
                .map((b) => b.slot);
              const hallSlots = dayBookings
                .filter((b) => b.resource === "FUNCTION_HALL")
                .map((b) => b.slot);
              const resortAvail = availabilityFor(resortSlots);

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
                    {resortSlots.map((s, i) => (
                      <span
                        key={`r-${i}`}
                        className="truncate rounded bg-navy-600 px-1 text-[10px] font-semibold leading-tight text-white"
                      >
                        {SLOT_SHORT[s]}
                      </span>
                    ))}
                    {hallSlots.map((s, i) => (
                      <span
                        key={`h-${i}`}
                        className="truncate rounded bg-sunset-400 px-1 text-[10px] font-semibold leading-tight text-navy-900"
                      >
                        Hall · {SLOT_SHORT[s]}
                      </span>
                    ))}
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

          <div className="flex flex-col gap-4">
            {RESOURCE_TYPES.map((resource) => {
              const list = selectedBookings.filter(
                (b) => b.resource === resource
              );
              const avail = availabilityFor(list.map((b) => b.slot));
              return (
                <div
                  key={resource}
                  className="rounded-lg border border-sky-border bg-sky-bg/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-navy-700">
                      {RESOURCE_LABELS[resource]}
                    </span>
                    <button
                      onClick={() => setModal({ resource })}
                      disabled={avail === "full"}
                      className="rounded-lg bg-navy-700 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      + Add
                    </button>
                  </div>

                  {list.length === 0 ? (
                    <p className="text-xs text-navy-400">Available.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {list.map((b) => (
                        <li
                          key={b.id}
                          className="rounded-lg border border-sky-border bg-white p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-navy-800">
                                {b.guestName}
                              </p>
                              <p className="text-xs text-navy-500">
                                {SLOT_LABELS[b.slot]}
                                {b.pax ? ` · ${b.pax} pax` : ""}
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
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Booking modal */}
      {modal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-card border border-sky-border bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-navy-800">
                New reservation
              </h3>
              <button
                onClick={() => setModal(null)}
                className="text-navy-400 hover:text-navy-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <BookingForm
              date={selected}
              bookingsForDate={selectedBookings}
              defaultResource={modal.resource}
              onSuccess={closeModalAndRefresh}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
