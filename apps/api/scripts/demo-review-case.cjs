// Create a demo case already in the SAP-ready state (FCU/Operation/Legal approved in parallel),
// so the ParallelReview progress design can be viewed/screenshotted. Idempotent by ref.
const { PrismaClient } = require('@prisma/client');
const { newId } = require('@vop/shared');

(async () => {
  const prisma = new PrismaClient();
  const REF = 'VOM-DEMO-0001';
  const existing = await prisma.case.findUnique({ where: { ref: REF } });
  if (existing) {
    await prisma.case.delete({ where: { id: existing.id } }); // cascade clears children
  }

  const cat = await prisma.vendorCategory.findFirst({ where: { active: true } });
  const wf = await prisma.workflowDefinition.findFirst({
    where: { key: cat.workflowKey, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
  });
  const proposer = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
  const byEmail = async (e) => (await prisma.user.findUnique({ where: { email: e } }))?.id ?? proposer.id;
  const fcuId = await byEmail('fcu@vop.local');
  const opId = await byEmail('operation@vop.local');
  const legalId = await byEmail('legal@vop.local');

  const id = newId();
  const day = new Date('2025-04-26T06:00:00Z');
  const at = (h, m) => new Date(`2025-04-26T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);

  await prisma.case.create({
    data: {
      id,
      ref: REF,
      categoryKey: cat.key,
      workflowKey: wf?.key ?? 'standard-vendor',
      workflowVersion: wf?.version ?? 1,
      stage: 'sap',
      tier: 'low',
      riskScore: 2,
      createdById: proposer.id,
      lastUpdatedById: proposer.id,
      infosecRequired: false,
      createdAt: day,
      general: {
        create: {
          id: newId(),
          legalName: 'NXBIRD PRIVATE LIMITED',
          tradeName: 'NXBIRD',
          businessAddress: 'Plot 14, Sector 62, Noida, Uttar Pradesh 201309',
          contactEmail: 'spoc@nxbird.example',
          spend: 250000,
          justification: 'Demo case for the parallel-review progress view.',
        },
      },
      fcuStage: {
        create: { id: newId(), status: 'approved', decision: 'approve', actionedById: fcuId, enteredAt: day, completedAt: at(11, 32) },
      },
      operationStage: {
        create: { id: newId(), status: 'approved', decision: 'approve', actionedById: opId, enteredAt: day, completedAt: at(12, 15) },
      },
      legalStage: {
        create: {
          id: newId(),
          status: 'approved',
          decision: 'approve',
          actionedById: legalId,
          enteredAt: day,
          completedAt: at(13, 8),
          data: { agreement: 'Master Services Agreement — standard terms, 2-year term, net-30 payment.' },
        },
      },
      sapStage: { create: { id: newId(), status: 'pending', enteredAt: at(13, 10) } },
      activity: {
        create: [
          { id: newId(), actorId: proposer.id, action: 'created', toStage: 'review', at: day },
          { id: newId(), actorId: fcuId, action: 'fcu_approve', fromStage: 'fcu', toStage: 'review', at: at(11, 32) },
          { id: newId(), actorId: opId, action: 'operation_approve', fromStage: 'operation', toStage: 'review', at: at(12, 15) },
          { id: newId(), actorId: legalId, action: 'legal_approve', fromStage: 'legal', toStage: 'sap', at: at(13, 8) },
        ],
      },
    },
  });

  await prisma.$disconnect();
  console.log(`Demo case ${REF} created (id=${id}), stage=sap, all 3 reviews approved.`);
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
