import { SlaService } from './sla.service';
import type { RegistrationService } from '../registration/registration.service';
import type { PinoLoggerService } from '../common/logging/logger.service';

describe('SlaService.sweep', () => {
  const logger = { log: jest.fn() } as unknown as PinoLoggerService;

  it('expires stale registration requests and reports the count', async () => {
    const registration = {
      expireStale: jest.fn().mockResolvedValue(3),
    } as unknown as RegistrationService;
    const svc = new SlaService(registration, logger);
    const now = new Date('2026-02-01T00:00:00Z');
    const result = await svc.sweep(now);
    expect(registration.expireStale).toHaveBeenCalledWith(now);
    expect(result).toEqual({ registrationsExpired: 3, caseSlaBreaches: 0 });
  });

  it('is quiet when nothing is stale', async () => {
    const registration = {
      expireStale: jest.fn().mockResolvedValue(0),
    } as unknown as RegistrationService;
    const svc = new SlaService(registration, logger);
    const result = await svc.sweep();
    expect(result.registrationsExpired).toBe(0);
  });
});
