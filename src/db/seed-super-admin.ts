import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local and .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { admins } from './schema.ts';

/**
 * Seed Super Admin account directly at the database level.
 * Reads credentials strictly from environment variables.
 */
export async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const phone = process.env.SUPER_ADMIN_PHONE?.trim();
  const name = process.env.SUPER_ADMIN_NAME?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  // 1. Fail fast if any required environment variable is missing
  const missingVars: string[] = [];
  if (!email) missingVars.push('SUPER_ADMIN_EMAIL');
  if (!phone) missingVars.push('SUPER_ADMIN_PHONE');
  if (!name) missingVars.push('SUPER_ADMIN_NAME');
  if (!password) missingVars.push('SUPER_ADMIN_PASSWORD');

  if (missingVars.length > 0) {
    throw new Error(
      `[Super Admin Seed] Missing required environment variable(s): ${missingVars.join(', ')}. Please provide them in .env.local or the runtime environment.`
    );
  }

  const normalizedEmail = email.toLowerCase();

  // 2. Idempotency check: verify if an admin account with this email already exists
  const existing = await db
    .select()
    .from(admins)
    .where(eq(admins.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    const adminRecord = existing[0];
    const isPasswordMatch = await bcrypt.compare(password, adminRecord.passwordHash);

    if (!isPasswordMatch || !adminRecord.isSuperAdmin || adminRecord.role !== 'super_admin') {
      const saltRounds = 10;
      const updatedHash = await bcrypt.hash(password, saltRounds);
      await db
        .update(admins)
        .set({
          name,
          phoneNumber: phone,
          passwordHash: updatedHash,
          isSuperAdmin: true,
          role: 'super_admin',
          approvalStatus: 'approved',
        })
        .where(eq(admins.id, adminRecord.id));

      console.log(
        `[Super Admin Seed] ✅ Synchronized Super Admin credentials and status for ${normalizedEmail}.`
      );
    } else {
      console.log(
        `[Super Admin Seed] Account for ${normalizedEmail} already exists and is up to date (ID: ${adminRecord.id}). Skipping insert.`
      );
    }
    return;
  }

  // 3. Hash the password with bcrypt (salt rounds: 10) before storing
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // 4. Insert directly into the admins table with Super Admin role/flags
  await db.insert(admins).values({
    name,
    email: normalizedEmail,
    phoneNumber: phone,
    passwordHash,
    isSuperAdmin: true,
    role: 'super_admin',
    approvalStatus: 'approved',
  });

  console.log(
    `[Super Admin Seed] ✅ Successfully seeded Super Admin account for ${name} (${normalizedEmail}) with Super Admin authority.`
  );
}

// Allow standalone CLI execution: tsx src/db/seed-super-admin.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSuperAdmin()
    .then(() => {
      console.log('[Super Admin Seed] Process complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Super Admin Seed] ❌ Error:', err.message);
      process.exit(1);
    });
}
