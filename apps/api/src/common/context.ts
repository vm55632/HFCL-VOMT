import { AsyncLocalStorage } from 'node:async_hooks';

/** Per-request ambient context, propagated via AsyncLocalStorage for logs and audit. */
export interface RequestContext {
  correlationId: string;
  userId?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** The current request context, if any. */
export function currentContext(): RequestContext | undefined {
  return requestContext.getStore();
}
