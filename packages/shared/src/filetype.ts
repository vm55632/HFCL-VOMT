/**
 * File-type detection by magic bytes — never trust the extension or the client-supplied MIME
 * type. Uploads are restricted to a configurable allow-list (PDF/JPG/PNG by default). Uses
 * Uint8Array so it is usable on both server and browser.
 */

export type AllowedFileType = 'pdf' | 'jpg' | 'png';

export const ALLOWED_MIME: Record<AllowedFileType, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

export const ALLOWED_EXTENSION: Record<AllowedFileType, string> = {
  pdf: 'pdf',
  jpg: 'jpg',
  png: 'png',
};

/** Detect the real type from the leading bytes, or null if it is not an allowed type. */
export function detectFileType(bytes: Uint8Array): AllowedFileType | null {
  const b = bytes;
  // %PDF
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return 'pdf';
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}
