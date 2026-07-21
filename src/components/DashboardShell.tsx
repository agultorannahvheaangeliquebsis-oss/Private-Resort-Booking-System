"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brandmark } from "@/components/Brandmark";
import { PushToggle } from "@/components/PushToggle";

type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean };

// Small inline icons keep the sidebar self-contained (no icon dependency).
const icons = {
  dashboard: (
    <path d="M3 3h7v7H3V3zm11 0h7v4h-7V3zM3 14h7v7H3v-7zm11-3h7v10h-7V11z" />
  ),
  calendar: (
    <path d="M7 2v3M17 2v3M3.5 8.5h17M4 5h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
  ),
  users: (
    <path d="M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm11 9v-1a4 4 0 00-3-3.87M16 4.13A4 4 0 0116 12" />
  ),
};

function Icon({ path }: { path: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      {path}
    </svg>
  );
}

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <Icon path={icons.dashboard} />, exact: true },
  { href: "/dashboard/calendar", label: "Calendar", icon: <Icon path={icons.calendar} /> },
];

const adminNav: NavItem[] = [
  { href: "/dashboard/users", label: "User management", icon: <Icon path={icons.users} /> },
];

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-navy-700 text-white shadow-sm"
          : "text-navy-600 hover:bg-sky-panel hover:text-navy-800",
      ].join(" ")}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export function DashboardShell({
  isAdmin,
  userName,
  signOut,
  children,
}: {
  isAdmin: boolean;
  userName?: string | null;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const close = () => setMobileOpen(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/dashboard"
          onClick={close}
          className="flex min-w-0 items-center gap-3"
        >
          <Brandmark className="h-10 w-10 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-extrabold tracking-tight text-navy-800">
              Fabian&apos;s Azzure
            </p>
            <p className="text-xs font-medium text-sunset-500">
              Booking Dashboard
            </p>
          </div>
        </Link>
        <PushToggle />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {mainNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item)}
            onNavigate={close}
          />
        ))}

        {isAdmin && (
          <>
            <p className="mt-4 px-3 text-[11px] font-bold uppercase tracking-wider text-navy-400">
              Administration
            </p>
            {adminNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item)}
                onNavigate={close}
              />
            ))}
          </>
        )}
      </nav>

      <div className="flex flex-col gap-3 border-t border-sky-border pt-4">
        {userName && (
          <p className="px-1 text-sm font-medium text-navy-500">{userName}</p>
        )}
        <Link
          href="/book"
          target="_blank"
          onClick={close}
          className="rounded-lg border border-sky-border bg-white px-3 py-1.5 text-center text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
        >
          Guest page ↗
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg border border-sky-border bg-white px-3 py-1.5 text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sky-border bg-white/85 backdrop-blur lg:block">
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-sky-border bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Brandmark className="h-9 w-9 shrink-0" />
          <p className="text-sm font-extrabold tracking-tight text-navy-800">
            Fabian&apos;s Azzure
          </p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-lg border border-sky-border bg-white p-2 text-navy-700 transition hover:bg-sky-panel"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm"
            onClick={close}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto border-r border-sky-border bg-white shadow-2xl">
            <div className="flex justify-end p-3 pb-0">
              <button
                onClick={close}
                aria-label="Close menu"
                className="rounded-lg p-2 text-navy-500 hover:text-navy-800"
              >
                ✕
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
