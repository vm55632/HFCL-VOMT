import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@vop/shared';
import { REQUIRE_PERMISSIONS_KEY } from './permissions.decorator';
import type { AuthedRequest } from '../auth/auth-user';

/**
 * Global authorization guard (deny-by-default). Runs after authentication. If a route declares
 * @RequirePermissions, the authenticated user must hold ALL of them; otherwise the request is
 * denied with 403. Routes with no declared permissions are allowed for any authenticated user.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authorized.');

    const missing = required.filter((p) => !user.permissions.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
