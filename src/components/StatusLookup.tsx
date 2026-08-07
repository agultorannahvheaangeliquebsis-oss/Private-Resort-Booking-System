"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { lookupBooking, type StatusLookupState } from "@/app/actions/status";
import { SLOT_LABELS, slotWindowLabel } from "@/lib/booking";
import { formatLongDate, formatShortDate, formatTime, nightsBetween } from "@/lib/dates";
import { StatusBadge } from "./ConfirmControl";
import { Brandmark } from "./Brandmark";

const inputClass =
  "rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200";

const STATUS_COPY: Record<BookingStatus, string> = {
  PENDING: "Still awaiting the owner's confirmation.",
  CONFIRMED: "Confirmed — see you then!",
  CANCELLED: "This request was declined or cancelled.",
};

export function StatusLookup() {
  const [state, action, pending] = useActionState<StatusLookupState, FormData>(
    lookupBooking,
    undefined
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-sky-border bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <Brandmark className="h-11 w-11 shrink-0" />
          <div className="leading-tight">
            <p className="text-lg font-extrabold tracking-tight text-navy-800">
              Fabian&apos;s Azzure
            </p>
            <p className="text-xs font-medium text-sunset-500">
              Check your reservation status
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-card border border-sky-border bg-white/80 p-5 shadow-sm backdrop-blur">
          <h1 className="text-lg font-extrabold text-navy-800">
            Look up a request
          </h1>
          <p className="mt-1 mb-4 text-sm text-navy-500">
            Enter the reference code from your request and the contact number
            you gave us.
          </p>

          <form action={action} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-navy-700">
                Reference code
              </span>
              <input
                name="reference"
                autoCapitalize="characters"
                placeholder="e.g. K7XM3PQ"
                required
                className={`${inputClass} font-mono uppercase tracking-wide`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-navy-700">
                Contact number
              </span>
              <input
                name="phone"
                inputMode="tel"
                required
                className={inputClass}
              />
            </label>

            {state && !state.ok && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Looking up…" : "Check status"}
            </button>
          </form>

          {state?.ok && (
            <div className="mt-5 rounded-lg border border-sky-border bg-sky-bg/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-navy-800">
                    {state.result.guestName}
                  </p>
                  <p className="font-mono text-[11px] text-navy-400">
                    {state.result.reference}
                  </p>
                </div>
                <StatusBadge status={state.result.status} />
              </div>

              <p className="mt-3 text-sm font-semibold text-navy-700">
                {SLOT_LABELS[state.result.slot]}
                {state.result.pax ? ` · ${state.result.pax} pax` : ""}
                {state.result.functionHallAircon ? " · Hall + aircon" : ""}
              </p>
              <p className="text-sm text-navy-500">
                {state.result.date === state.result.endDate
                  ? formatLongDate(state.result.date)
                  : `${formatShortDate(state.result.date)} → ${formatShortDate(state.result.endDate)} · ${nightsBetween(state.result.date, state.result.endDate)} night${nightsBetween(state.result.date, state.result.endDate) > 1 ? "s" : ""}`}
              </p>
              <p className="text-sm text-navy-500">
                {formatTime(state.result.startTime) && formatTime(state.result.endTime)
                  ? `${formatTime(state.result.startTime)} – ${formatTime(state.result.endTime)}`
                  : slotWindowLabel(state.result.slot)}
              </p>

              <p className="mt-3 text-sm font-medium text-navy-700">
                {STATUS_COPY[state.result.status]}
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-navy-400">
          <Link href="/book" className="font-semibold text-navy-600 hover:underline">
            ← Back to availability calendar
          </Link>
        </p>
      </main>
    </div>
  );
}
