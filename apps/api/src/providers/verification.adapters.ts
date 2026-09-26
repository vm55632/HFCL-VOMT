import { validatePan, validateGstin, validateIfsc } from '@vop/shared';
import type { VerificationProvider, VerificationResult } from './contracts';

const now = (): string => new Date().toISOString();

function result<T extends Record<string, unknown>>(
  status: VerificationResult['status'],
  data: T | undefined,
  ref: string,
): VerificationResult<T> {
  return {
    status,
    normalisedData: data,
    rawResponseRef: ref,
    verifiedAt: now(),
    providerName: 'mock',
  };
}

/**
 * Deterministic mock verification for every statutory check. The same identifier always returns
 * the same record, so demos and tests are reproducible. Format/checksum are validated with the
 * shared validators; a well-formed identifier "verifies", a malformed one returns an error.
 *
 * Real government/aggregator adapters are intentionally NOT implemented here (prompt rule 4) —
 * they arrive once API docs + sandbox credentials are supplied (Phase 4).
 */
export class MockVerificationProvider implements VerificationProvider {
  pan(input: { pan: string; name?: string }): Promise<VerificationResult> {
    const v = validatePan(input.pan);
    if (!v.valid) return Promise.resolve(result('error', { errors: v.errors }, 'mock:pan'));
    return Promise.resolve(
      result(
        'verified',
        {
          pan: v.pan,
          holderType: v.holderType,
          panStatus: 'VALID',
          nameOnRecord: input.name ? input.name.toUpperCase() : 'MOCK LEGAL NAME',
        },
        `mock:pan:${v.pan}`,
      ),
    );
  }

  gstin(input: { gstin: string }): Promise<VerificationResult> {
    const v = validateGstin(input.gstin);
    if (!v.valid) return Promise.resolve(result('error', { errors: v.errors }, 'mock:gstin'));
    return Promise.resolve(
      result(
        'verified',
        {
          gstin: v.gstin,
          embeddedPan: v.embeddedPan,
          stateCode: v.stateCode,
          legalName: 'MOCK LEGAL NAME',
          tradeName: 'Mock Trade Name',
          status: 'Active',
          taxpayerType: 'Regular',
        },
        `mock:gstin:${v.gstin}`,
      ),
    );
  }

  mca(input: { registration: string }): Promise<VerificationResult> {
    const reg = (input.registration || '').trim().toUpperCase();
    const isCin = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(reg);
    const isLlpin = /^[A-Z]{3}-\d{4}$/.test(reg);
    if (!isCin && !isLlpin) {
      return Promise.resolve(
        result('error', { errors: ['Not a valid CIN or LLPIN format.'] }, 'mock:mca'),
      );
    }
    return Promise.resolve(
      result(
        'verified',
        {
          registration: reg,
          status: 'Active',
          incorporationDate: '2015-04-01',
          paidUpCapital: 1000000,
        },
        `mock:mca:${reg}`,
      ),
    );
  }

  bank(input: { account: string; ifsc: string; name?: string }): Promise<VerificationResult> {
    const v = validateIfsc(input.ifsc);
    if (!v.valid) return Promise.resolve(result('error', { errors: v.errors }, 'mock:bank'));
    if (!/^\d{6,18}$/.test((input.account || '').trim())) {
      return Promise.resolve(
        result('error', { errors: ['Account number must be 6–18 digits.'] }, 'mock:bank'),
      );
    }
    return Promise.resolve(
      result(
        'verified',
        {
          ifsc: v.ifsc,
          bankCode: v.bankCode,
          accountNameOnRecord: input.name ? input.name.toUpperCase() : 'MOCK ACCOUNT HOLDER',
          pennyDrop: 'success',
        },
        `mock:bank:${v.ifsc}`,
      ),
    );
  }

  udyam(input: { udyam: string }): Promise<VerificationResult> {
    const u = (input.udyam || '').trim().toUpperCase();
    if (!/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(u)) {
      return Promise.resolve(
        result('error', { errors: ['Udyam number must be UDYAM-XX-00-0000000.'] }, 'mock:udyam'),
      );
    }
    return Promise.resolve(
      result(
        'verified',
        { udyam: u, enterpriseType: 'Micro', majorActivity: 'Services' },
        `mock:udyam:${u}`,
      ),
    );
  }
}

/** Real aggregator/government verification — marked stub until docs + sandbox creds arrive. */
export class NotImplementedVerification implements VerificationProvider {
  constructor(private readonly name: string) {}
  private stub(): Promise<VerificationResult> {
    return Promise.reject(
      new Error(`${this.name} VerificationProvider is not implemented yet (stub).`),
    );
  }
  pan(): Promise<VerificationResult> {
    return this.stub();
  }
  gstin(): Promise<VerificationResult> {
    return this.stub();
  }
  mca(): Promise<VerificationResult> {
    return this.stub();
  }
  bank(): Promise<VerificationResult> {
    return this.stub();
  }
  udyam(): Promise<VerificationResult> {
    return this.stub();
  }
}
