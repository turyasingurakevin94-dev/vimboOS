import { describe, expect, it } from 'vitest';
import { readKey, resolveProject } from './env.js';

/** A legacy key, built the way Supabase builds one, so `ref` is real. */
const jwt = (role: string, ref: string): string => {
  const b64 = (o: unknown): string =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', ref, role })}.sig`;
};

const PROD = 'hgywjaifdmgrcnwxstxg';
const STAGE = 'lmmyzhqdxixjnkkkgnnu';

describe('telling a publishable key from a secret one', () => {
  it.each([
    ['sb_publishable_KsUIBYzuZRdoPsqP4T2ULw__AsCEhzV', 'publishable'],
    ['sb_secret_pretend', 'secret'],
    [jwt('anon', PROD), 'publishable'],
    [jwt('service_role', PROD), 'secret'],
    ['not-a-key', 'unrecognised'],
    ['', 'unrecognised'],
  ])('reads %s as %s', (key, kind) => {
    expect(readKey(key).kind).toBe(kind);
  });

  it('gets the project out of a legacy key, and admits a modern one has none', () => {
    expect(readKey(jwt('anon', PROD)).ref).toBe(PROD);
    // `sb_publishable_…` is opaque. With one of these the target env var is
    // the ONLY thing deciding which books get opened.
    expect(readKey('sb_publishable_KsUIBYzuZRdoPsqP4T2ULw__AsCEhzV').ref).toBeNull();
  });
});

describe('what the build refuses to start with', () => {
  it('REFUSES a secret key, whichever format it is in', () => {
    // It bypasses RLS and this value is compiled into the bundle. A cached
    // build cannot be un-shipped.
    for (const key of ['sb_secret_pretend', jwt('service_role', PROD)]) {
      expect(() => resolveProject({ VITE_OW_SUPABASE_KEY: key })).toThrow(/SECRET key/);
    }
  });

  it('refuses a credential it cannot recognise at all', () => {
    expect(() => resolveProject({ VITE_OW_SUPABASE_KEY: 'hunter2' })).toThrow(/refuses to start/);
  });

  it('says which variable is missing rather than failing at the first query', () => {
    expect(() => resolveProject({})).toThrow(/VITE_OW_SUPABASE_KEY is not set/);
  });

  it('CATCHES the right key pointed at the wrong project', () => {
    // The mistake actually made: a production key with the default target.
    // Every request would 401, which reads like the database being down.
    expect(() =>
      resolveProject({ VITE_OW_SUPABASE_KEY: jwt('anon', PROD) }),
    ).toThrow(/belongs to project hgywjaifdmgrcnwxstxg, but VITE_OW_TARGET is staging/);

    expect(() =>
      resolveProject({ VITE_OW_SUPABASE_KEY: jwt('anon', STAGE), VITE_OW_TARGET: 'production' }),
    ).toThrow(/belongs to project lmmyzhqdxixjnkkkgnnu, but VITE_OW_TARGET is production/);
  });

  it('cannot catch it for a modern key, and does not pretend to', () => {
    // Opaque: nothing in the key contradicts either target, so both resolve.
    const key = 'sb_publishable_KsUIBYzuZRdoPsqP4T2ULw__AsCEhzV';
    expect(resolveProject({ VITE_OW_SUPABASE_KEY: key }).name).toBe('staging');
    expect(resolveProject({ VITE_OW_SUPABASE_KEY: key, VITE_OW_TARGET: 'production' }).name).toBe(
      'production',
    );
  });
});

describe('which books a build opens', () => {
  const key = 'sb_publishable_KsUIBYzuZRdoPsqP4T2ULw__AsCEhzV';

  it('defaults to staging, because nothing here has earned the real books', () => {
    const p = resolveProject({ VITE_OW_SUPABASE_KEY: key });
    expect(p.name).toBe('staging');
    expect(p.url).toContain(STAGE);
  });

  it('reaches production only on an exact, deliberate opt-in', () => {
    expect(resolveProject({ VITE_OW_SUPABASE_KEY: key, VITE_OW_TARGET: 'PRODUCTION' }).name).toBe(
      'staging',
    );
    expect(resolveProject({ VITE_OW_SUPABASE_KEY: key, VITE_OW_TARGET: 'prod' }).name).toBe(
      'staging',
    );
    expect(resolveProject({ VITE_OW_SUPABASE_KEY: key, VITE_OW_TARGET: 'production' }).url).toContain(
      PROD,
    );
  });

  it('trims a key pasted with a stray newline', () => {
    expect(resolveProject({ VITE_OW_SUPABASE_KEY: `  ${key}\n` }).publishableKey).toBe(key);
  });
});
