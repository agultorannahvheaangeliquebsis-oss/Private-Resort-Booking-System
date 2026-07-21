"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createBooking, type BookingActionState } from "@/app/actions/bookings";
import {
  SLOT_LABELS,
  availableSlotsOn,
  slotWindowLabel,
  type Occupancy,
} from "@/lib/booking";
import { formatShortDate, nightsBetween } from "@/lib/dates";

const inputClass =
  "rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200";

export function BookingForm({
  date,
  occupancy,
  onSuccess,
  onCancel,
}: {
  date: string;
  occupancy: Occupancy[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [checkIn, setCheckIn] = useState(date);
  const [checkOut, setCheckOut] = useState(date);
  const [state, formAction, pending] = useActionState<
    BookingActionState,
    FormData
  >(createBooking, undefined);

  const nights = nightsBetween(checkIn, checkOut);
  const isMultiDay = nights >= 1;

  // Slots still open on the check-in date (single-day hint). Multi-day stays
  // are always overnight, so the picker is hidden then.
  const openSlots = useMemo(
    () => availableSlotsOn(checkIn, occupancy),
    [occupancy, checkIn]
  );

  useEffect(() => {
    if (state?.ok) onSuccess();
  }, [state, onSuccess]);

  // Keep check-out at or after check-in.
  function onCheckInChange(value: string) {
    setCheckIn(value);
    if (checkOut < value) setCheckOut(value);
  }

  const noSlots = !isMultiDay && openSlots.length === 0;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="date" value={checkIn} />
      <input type="hidden" name="endDate" value={checkOut} />
      {isMultiDay && <input type="hidden" name="slot" value="OVERNIGHT" />}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-navy-700">Check-in</span>
          <input
            type="date"
            value={checkIn}
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
          {nights}-night overnight stay ·{" "}
          {formatShortDate(checkIn)} → {formatShortDate(checkOut)}
        </p>
      )}

      {!isMultiDay && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-navy-700">
            Booking type
          </span>
          <select
            name="slot"
            className={inputClass}
            disabled={noSlots}
            required
          >
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
          The resort is fully booked on this date.
        </p>
      ) : (
        <>
          <label className="flex items-start gap-2 rounded-lg border border-sky-border bg-sky-panel/40 px-3 py-2.5">
            <input
              type="checkbox"
              name="functionHallAircon"
              className="mt-0.5 h-4 w-4 rounded border-sky-border text-navy-700 focus:ring-navy-300"
            />
            <span className="text-xs text-navy-700">
              <span className="font-semibold">
                Function hall with air-conditioning
              </span>
              <br />
              <span className="text-navy-500">Additional charges apply.</span>
            </span>
          </label>

          {/* Owner may set the exact times now (optional). */}
          <fieldset className="rounded-lg border border-sky-border p-3">
            <legend className="px-1 text-xs font-semibold text-navy-600">
              Exact time (optional)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-navy-500">
                  Check-in time
                </span>
                <input type="time" name="startTime" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-navy-500">
                  Check-out time
                </span>
                <input type="time" name="endTime" className={inputClass} />
              </label>
            </div>
            {!isMultiDay && openSlots.length > 0 && (
              <p className="mt-2 text-[11px] text-navy-400">
                Default if left blank: {slotWindowLabel(openSlots[0])}
              </p>
            )}
          </fieldset>

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
