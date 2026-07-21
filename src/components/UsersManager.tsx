"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Role } from "@prisma/client";
import {
  createUser,
  deleteUser,
  setUserRole,
  type UserActionState,
} from "@/app/actions/users";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  bookingCount: number;
};

function RoleBadge({ role }: { role: Role }) {
  const styles =
    role === "ADMIN"
      ? "bg-navy-700 text-white"
      : "bg-sky-panel text-navy-600";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles}`}
    >
      {role === "ADMIN" ? "Admin" : "Guest"}
    </span>
  );
}

/** A role dropdown that saves as soon as it changes. */
function RoleSelect({
  user,
  disabled,
}: {
  user: UserRow;
  disabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setUserRole}>
      <input type="hidden" name="id" value={user.id} />
      <select
        name="role"
        defaultValue={user.role}
        disabled={disabled}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-sky-border bg-white px-2 py-1 text-xs font-semibold text-navy-700 outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-200 disabled:cursor-not-allowed disabled:opacity-50"
        title={disabled ? "You can't change your own role" : "Change role"}
      >
        <option value="GUEST">Guest</option>
        <option value="ADMIN">Admin</option>
      </select>
    </form>
  );
}

/** Confirms a deletion by re-authenticating the admin's password. */
function DeleteDialog({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    deleteUser,
    undefined
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-card border border-sky-border bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-extrabold text-navy-800">Delete user</h3>
        <p className="mt-1 text-sm text-navy-500">
          You&apos;re about to delete{" "}
          <span className="font-semibold text-navy-800">{user.name}</span>&apos;s
          account. This can&apos;t be undone. Enter your admin password to
          confirm.
        </p>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={user.id} />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-navy-700">
              Your password
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              className="rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200"
              placeholder="••••••••"
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
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-navy-500 hover:text-navy-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Delete user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddUserForm() {
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    createUser,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-navy-700">Name</span>
        <input
          name="name"
          required
          className="rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200"
          placeholder="Jane Dela Cruz"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-navy-700">Email</span>
        <input
          name="email"
          type="email"
          required
          className="rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200"
          placeholder="staff@fabiansazzure.com"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-navy-700">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200"
          placeholder="At least 8 characters"
        />
      </label>
      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy-700">Role</span>
          <select
            name="role"
            defaultValue="GUEST"
            className="rounded-lg border border-sky-border bg-white px-3 py-2 text-sm text-navy-800 outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-200"
          >
            <option value="GUEST">Guest</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
      </div>

      <div className="sm:col-span-2 lg:col-span-4">
        {state && !state.ok && (
          <p
            role="alert"
            className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 focus:ring-2 focus:ring-navy-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add user"}
        </button>
      </div>
    </form>
  );
}

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-navy-800">Add a user</h2>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-sky-border bg-white px-3 py-1.5 text-sm font-semibold text-navy-700 transition hover:bg-sky-panel"
          >
            {open ? "Close" : "+ New user"}
          </button>
        </div>
        {open ? (
          <AddUserForm />
        ) : (
          <p className="text-sm text-navy-400">
            Create staff or administrator accounts for the booking dashboard.
          </p>
        )}
      </section>

      <section className="rounded-card border border-sky-border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
        <h2 className="mb-3 text-lg font-extrabold text-navy-800">
          Users ({users.length})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-sky-border text-xs uppercase tracking-wide text-navy-400">
                <th className="px-2 py-2 font-semibold">User</th>
                <th className="px-2 py-2 font-semibold">Role</th>
                <th className="px-2 py-2 font-semibold">Bookings</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-sky-border/60 last:border-0"
                  >
                    <td className="px-2 py-3">
                      <p className="font-semibold text-navy-800">
                        {u.name}
                        {isSelf && (
                          <span className="ml-1.5 text-[10px] font-bold uppercase text-navy-400">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-navy-500">{u.email}</p>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <RoleBadge role={u.role} />
                        <RoleSelect user={u} disabled={isSelf} />
                      </div>
                    </td>
                    <td className="px-2 py-3 text-navy-600">{u.bookingCount}</td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(u)}
                        disabled={isSelf}
                        className="text-xs font-semibold text-red-600 transition hover:underline disabled:cursor-not-allowed disabled:text-navy-300 disabled:no-underline"
                        title={
                          isSelf
                            ? "You can't delete your own account"
                            : "Delete user"
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {deleteTarget && (
        <DeleteDialog
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
