// One-time backfill: copy each existing case's vendor-detail columns into the new case_general
// table, and seed a draft-stage row. Safe to re-run (upserts by caseId). Run BEFORE slimming the
// `case` table so no live data is lost.
const { PrismaClient } = require('@prisma/client');
const { newId } = require('@vop/shared');

const DETAIL_FIELDS = [
  'legalName', 'tradeName', 'businessAddress',
  'contactName', 'contactEmail', 'contactPhone',
  'signatoryName', 'signatoryEmail', 'signatoryMobile', 'signatoryPanEnc', 'signatoryPanBlindIndex',
  'panEnc', 'panBlindIndex', 'gstin', 'gstinBlindIndex', 'ifsc', 'bankName', 'branch',
  'bankAccountEnc', 'bankBlindIndex',
  'businessUnit', 'costCentre', 'spend', 'contractMonths', 'natureOfService', 'justification',
  'coiDeclared', 'coiDetails',
  'dataAccess', 'systemAccess', 'subcontract', 'delivery', 'screening', 'conflict', 'litigation',
  'insurance', 'certifications',
  'isecItHardware', 'isecItSoftware', 'isecAccessSystem', 'isecAccessNetwork', 'isecAccessApps',
  'isecAccessPii',
  'panStatus', 'gstStatus', 'nameMatch', 'taxpayerType', 'legalNameOnRecord',
];

(async () => {
  const prisma = new PrismaClient();
  const cases = await prisma.case.findMany();
  console.log(`Found ${cases.length} case(s).`);
  let general = 0;
  let draft = 0;
  for (const c of cases) {
    const data = {};
    for (const f of DETAIL_FIELDS) if (c[f] !== undefined) data[f] = c[f];
    await prisma.caseGeneral.upsert({
      where: { caseId: c.id },
      create: { id: newId(), caseId: c.id, ...data },
      update: data,
    });
    general++;

    // Every case began at draft; record a draft-stage row (completed once it left draft).
    const leftDraft = c.stage !== 'draft';
    await prisma.caseDraft.upsert({
      where: { caseId: c.id },
      create: {
        id: newId(),
        caseId: c.id,
        status: leftDraft ? 'completed' : 'pending',
        actionedById: c.createdById,
        enteredAt: c.createdAt,
        completedAt: leftDraft ? (c.submittedAt ?? c.updatedAt) : null,
      },
      update: {},
    });
    draft++;
  }
  await prisma.$disconnect();
  console.log(`Backfilled case_general: ${general}, case_draft: ${draft}. Done.`);
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
