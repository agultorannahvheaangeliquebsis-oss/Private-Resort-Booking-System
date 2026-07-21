"use client";

import { useActionState, useEffect, useState } from "react";
import type { BookingStatus } from "@prisma/client";
import {
  confirmBooking,
  declineBooking,
  type BookingActionState,
} from "@/app/actions/bookings";

/** The minimal booking shape the confirm/decline controls need. */
type PendingBooking = {
  id: string;
  guestName: string;
  startTime: string | null;
  endTime: string | null;
};

export function StatusBadge({ status }: { status: BookingStatus }) {
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

/** Inline confirm control that also lets the owner set the exact times. */
export function ConfirmControl({
  booking,
  onDone,
}: {
  booking: PendingBooking;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BookingActionState, FormData>(
    confirmBooking,
    undefined
  );

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  if (!open) {
    return (
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700"
        >
          Confirm…
        </button>
        <form action={declineBooking}>
          <input type="hidden" name="id" value={booking.id} />
          <button
            type="submit"
            onClick={(e) => {
              if (!window.confirm(`Decline ${booking.guestName}'s request?`))
                e.preventDefault();
            }}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Decline
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="mt-2 rounded-lg bg-emerald-50 p-2.5">
      <input type="hidden" name="id" value={booking.id} />
      <p className="mb-2 text-[11px] font-semibold text-emerald-800">
        Set the exact time, then confirm.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-emerald-700">
            Check-in time
          </span>
          <input
            type="time"
            name="startTime"
            defaultValue={booking.startTime ?? ""}
            className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-sm text-navy-800"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-emerald-700">
            Check-out time
          </span>
          <input
            type="time"
            name="endTime"
            defaultValue={booking.endTime ?? ""}
            className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-sm text-navy-800"
          />
        </label>
      </div>
      {state && !state.ok && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
          {state.error}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2.5 py-1 text-xs font-semibold text-navy-500 hover:text-navy-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Confirming…" : "Confirm booking"}
        </button>
      </div>
    </form>
  );
}
