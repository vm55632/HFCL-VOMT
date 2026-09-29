import { detectFileType } from './filetype';

const bytes = (...arr: number[]) => Uint8Array.from(arr);

describe('detectFileType', () => {
  it('detects PDF by %PDF', () => {
    expect(detectFileType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('pdf');
  });
  it('detects JPEG by FF D8 FF', () => {
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
  });
  it('detects PNG by its 8-byte signature', () => {
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
  });
  it('rejects a spoofed file (wrong magic bytes)', () => {
    // e.g. a script renamed .pdf — content does not match any allowed type
    expect(detectFileType(bytes(0x3c, 0x3f, 0x70, 0x68, 0x70))).toBeNull(); // <?php
  });
  it('rejects an empty/too-short buffer', () => {
    expect(detectFileType(bytes(0x25, 0x50))).toBeNull();
  });
});
