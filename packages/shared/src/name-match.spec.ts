import { normalizeName, nameMatchScore, nameMatchVerdict } from './name-match';

describe('normalizeName', () => {
  it('strips company forms, punctuation and case', () => {
    expect(normalizeName('Acme Cloud Pvt. Ltd.')).toBe('ACME CLOUD');
    expect(normalizeName('M/s Acme & Co')).toBe('ACME');
  });
});

describe('nameMatchScore / verdict', () => {
  it('scores identical normalised names as 1 (match)', () => {
    const s = nameMatchScore('Acme Cloud Private Limited', 'ACME CLOUD PVT LTD');
    expect(s).toBe(1);
    expect(nameMatchVerdict(s)).toBe('match');
  });

  it('scores a reordered/partial name as review, not match', () => {
    const s = nameMatchScore('Acme Cloud Ltd', 'Cloud Acme Solutions Ltd');
    expect(nameMatchVerdict(s)).not.toBe('match');
  });

  it('scores unrelated names as mismatch', () => {
    const s = nameMatchScore('Acme Cloud Ltd', 'Globex Manufacturing Ltd');
    expect(nameMatchVerdict(s)).toBe('mismatch');
  });

  it('tolerates a typo via edit distance', () => {
    const s = nameMatchScore('Acme Cloud', 'Acme Cloud');
    expect(nameMatchVerdict(s)).toBe('match');
  });
});
