import { ROLES, RoleKey, permissionsForRoles, ADMIN_REQUIRED_PERMISSIONS } from './roles';
import { PERMISSIONS, ALL_PERMISSIONS } from './permissions';

describe('roles', () => {
  it('gives Super Admin every permission', () => {
    const perms = permissionsForRoles([RoleKey.SuperAdmin]);
    expect(perms.size).toBe(ALL_PERMISSIONS.length);
  });

  it('unions permissions across multiple roles', () => {
    const perms = permissionsForRoles([RoleKey.Proposer, RoleKey.Auditor]);
    expect(perms.has(PERMISSIONS.VendorCreate)).toBe(true);
    expect(perms.has(PERMISSIONS.AuditRead)).toBe(true);
  });

  it('does not grant a proposer any admin permission', () => {
    const perms = permissionsForRoles([RoleKey.Proposer]);
    expect(perms.has(PERMISSIONS.UserManage)).toBe(false);
    expect(perms.has(PERMISSIONS.SettingsManage)).toBe(false);
  });

  it('keeps admin-required permissions on the platform admin role', () => {
    const admin = new Set(ROLES[RoleKey.PlatformAdmin].permissions);
    for (const p of ADMIN_REQUIRED_PERMISSIONS) expect(admin.has(p)).toBe(true);
  });

  it('ignores unknown role keys gracefully', () => {
    const perms = permissionsForRoles(['nonexistent' as unknown as RoleKey]);
    expect(perms.size).toBe(0);
  });
});
