"use server";

import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type UserActionState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined;

const ROLES: Role[] = ["GUEST", "ADMIN"];

/** Create a staff/admin account from the user-management panel. */
export async function createUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Only administrators can add users." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "GUEST") as Role;
  const role: Role = ROLES.includes(roleRaw) ? roleRaw : "GUEST";

  if (!name) return { ok: false, error: "Name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({ data: { name, email, passwordHash, role } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "That email is already registered." };
    }
    throw error;
  }

  revalidatePath("/dashboard/users");
  return { ok: true };
}

/** Change a user's role. Admins can't demote their own account. */
export async function setUserRole(formData: FormData): Promise<void> {
  const adminId = (await requireAdmin()).id;

  const id = String(formData.get("id") ?? "");
  const roleRaw = String(formData.get("role") ?? "") as Role;
  if (!id || !ROLES.includes(roleRaw)) throw new Error("Invalid request");
  if (id === adminId && roleRaw !== "ADMIN") {
    throw new Error("You can't remove your own admin access.");
  }

  await prisma.user.update({ where: { id }, data: { role: roleRaw } });
  revalidatePath("/dashboard/users");
}

/**
 * Delete a user account. Admins can't delete themselves and must re-enter
 * their own password to confirm this destructive action.
 */
export async function deleteUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch {
    return { ok: false, error: "Only administrators can delete users." };
  }

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id) return { ok: false, error: "Missing user id." };
  if (id === adminId) {
    return { ok: false, error: "You can't delete your own account." };
  }
  if (!password) {
    return { ok: false, error: "Please enter your password to confirm." };
  }

  // Re-authenticate the admin against their own stored password.
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin) return { ok: false, error: "Your session is no longer valid." };
  const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatch) return { ok: false, error: "Incorrect password." };

  await prisma.user.delete({ where: { id } });
  revalidatePath("/dashboard/users");
  return { ok: true };
}
