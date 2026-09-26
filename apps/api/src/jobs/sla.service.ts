import { Injectable } from '@nestjs/common';
import { RegistrationService } from '../registration/registration.service';
import { PinoLoggerService } from '../common/logging/logger.service';

export interface SweepResult {
  registrationsExpired: number;
  // Phase 3 adds: workflow-case SLA reminders + escalations processed here.
  caseSlaBreaches: number;
}

/**
 * SLA / maintenance sweep. Run on a schedule by the jobs worker (and callable directly for tests).
 * Today it expires stale access requests and escalates them; Phase 3 extends it to workflow-case
 * SLA reminders and stage escalations using the same engine SLA math.
 */
@Injectable()
export class SlaService {
  constructor(
    private readonly registration: RegistrationService,
    private readonly logger: PinoLoggerService,
  ) {}

  async sweep(now = new Date()): Promise<SweepResult> {
    const registrationsExpired = await this.registration.expireStale(now);
    const result: SweepResult = { registrationsExpired, caseSlaBreaches: 0 };
    if (registrationsExpired > 0) {
      this.logger.log(
        `SLA sweep processed ${registrationsExpired} stale access request(s)`,
        'SlaService',
      );
    }
    return result;
  }
}
