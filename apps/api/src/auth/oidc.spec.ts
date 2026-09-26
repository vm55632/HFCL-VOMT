import { extractClaims } from './oidc.service';

describe('extractClaims', () => {
  it('uses default claim names when no mapping is given', () => {
    const c = extractClaims(
      { sub: 'abc', email: 'a@b.local', name: 'A B', groups: ['procurement'] },
      {},
    );
    expect(c).toMatchObject({ subject: 'abc', email: 'a@b.local', name: 'A B' });
    expect(c.groups).toEqual(['procurement']);
  });

  it('honours a custom mapping', () => {
    const c = extractClaims(
      { oid: 'x', upn: 'u@corp.local', displayName: 'U', roles: ['finance'], mgr: 'm@corp.local' },
      { subject: 'oid', email: 'upn', name: 'displayName', groups: 'roles', manager: 'mgr' },
    );
    expect(c.subject).toBe('x');
    expect(c.email).toBe('u@corp.local');
    expect(c.name).toBe('U');
    expect(c.groups).toEqual(['finance']);
    expect(c.manager).toBe('m@corp.local');
  });

  it('falls back to email for a missing name and yields empty groups', () => {
    const c = extractClaims({ sub: 's', email: 'only@b.local' }, {});
    expect(c.name).toBe('only@b.local');
    expect(c.groups).toEqual([]);
    expect(c.manager).toBeUndefined();
  });
});
