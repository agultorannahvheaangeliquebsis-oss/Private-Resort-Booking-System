import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { buildMonthGrid, dateKeyToUTC, toDateKey, todayKey } from "@/lib/dates";
import { PublicBooking, type PublicBookingLite } from "@/components/PublicBooking";

export const metadata: Metadata = {
  title: "Fabian's Azzure — Check Availability & Request a Booking",
  description:
    "See open dates for Fabian's Azzure Private Resort and send a booking request. The owner confirms every reservation.",
};

function resolveMonth(ym: string | undefined): { year: number; month0: number } {
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month0: m - 1 };
  }
  const [ty, tm] = todayKey().split("-").map(Number);
  return { year: ty, month0: tm - 1 };
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const { ym } = await searchParams;
  const { year, month0 } = resolveMonth(ym);

  const cells = buildMonthGrid(year, month0);
  const gridStart = cells[0].key;
  const gridEnd = cells[cells.length - 1].key;

  const rows = await prisma.booking.findMany({
    where: {
      date: { lte: dateKeyToUTC(gridEnd) },
      endDate: { gte: dateKeyToUTC(gridStart) },
      status: { not: "CANCELLED" },
    },
    // Public data only — no guest names, contacts, or notes leave the server.
    select: {
      resource: true,
      slot: true,
      status: true,
      date: true,
      endDate: true,
      startTime: true,
      endTime: true,
    },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });

  const bookings: PublicBookingLite[] = rows.map((r) => ({
    resource: r.resource,
    slot: r.slot,
    status: r.status,
    date: toDateKey(r.date),
    endDate: toDateKey(r.endDate),
    startTime: r.startTime,
    endTime: r.endTime,
  }));

  return (
    <PublicBooking
      year={year}
      month0={month0}
      cells={cells}
      bookings={bookings}
      today={todayKey()}
    />
  );
}
