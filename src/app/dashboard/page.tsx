import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SLOT_LABELS } from "@/lib/booking";
import {
  addDaysKey,
  dateKeyToUTC,
  formatLongDate,
  formatShortDate,
  nightsBetween,
  toDateKey,
  todayKey,
} from "@/lib/dates";
import { PendingRequests } from "@/components/PendingRequests";
import { StatusBadge } from "@/components/ConfirmControl";
import type { BookingLite } from "@/components/CalendarBoard";

// How far ahead the "next days" overview looks.
const HORIZON_DAYS = 7;

function toLite(r: {
  id: string;
  slot: BookingLite["slot"];
  status: BookingLite["status"];
  source: BookingLite["source"];
  date: Date;
  endDate: Date;
  startTime: string | null;
  endTime: string | null;
  functionHallAircon: boolean;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  pax: number | null;
  notes: string | null;
}): BookingLite {
  return {
    id: r.id,
    slot: r.slot,
    status: r.status,
    source: r.source,
    date: toDateKey(r.date),
    endDate: toDateKey(r.endDate),
    startTime: r.startTime,
    endTime: r.endTime,
    functionHallAircon: r.functionHallAircon,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    guestEmail: r.guestEmail,
    pax: r.pax,
    notes: r.notes,
  };
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "amber" | "navy" | "emerald";
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50",
    navy: "border-sky-border bg-sky-panel/60",
    emerald: "border-emerald-200 bg-emerald-50",
  } as const;
  const valueTone = {
    amber: "text-amber-700",
    navy: "text-navy-700",
    emerald: "text-emerald-700",
  } as const;
  return (
    <div className={`rounded-card border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-extrabold ${valueTone[tone]}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-navy-400">{hint}</p>
    </div>
  );
}

export default async function DashboardOverview() {
  const today = todayKey();
  const horizonEnd = addDaysKey(today, HORIZON_DAYS);

  const [pendingRows, upcomingConfirmed, confirmedNextDays, upcomingTotal] =
    await Promise.all([
      // All still-relevant pending requests (not yet past), soonest first.
      prisma.booking.findMany({
        where: { status: "PENDING", endDate: { gte: dateKeyToUTC(today) } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      // Confirmed stays that haven't ended yet, soonest first (list, capped).
      prisma.booking.findMany({
        where: { status: "CONFIRMED", endDate: { gte: dateKeyToUTC(today) } },
        orderBy: [{ date: "asc" }, { slot: "asc" }],
        take: 8,
      }),
      // Confirmed bookings overlapping the next-days window (for the counter).
      prisma.booking.count({
        where: {
          status: "CONFIRMED",
          date: { lte: dateKeyToUTC(horizonEnd) },
          endDate: { gte: dateKeyToUTC(today) },
        },
      }),
      // Every confirmed stay still ahead (for the counter).
      prisma.booking.count({
        where: { status: "CONFIRMED", endDate: { gte: dateKeyToUTC(today) } },
      }),
    ]);

  const pending = pendingRows.map(toLite);
  const upcoming = upcomingConfirmed.map(toLite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-800">
          Dashboard
        </h1>
        <p className="text-sm text-navy-500">
          A quick look at what needs attention and what&apos;s coming up.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Pending requests"
          value={pending.length}
          hint="Awaiting your confirmation"
          tone="amber"
        />
        <StatTile
          label={`Confirmed · next ${HORIZON_DAYS} days`}
          value={confirmedNextDays}
          hint={`${formatShortDate(today)} – ${formatShortDate(horizonEnd)}`}
          tone="emerald"
        />
        <StatTile
          label="Upcoming confirmed"
          value={upcomingTotal}
          hint="Total stays still ahead"
          tone="navy"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending requests */}
        <section className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-navy-800">
              Pending requests
            </h2>
            {pending.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                {pending.length}
              </span>
            )}
          </div>
          <PendingRequests requests={pending} />
        </section>

        {/* Upcoming confirmed */}
        <section className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-navy-800">
              Upcoming confirmed
            </h2>
            <Link
              href="/dashboard/calendar"
              className="text-xs font-semibold text-navy-600 hover:underline"
            >
              View calendar →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-dashed border-sky-border bg-sky-bg/50 px-4 py-8 text-center text-sm text-navy-400">
              No upcoming confirmed bookings.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((b) => {
                const range =
                  b.date === b.endDate
                    ? formatLongDate(b.date)
                    : `${formatShortDate(b.date)} → ${formatShortDate(b.endDate)} · ${nightsBetween(b.date, b.endDate)} night${nightsBetween(b.date, b.endDate) > 1 ? "s" : ""}`;
                return (
                  <li
                    key={b.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-sky-border bg-white p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-800">
                        {b.guestName}
                      </p>
                      <p className="text-xs font-medium text-navy-600">
                        {SLOT_LABELS[b.slot]}
                        {b.pax ? ` · ${b.pax} pax` : ""}
                        {b.functionHallAircon ? " · Hall + aircon" : ""}
                      </p>
                      <p className="text-xs text-navy-400">{range}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
