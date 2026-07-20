"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ResourceType } from "@prisma/client";
import { createBooking, type BookingActionState } from "@/app/actions/bookings";
import {
  RESOURCE_LABELS,
  RESOURCE_TYPES,
  SLOT_LABELS,
  availableSlots,
} from "@/lib/booking";
import { formatLongDate } from "@/lib/dates";
import type { BookingLite } from "./CalendarBoard";

const inputClass =
  "rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200";

export function BookingForm({
  date,
  bookingsForDate,
  defaultResource,
  onSuccess,
  onCancel,
}: {
  date: string;
  bookingsForDate: BookingLite[];
  defaultResource: ResourceType;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [resource, setResource] = useState<ResourceType>(defaultResource);
  const [state, formAction, pending] = useActionState<
    BookingActionState,
    FormData
  >(createBooking, undefined);

  const openSlots = useMemo(() => {
    const taken = bookingsForDate
      .filter((b) => b.resource === resource)
      .map((b) => b.slot);
    return availableSlots(taken);
  }, [bookingsForDate, resource]);

  useEffect(() => {
    if (state?.ok) onSuccess();
  }, [state, onSuccess]);

  const noSlots = openSlots.length === 0;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="date" value={date} />

      <div className="rounded-lg bg-sky-panel/60 px-3 py-2 text-sm font-medium text-navy-700">
        Reserving for <span className="font-bold">{formatLongDate(date)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-navy-700">What</span>
          <select
            name="resource"
            value={resource}
            onChange={(e) => setResource(e.target.value as ResourceType)}
            className={inputClass}
          >
            {RESOURCE_TYPES.map((r) => (
              <option key={r} value={r}>
                {RESOURCE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-navy-700">Booking type</span>
          <select name="slot" className={inputClass} disabled={noSlots} required>
            {openSlots.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {noSlots ? (
        <p className="rounded-lg bg-navy-100 px-3 py-2 text-sm font-medium text-navy-700">
          {RESOURCE_LABELS[resource]} is fully booked on this date.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-700">
              Guest name <span className="text-red-500">*</span>
            </span>
            <input name="guestName" required className={inputClass} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-navy-700">
                Contact number
              </span>
              <input name="guestPhone" inputMode="tel" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-navy-700">
                No. of guests
              </span>
              <input name="pax" inputMode="numeric" className={inputClass} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-700">Email</span>
            <input name="guestEmail" type="email" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-700">Status</span>
            <select name="status" className={inputClass} defaultValue="CONFIRMED">
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending / tentative</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-navy-700">Notes</span>
            <textarea name="notes" rows={2} className={inputClass} />
          </label>
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
          onClick={onCancel}
          className="rounded-lg border border-sky-border bg-white px-4 py-2 text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || noSlots}
          className="rounded-lg bg-sunset-400 px-4 py-2 text-sm font-bold text-navy-900 shadow-sm transition hover:bg-sunset-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Reserve"}
        </button>
      </div>
    </form>
  );
}
