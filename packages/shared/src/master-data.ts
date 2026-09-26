import { RoleKey } from './roles';
import type { WorkflowDefinition } from './workflow';

/** A configurable vendor category (master data). Seeded, then editable by an admin. */
export interface VendorCategoryDef {
  key: string;
  name: string;
  description: string;
  sortOrder: number;
  /** Triggers enhanced due diligence (e.g. related party). */
  enhancedDueDiligence: boolean;
  /** Document types this category requires (keys; Phase 3 collects the files). */
  requiredDocuments: string[];
  /** Statutory checks this category requires (Phase 4 runs them). */
  requiredValidations: string[];
  /** Workflow key this category routes through. */
  workflowKey: string;
}

export const DEFAULT_WORKFLOW_KEY = 'standard-vendor';

const STD_DOCS = ['pan_card', 'gst_certificate', 'cancelled_cheque'];
const STD_CHECKS = ['pan', 'gstin', 'bank'];

export const DEFAULT_CATEGORIES: VendorCategoryDef[] = [
  {
    key: 'goods_manufacturer',
    name: 'Goods supplier / Manufacturer',
    description: 'Supplies goods or manufactures products.',
    sortOrder: 10,
    enhancedDueDiligence: false,
    requiredDocuments: STD_DOCS,
    requiredValidations: STD_CHECKS,
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'service_provider',
    name: 'Service provider',
    description: 'Provides services under contract.',
    sortOrder: 20,
    enhancedDueDiligence: false,
    requiredDocuments: STD_DOCS,
    requiredValidations: STD_CHECKS,
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'contractor',
    name: 'Contractor / Sub-contractor',
    description: 'Executes works or sub-contracts.',
    sortOrder: 30,
    enhancedDueDiligence: false,
    requiredDocuments: [...STD_DOCS, 'insurance'],
    requiredValidations: STD_CHECKS,
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'consultant',
    name: 'Consultant / Professional',
    description: 'Individual or firm providing professional services.',
    sortOrder: 40,
    enhancedDueDiligence: false,
    requiredDocuments: STD_DOCS,
    requiredValidations: STD_CHECKS,
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'logistics',
    name: 'Logistics / Transport',
    description: 'Freight, transport and logistics.',
    sortOrder: 50,
    enhancedDueDiligence: false,
    requiredDocuments: STD_DOCS,
    requiredValidations: STD_CHECKS,
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'it_saas',
    name: 'IT / Software / SaaS',
    description: 'Software, SaaS and IT services.',
    sortOrder: 60,
    enhancedDueDiligence: false,
    requiredDocuments: STD_DOCS,
    requiredValidations: STD_CHECKS,
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'one_time',
    name: 'One-time vendor',
    description: 'Single-transaction vendor.',
    sortOrder: 70,
    enhancedDueDiligence: false,
    requiredDocuments: ['pan_card', 'cancelled_cheque'],
    requiredValidations: ['pan', 'bank'],
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'foreign',
    name: 'Foreign vendor (non-resident)',
    description: 'Non-resident vendor; GST may not apply (FEMA / tax residency checks).',
    sortOrder: 80,
    enhancedDueDiligence: true,
    requiredDocuments: ['tax_residency_certificate', 'bank_details'],
    requiredValidations: ['bank'],
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'government_psu',
    name: 'Government / PSU',
    description: 'Government body or public-sector undertaking.',
    sortOrder: 90,
    enhancedDueDiligence: false,
    requiredDocuments: ['pan_card', 'bank_details'],
    requiredValidations: ['pan', 'bank'],
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
  {
    key: 'related_party',
    name: 'Related party',
    description: 'Related party — triggers enhanced due diligence.',
    sortOrder: 100,
    enhancedDueDiligence: true,
    requiredDocuments: [...STD_DOCS, 'related_party_declaration'],
    requiredValidations: STD_CHECKS,
    workflowKey: DEFAULT_WORKFLOW_KEY,
  },
];

/**
 * The default workflow, version 1, PUBLISHED. Mirrors the reference prototype's spine but as a
 * data-driven, versioned definition: Risk applies to medium+; Partner approval to high+; the
 * Procurement stage is an evidence gate.
 */
export const DEFAULT_WORKFLOW: WorkflowDefinition = {
  key: DEFAULT_WORKFLOW_KEY,
  name: 'Standard vendor onboarding',
  version: 1,
  status: 'PUBLISHED',
  rejectStageKey: 'rejected',
  stages: [
    {
      key: 'draft',
      name: 'Draft',
      shortName: 'Draft',
      order: 0,
      ownerRole: RoleKey.Proposer,
      slaBusinessDays: 0,
      terminal: false,
    },
    {
      key: 'procurement',
      name: 'Procurement verification',
      shortName: 'Procurement',
      order: 10,
      ownerRole: RoleKey.Procurement,
      slaBusinessDays: 3,
      terminal: false,
      evidenceGate: true,
    },
    {
      key: 'risk',
      name: 'Risk & compliance review',
      shortName: 'Risk',
      order: 20,
      ownerRole: RoleKey.Compliance,
      slaBusinessDays: 5,
      terminal: false,
      applicableTiers: ['medium', 'high', 'critical'],
    },
    {
      key: 'finance',
      name: 'Bank & payment setup',
      shortName: 'Finance',
      order: 30,
      ownerRole: RoleKey.Finance,
      slaBusinessDays: 2,
      terminal: false,
    },
    {
      key: 'approval',
      name: 'Partner approval',
      shortName: 'Approval',
      order: 40,
      ownerRole: RoleKey.Approver,
      slaBusinessDays: 3,
      terminal: false,
      applicableTiers: ['high', 'critical'],
    },
    {
      key: 'approved',
      name: 'Approved — onboarded',
      shortName: 'Approved',
      order: 50,
      ownerRole: null,
      slaBusinessDays: 0,
      terminal: true,
    },
    {
      key: 'rejected',
      name: 'Rejected',
      shortName: 'Rejected',
      order: 60,
      ownerRole: null,
      slaBusinessDays: 0,
      terminal: true,
    },
  ],
};
