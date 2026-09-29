/**
 * Name matching for statutory cross-checks — the vendor's declared legal name vs the name a
 * registry (PAN/GST) returns, and bank-account holder vs PAN/GST name. Names are normalised
 * (strip Pvt/Ltd/punctuation/case) then scored; the score maps to a verdict via configurable
 * thresholds: auto-pass / manual review / fail (prompt §5).
 */

const NOISE_WORDS = new Set([
  'PVT',
  'PRIVATE',
  'LTD',
  'LIMITED',
  'LLP',
  'INC',
  'INCORPORATED',
  'CORP',
  'CORPORATION',
  'CO',
  'COMPANY',
  'AND',
  'THE',
  'M/S',
  'MS',
]);

/** Uppercase, drop punctuation and common company-form noise words, collapse whitespace. */
export function normalizeName(name: string): string {
  const cleaned = (name || '')
    .replace(/^\s*m\/?s\.?\s+/i, '') // strip a leading "M/s" (Messrs) prefix
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(' ').filter((t) => t && !NOISE_WORDS.has(t));
  return tokens.join(' ');
}

/** Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/**
 * Similarity score in [0,1] between two names, after normalisation. Combines a token-set
 * Jaccard (order-independent) with a character Levenshtein ratio; takes the stronger signal.
 */
export function nameMatchScore(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = union === 0 ? 0 : inter / union;

  const maxLen = Math.max(na.length, nb.length);
  const lev = maxLen === 0 ? 1 : 1 - levenshtein(na, nb) / maxLen;

  return Math.max(jaccard, lev);
}

export type NameMatchVerdict = 'match' | 'review' | 'mismatch';

export interface NameMatchThresholds {
  autoPass: number;
  review: number;
}
export const DEFAULT_NAME_THRESHOLDS: NameMatchThresholds = { autoPass: 0.85, review: 0.6 };

export function nameMatchVerdict(
  score: number,
  thresholds: NameMatchThresholds = DEFAULT_NAME_THRESHOLDS,
): NameMatchVerdict {
  if (score >= thresholds.autoPass) return 'match';
  if (score >= thresholds.review) return 'review';
  return 'mismatch';
}
