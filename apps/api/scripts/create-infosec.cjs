// Create the InfoSec role + a dedicated InfoSec login (local user + Supabase auth user).
// Targeted and idempotent — does NOT run the full destructive seed.
const { PrismaClient } = require('@prisma/client');
const { ROLES, RoleKey, newId } = require('@vop/shared');
const { createClient } = require('@supabase/supabase-js');

const EMAIL = 'infosec@vop.local';
const NAME = 'InfoSec Reviewer';

(async () => {
  const prisma = new PrismaClient();
  const def = ROLES[RoleKey.InfoSec];

  // 1) InfoSec role
  await prisma.role.upsert({
    where: { key: def.key },
    create: {
      id: newId(),
      key: def.key,
      label: def.label,
      description: def.description,
      builtIn: true,
      permissions: [...def.permissions],
    },
    update: { label: def.label, description: def.description, permissions: [...def.permissions] },
  });
  console.log('role upserted:', def.key, '->', [...def.permissions].join(', '));

  // 2) Local app user with the InfoSec role only
  await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      id: newId(),
      email: EMAIL,
      name: NAME,
      status: 'ACTIVE',
      authMethod: 'OIDC',
      roles: { connect: [{ key: def.key }] },
    },
    update: { name: NAME, status: 'ACTIVE', roles: { set: [{ key: def.key }] } },
  });
  console.log('local user upserted:', EMAIL);

  // 3) Supabase auth user (so they can actually log in)
  const url = process.env.VOP_SUPABASE_URL;
  const serviceRole = process.env.VOP_SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.VOP_SEED_SUPABASE_PASSWORD;
  if (url && serviceRole && password) {
    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    let existingId = null;
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const found = data.users.find((u) => u.email && u.email.toLowerCase() === EMAIL);
      if (found) { existingId = found.id; break; }
      if (data.users.length < 1000) break;
    }
    if (existingId) {
      await admin.auth.admin.updateUserById(existingId, {
        password,
        email_confirm: true,
        user_metadata: { name: NAME },
      });
      console.log('supabase auth user UPDATED');
    } else {
      const { error } = await admin.auth.admin.createUser({
        email: EMAIL,
        password,
        email_confirm: true,
        user_metadata: { name: NAME },
      });
      if (error) throw error;
      console.log('supabase auth user CREATED');
    }
    console.log('LOGIN ->', EMAIL, '/ password =', password);
  } else {
    console.log('Supabase env not set — skipped auth user; set password manually in Supabase.');
  }

  await prisma.$disconnect();
  console.log('Done.');
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
