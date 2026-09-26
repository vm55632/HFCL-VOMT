import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@vop/shared';

/** The authenticated principal attached to a request by the SessionGuard. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  permissions: Set<Permission>;
  managerId: string | null;
  sessionId: string;
}

/** A request that has passed authentication. */
export interface AuthedRequest {
  user?: AuthUser;
}

/** Inject the current authenticated user into a controller handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user;
  },
);
