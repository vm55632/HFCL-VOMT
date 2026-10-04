/**
 * Create Supabase Auth users for the demo accounts so Supabase login maps to the seeded app users
 * (matched by email). Idempotent: existing users are updated, not duplicated.
 *
 * Requires (never hardcoded — pass via env):
 *   VOP_SUPABASE_URL                e.g. https://<ref>.supabase.co
 *   VOP_SUPABASE_SERVICE_ROLE_KEY   service_role key (admin; keep secret)
 *   VOP_SEED_SUPABASE_PASSWORD      initial password for every demo user
 *
 * Run:  pnpm --filter @vop/api ts-node scripts/seed-supabase-users.ts
 */
import { createClient } from '@supabase/supabase-js';

const DEMO_USERS: { email: string; name: string }[] = [
  { email: 'priya.nair@vop.local', name: 'Priya Nair' },
  { email: 'platform.admin@vop.local', name: 'Platform Admin' },
  { email: 'raj.malhotra@vop.local', name: 'Raj Malhotra' },
  { email: 'meera.iyer@vop.local', name: 'Meera Iyer' },
  { email: 'anita.rao@vop.local', name: 'Anita Rao' },
  { email: 'sara.lindqvist@vop.local', name: 'Sara Lindqvist' },
  { email: 'daniel.okafor@vop.local', name: 'Daniel Okafor' },
  { email: 'auditor@vop.local', name: 'Ava Auditor' },
];

async function main(): Promise<void> {
  const url = process.env.VOP_SUPABASE_URL;
  const serviceRole = process.env.VOP_SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.VOP_SEED_SUPABASE_PASSWORD;
  if (!url || !serviceRole || !password) {
    throw new Error(
      'Set VOP_SUPABASE_URL, VOP_SUPABASE_SERVICE_ROLE_KEY and VOP_SEED_SUPABASE_PASSWORD.',
    );
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  // Index existing users by email so re-runs update instead of failing.
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }

  for (const u of DEMO_USERS) {
    const id = existing.get(u.email.toLowerCase());
    if (id) {
      await admin.auth.admin.updateUserById(id, {
        password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      console.warn(`  updated ${u.email}`);
    } else {
      const { error } = await admin.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) throw error;
      console.warn(`  created ${u.email}`);
    }
  }
  console.warn(`Done. ${DEMO_USERS.length} Supabase users provisioned.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
