/** Cross-cutting enums and value types shared by API and web. */

/** Lifecycle of an internal (employee) user account. */
export enum UserStatus {
  PendingApproval = 'PENDING_APPROVAL',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
  Deactivated = 'DEACTIVATED',
}

/** State of an access/self-registration request. */
export enum RegistrationStatus {
  Pending = 'PENDING',
  InfoRequested = 'INFO_REQUESTED',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Expired = 'EXPIRED',
  Escalated = 'ESCALATED',
}

/** How a user authenticated. */
export enum AuthMethod {
  Oidc = 'OIDC',
  Saml = 'SAML',
  Local = 'LOCAL',
  VendorOtp = 'VENDOR_OTP',
}

/** Outcome recorded on an audit entry. */
export enum AuditOutcome {
  Success = 'SUCCESS',
  Failure = 'FAILURE',
  Denied = 'DENIED',
}

/** Indian constitution / entity types that change required fields. */
export enum EntityType {
  Individual = 'INDIVIDUAL',
  Partnership = 'PARTNERSHIP',
  Llp = 'LLP',
  PrivateLimited = 'PRIVATE_LIMITED',
  PublicLimited = 'PUBLIC_LIMITED',
  TrustSociety = 'TRUST_SOCIETY',
  Huf = 'HUF',
  Government = 'GOVERNMENT',
  Foreign = 'FOREIGN',
}

/** Provenance stamp for a verification lookup result (mirrors the prototype). */
export type VerificationSource = 'live' | 'mock';

export interface VerificationMeta {
  source: VerificationSource;
  provider: string;
  checkedAt: string; // ISO-8601 UTC
}
