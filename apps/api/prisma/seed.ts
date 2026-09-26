/**
 * Seed the identity foundation: the role model (from the shared domain), a Keycloak dev IdP
 * config, and a set of demo users — one per role — for local development. All data is fake;
 * no real PAN/GST/personal data (Definition of Done). Internal users authenticate via SSO,
 * so demo users carry no password.
 *
 * Run: pnpm --filter @vop/api prisma:seed   (build @vop/shared first so it resolves).
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { ROLES, RoleKey, newId, DEFAULT_CATEGORIES, DEFAULT_WORKFLOW } from '@vop/shared';
import { PasswordService } from '../src/auth/password.service';

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

/**
 * Optionally set a break-glass local password for the Super Admin, from
 * VOP_SEED_ADMIN_PASSWORD. Never hardcoded. Local login is still gated by
 * VOP_LOCAL_LOGIN_ENABLED at runtime; the account must change it on first use.
 */
async function seedBreakGlass(): Promise<void> {
  const password = process.env.VOP_SEED_ADMIN_PASSWORD;
  if (!password) {
    console.warn('  break-glass: VOP_SEED_ADMIN_PASSWORD not set — no local password seeded');
    return;
  }
  const { salt, hash } = await new PasswordService().hash(password);
  await prisma.user.update({
    where: { email: 'priya.nair@vop.local' },
    data: { pwSalt: salt, pwHash: hash, mustChangePassword: true },
  });
  console.warn(
    '  break-glass: local password set for priya.nair@vop.local (must change on first use)',
  );
}

/** Seed vendor categories and the default published workflow (Phase 2 master data). */
async function seedMasterData(): Promise<void> {
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.vendorCategory.upsert({
      where: { key: c.key },
      create: {
        id: newId(),
        key: c.key,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
        enhancedDueDiligence: c.enhancedDueDiligence,
        requiredDocuments: c.requiredDocuments,
        requiredValidations: c.requiredValidations,
        workflowKey: c.workflowKey,
      },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder },
    });
  }
  console.warn(`  categories: ${DEFAULT_CATEGORIES.length} upserted`);

  const wf = DEFAULT_WORKFLOW;
  const existing = await prisma.workflowDefinition.findUnique({
    where: { key_version: { key: wf.key, version: wf.version } },
  });
  if (!existing) {
    await prisma.workflowDefinition.create({
      data: {
        id: newId(),
        key: wf.key,
        name: wf.name,
        version: wf.version,
        status: 'PUBLISHED',
        rejectStageKey: wf.rejectStageKey,
        publishedAt: new Date(),
        stages: {
          create: wf.stages.map((s) => ({
            id: newId(),
            key: s.key,
            name: s.name,
            shortName: s.shortName,
            order: s.order,
            ownerRole: s.ownerRole,
            slaBusinessDays: s.slaBusinessDays,
            terminal: s.terminal,
            applicableTiers: s.applicableTiers ?? [],
            evidenceGate: s.evidenceGate ?? false,
            permissions: s.ownerRole
              ? {
                  create: [
                    {
                      id: newId(),
                      roleKey: s.ownerRole,
                      canView: true,
                      canEditFields: s.key === 'procurement',
                      canApprove: true,
                      canReject: true,
                      canSendBack: true,
                      canReassign: true,
                    },
                  ],
                }
              : undefined,
          })),
        },
      },
    });
    console.warn(`  workflow: "${wf.key}" v${wf.version} published (${wf.stages.length} stages)`);
  } else {
    console.warn(`  workflow: "${wf.key}" v${wf.version} already present`);
  }
}

async function main(): Promise<void> {
  console.warn('Seeding VOP identity foundation…');
  await seedRoles();
  await seedUsers();
  await seedIdp();
  await seedBreakGlass();
  await seedMasterData();
  console.warn('Done. Demo users (SSO, no password unless break-glass set):');
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
