import { EntityType } from '../types';

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * The 4th character of a PAN encodes the holder type. Map the common ones to the
 * constitution the intake form should show. (Ported from the prototype lookup.)
 */
const PAN_HOLDER_TYPE: Record<string, { label: string; entity: EntityType }> = {
  P: { label: 'Individual', entity: EntityType.Individual },
  C: { label: 'Company', entity: EntityType.PrivateLimited },
  F: { label: 'Firm / LLP', entity: EntityType.Partnership },
  H: { label: 'HUF', entity: EntityType.Huf },
  T: { label: 'Trust', entity: EntityType.TrustSociety },
  A: { label: 'Association of Persons', entity: EntityType.TrustSociety },
  B: { label: 'Body of Individuals', entity: EntityType.TrustSociety },
  G: { label: 'Government', entity: EntityType.Government },
  J: { label: 'Artificial Juridical Person', entity: EntityType.Government },
  L: { label: 'Local Authority', entity: EntityType.Government },
};

export interface PanResult {
  valid: boolean;
  pan?: string;
  holderTypeChar?: string;
  holderType?: string;
  suggestedEntity?: EntityType;
  errors: string[];
}

/** Validate PAN format and derive holder type. Does not call any external API. */
export function validatePan(input: string): PanResult {
  const pan = (input || '').trim().toUpperCase();
  const errors: string[] = [];
  if (!PAN_RE.test(pan)) {
    errors.push('PAN must be five letters, four digits, then one letter (e.g. ABCDE1234F).');
    return { valid: false, errors };
  }
  const holderTypeChar = pan.charAt(3);
  const mapped = PAN_HOLDER_TYPE[holderTypeChar];
  return {
    valid: true,
    pan,
    holderTypeChar,
    holderType: mapped?.label ?? 'Unknown',
    suggestedEntity: mapped?.entity,
    errors,
  };
}
