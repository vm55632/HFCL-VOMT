import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'vop:isPublic';

/** Mark a route as public — it bypasses authentication (login, SSO callbacks, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
