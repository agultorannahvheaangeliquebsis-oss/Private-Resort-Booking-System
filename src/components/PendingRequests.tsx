"use client";

import { useRouter } from "next/navigation";
import { SLOT_LABELS } from "@/lib/booking";
import {
  formatLongDate,
  formatShortDate,
  nightsBetween,
} from "@/lib/dates";
import { ConfirmControl } from "./ConfirmControl";
import type { BookingLite } from "./CalendarBoard";

const RESOURCE_SHORT: Record<BookingLite["resource"], string> = {
  RESORT: "Whole Resort",
  FUNCTION_HALL: "Function Hall",
};

function dateRange(b: BookingLite): string {
  if (b.date === b.endDate) return formatLongDate(b.date);
  const nights = nightsBetween(b.date, b.endDate);
  return `${formatShortDate(b.date)} → ${formatShortDate(b.endDate)} · ${nights} night${nights > 1 ? "s" : ""}`;
}

export function PendingRequests({ requests }: { requests: BookingLite[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (requests.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-sky-border bg-sky-bg/50 px-4 py-8 text-center text-sm text-navy-400">
        No pending requests. You&apos;re all caught up. 🎉
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((b) => (
        <li
          key={b.id}
          className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-navy-800">
                {b.guestName}
                {b.source === "GUEST" && (
                  <span className="ml-1.5 rounded bg-sky-panel px-1 text-[9px] font-bold uppercase text-navy-500">
                    Guest
                  </span>
                )}
              </p>
              <p className="text-xs font-medium text-navy-600">
                {RESOURCE_SHORT[b.resource]} · {SLOT_LABELS[b.slot]}
                {b.pax ? ` · ${b.pax} pax` : ""}
              </p>
              <p className="text-xs text-navy-500">{dateRange(b)}</p>
              {b.guestPhone && (
                <p className="text-xs text-navy-400">{b.guestPhone}</p>
              )}
              {b.notes && (
                <p className="mt-1 text-xs italic text-navy-400">{b.notes}</p>
              )}
            </div>
          </div>
          <ConfirmControl booking={b} onDone={refresh} />
        </li>
      ))}
    </ul>
  );
}
