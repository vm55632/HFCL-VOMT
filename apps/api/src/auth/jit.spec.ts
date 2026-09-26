import { mapClaimsToRoles, type ClaimRoleRule } from './jit.service';

const rules: ClaimRoleRule[] = [
  { claimType: 'group', claimValue: 'procurement', roleKey: 'procurement' },
  { claimType: 'group', claimValue: 'finance', roleKey: 'finance' },
  { claimType: 'role', claimValue: 'ignored', roleKey: 'super_admin' },
];

describe('mapClaimsToRoles', () => {
  it('maps matching group claims to role keys', () => {
    expect(mapClaimsToRoles(['procurement'], rules)).toEqual(['procurement']);
  });

  it('ignores non-group claim types and unmatched groups', () => {
    expect(mapClaimsToRoles(['ignored', 'unknown'], rules)).toEqual([]);
  });

  it('deduplicates and returns all matches', () => {
    const r = mapClaimsToRoles(['procurement', 'finance', 'procurement'], rules).sort();
    expect(r).toEqual(['finance', 'procurement']);
  });

  it('returns empty for no groups', () => {
    expect(mapClaimsToRoles([], rules)).toEqual([]);
  });
});
