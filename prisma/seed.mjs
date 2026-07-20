// Create (or update) a staff/admin account.
//   node prisma/seed.mjs <email> <password> [name]
// Example:
//   node prisma/seed.mjs admin@fabiansazzure.com "S3cret!" "Resort Admin"
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config();

const [, , email, password, name = "Resort Admin"] = process.argv;

if (!email || !password) {
  console.error(
    "Usage: node prisma/seed.mjs <email> <password> [name]\n" +
      'Example: node prisma/seed.mjs admin@fabiansazzure.com "S3cret!" "Resort Admin"'
  );
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", name },
    create: { email, passwordHash, role: "ADMIN", name },
  });
  console.log(`✔ Admin account ready: ${user.email} (${user.role})`);
} catch (error) {
  console.error("Failed to create admin:", error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
