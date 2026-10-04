// Create the parallel reviewer roles (FCU, Operation, Legal, SAP) + a dedicated login for each.
// Idempotent; does NOT run the full destructive seed. Mirrors create-infosec.cjs.
const { PrismaClient } = require('@prisma/client');
const { ROLES, RoleKey, newId } = require('@vop/shared');
const { createClient } = require('@supabase/supabase-js');

const REVIEWERS = [
  { key: RoleKey.Fcu, email: 'fcu@vop.local', name: 'FCU Reviewer' },
  { key: RoleKey.Operation, email: 'operation@vop.local', name: 'Operation Reviewer' },
  { key: RoleKey.Legal, email: 'legal@vop.local', name: 'Legal Reviewer' },
  { key: RoleKey.Sap, email: 'sap@vop.local', name: 'SAP Confirmation' },
];

(async () => {
  const prisma = new PrismaClient();
  const url = process.env.VOP_SUPABASE_URL;
  const serviceRole = process.env.VOP_SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.VOP_SEED_SUPABASE_PASSWORD;
  const admin =
    url && serviceRole ? createClient(url, serviceRole, { auth: { persistSession: false } }) : null;

  for (const r of REVIEWERS) {
    const def = ROLES[r.key];
    // 1) Role
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

    // 2) Local app user with just this role
    await prisma.user.upsert({
      where: { email: r.email },
      create: {
        id: newId(),
        email: r.email,
        name: r.name,
        status: 'ACTIVE',
        authMethod: 'OIDC',
        roles: { connect: [{ key: def.key }] },
      },
      update: { name: r.name, status: 'ACTIVE', roles: { set: [{ key: def.key }] } },
    });

    // 3) Supabase auth user
    if (admin && password) {
      let existingId = null;
      for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const found = data.users.find((u) => u.email && u.email.toLowerCase() === r.email);
        if (found) { existingId = found.id; break; }
        if (data.users.length < 1000) break;
      }
      if (existingId) {
        await admin.auth.admin.updateUserById(existingId, {
          password,
          email_confirm: true,
          user_metadata: { name: r.name },
        });
      } else {
        const { error } = await admin.auth.admin.createUser({
          email: r.email,
          password,
          email_confirm: true,
          user_metadata: { name: r.name },
        });
        if (error) throw error;
      }
      console.log(`OK  ${def.key.padEnd(10)} -> LOGIN ${r.email} / ${password}`);
    } else {
      console.log(`OK  ${def.key.padEnd(10)} (role + local user; set Supabase password manually)`);
    }
  }

  await prisma.$disconnect();
  console.log('Done.');
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
