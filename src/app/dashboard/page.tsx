import { prisma } from "@/lib/prisma";
import { buildMonthGrid, dateKeyToUTC, toDateKey, todayKey } from "@/lib/dates";
import { CalendarBoard, type BookingLite } from "@/components/CalendarBoard";

function resolveMonth(ym: string | undefined): { year: number; month0: number } {
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month0: m - 1 };
  }
  const [ty, tm] = todayKey().split("-").map(Number);
  return { year: ty, month0: tm - 1 };
}

export default async function DashboardPage({
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
      date: {
        gte: dateKeyToUTC(gridStart),
        lte: dateKeyToUTC(gridEnd),
      },
      status: { not: "CANCELLED" },
    },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });

  const bookings: BookingLite[] = rows.map((r) => ({
    id: r.id,
    resource: r.resource,
    slot: r.slot,
    status: r.status,
    date: toDateKey(r.date),
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    guestEmail: r.guestEmail,
    pax: r.pax,
    notes: r.notes,
  }));

  return (
    <CalendarBoard
      year={year}
      month0={month0}
      cells={cells}
      bookings={bookings}
      today={todayKey()}
    />
  );
}
