import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@vop/shared';

export const REQUIRE_PERMISSIONS_KEY = 'vop:requirePermissions';

/**
 * Require one or more permissions to reach a route. Enforced server-side by PermissionsGuard
 * (deny-by-default). The UI hiding a control is never the control.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
