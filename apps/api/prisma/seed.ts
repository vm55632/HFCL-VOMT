/**
 * Seed the identity foundation: the role model (from the shared domain), a Keycloak dev IdP
 * config, and a set of demo users — one per role — for local development. All data is fake;
 * no real PAN/GST/personal data (Definition of Done). Internal users authenticate via SSO,
 * so demo users carry no password.
 *
 * Run: pnpm --filter @vop/api prisma:seed   (build @vop/shared first so it resolves).
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { ROLES, RoleKey, newId } from '@vop/shared';

const prisma = new PrismaClient();

interface DemoUser {
  email: string;
  name: string;
  role: RoleKey;
  managerEmail?: string;
}

const DEMO_USERS: DemoUser[] = [
  { email: 'priya.nair@vop.local', name: 'Priya Nair', role: RoleKey.SuperAdmin },
  { email: 'platform.admin@vop.local', name: 'Platform Admin', role: RoleKey.PlatformAdmin },
  { email: 'raj.malhotra@vop.local', name: 'Raj Malhotra', role: RoleKey.Approver },
  {
    email: 'meera.iyer@vop.local',
    name: 'Meera Iyer',
    role: RoleKey.Proposer,
    managerEmail: 'raj.malhotra@vop.local',
  },
  { email: 'anita.rao@vop.local', name: 'Anita Rao', role: RoleKey.Procurement },
  { email: 'sara.lindqvist@vop.local', name: 'Sara Lindqvist', role: RoleKey.Finance },
  { email: 'daniel.okafor@vop.local', name: 'Daniel Okafor', role: RoleKey.Compliance },
  { email: 'auditor@vop.local', name: 'Ava Auditor', role: RoleKey.Auditor },
];

async function seedRoles(): Promise<void> {
  for (const def of Object.values(ROLES)) {
    const permissions = [...def.permissions];
    await prisma.role.upsert({
      where: { key: def.key },
      create: {
        id: newId(),
        key: def.key,
        label: def.label,
        description: def.description,
        builtIn: true,
        permissions,
      },
      update: { label: def.label, description: def.description, permissions },
    });
  }
  console.warn(`  roles: ${Object.keys(ROLES).length} upserted`);
}

async function seedUsers(): Promise<void> {
  // First pass: create/update users without manager links.
  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        id: newId(),
        email: u.email,
        name: u.name,
        status: 'ACTIVE',
        authMethod: 'OIDC',
        roles: { connect: [{ key: u.role }] },
      },
      update: {
        name: u.name,
        status: 'ACTIVE',
        roles: { set: [{ key: u.role }] },
      },
    });
  }
  // Second pass: manager relationships.
  for (const u of DEMO_USERS) {
    if (!u.managerEmail) continue;
    const manager = await prisma.user.findUnique({ where: { email: u.managerEmail } });
    if (manager) {
      await prisma.user.update({
        where: { email: u.email },
        data: { managerId: manager.id },
      });
    }
  }
  console.warn(`  users: ${DEMO_USERS.length} upserted`);
}

async function seedIdp(): Promise<void> {
  const existing = await prisma.idpConfig.findFirst({ where: { name: 'Keycloak (dev)' } });
  const claimMappings: Prisma.InputJsonValue = {
    subject: 'sub',
    email: 'email',
    name: 'name',
    groups: 'groups',
    manager: 'manager',
  };
  if (!existing) {
    await prisma.idpConfig.create({
      data: {
        id: newId(),
        name: 'Keycloak (dev)',
        protocol: 'OIDC',
        issuer: process.env.VOP_OIDC_ISSUER ?? 'http://localhost:8080/realms/vop',
        clientId: process.env.VOP_OIDC_CLIENT_ID ?? 'vop-api',
        metadataUrl:
          (process.env.VOP_OIDC_ISSUER ?? 'http://localhost:8080/realms/vop') +
          '/.well-known/openid-configuration',
        claimMappings,
        enabled: true,
      },
    });
    console.warn('  idp: Keycloak (dev) OIDC config created');
  } else {
    console.warn('  idp: Keycloak (dev) already present');
  }
}

async function main(): Promise<void> {
  console.warn('Seeding VOP identity foundation…');
  await seedRoles();
  await seedUsers();
  await seedIdp();
  console.warn('Done. Demo users (SSO, no password):');
  for (const u of DEMO_USERS) console.warn(`    ${u.email.padEnd(28)} ${ROLES[u.role].label}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
