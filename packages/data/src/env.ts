/**
 * Which database this build talks to.
 *
 * The old app defaults every unknown host to PRODUCTION, deliberately: a
 * half-finished switch there would have pointed the live shop at an empty
 * database, and that failure is silent until a stock count comes out wrong.
 *
 * **This app defaults the other way, and the reason is the opposite one.**
 * It is a rewrite under construction. Nothing in here has earned the real
 * books yet, and a screen that is wrong about staging costs nothing while a
 * screen that is wrong about production costs the shop money. So production
 * is never reached by accident: it takes an explicit environment variable,
 * set on one deployment, on purpose.
 */

export interface Project {
  readonly name: 'production' | 'staging';
  readonly url: string;
  readonly publishableKey: string;
}

const STAGING_URL = 'https://lmmyzhqdxixjnkkkgnnu.supabase.co';
const PRODUCTION_URL = 'https://hgywjaifdmgrcnwxstxg.supabase.co';

const refOf = (url: string): string => url.replace(/^https:\/\/([^.]+)\..*$/, '$1');

/**
 * Whether a key is safe to put in a browser.
 *
 * Supabase issues two kinds, and they look similar enough to paste by
 * mistake. A **publishable** key is public by design — it is meant to ship
 * in the bundle, and RLS is what protects the data behind it. A **secret**
 * key bypasses RLS entirely: shipped to a browser it hands every visitor
 * the whole database, and it cannot be un-shipped once a build is cached.
 *
 * Both formats are read. The modern one says which it is in its prefix
 * (`sb_publishable_` / `sb_secret_`); the legacy one is a JWT whose `role`
 * claim says `anon` or `service_role`.
 */
export type KeyKind = 'publishable' | 'secret' | 'unrecognised';

interface KeyFacts {
  readonly kind: KeyKind;
  /**
   * Which project the key is for, when the key says.
   *
   * A legacy JWT carries a `ref` claim, so a key for one project and a URL
   * for another can be caught before the first request. A modern
   * `sb_publishable_` key carries nothing — it is opaque — so with one of
   * those the URL is the ONLY thing deciding which books get opened, and
   * `VITE_OW_TARGET` had better be right.
   */
  readonly ref: string | null;
}

export function readKey(key: string): KeyFacts {
  if (key.startsWith('sb_secret_')) return { kind: 'secret', ref: null };
  if (key.startsWith('sb_publishable_')) return { kind: 'publishable', ref: null };

  const body = key.split('.')[1];
  if (body === undefined) return { kind: 'unrecognised', ref: null };
  try {
    const claims = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: unknown;
      ref?: unknown;
    };
    const ref = typeof claims.ref === 'string' ? claims.ref : null;
    if (claims.role === 'service_role') return { kind: 'secret', ref };
    if (claims.role === 'anon') return { kind: 'publishable', ref };
    return { kind: 'unrecognised', ref };
  } catch {
    return { kind: 'unrecognised', ref: null };
  }
}

/**
 * Resolve the project from the build's environment.
 *
 * `OW_TARGET=production` is the whole of the opt-in, and the key is never
 * committed — it comes from `VITE_OW_SUPABASE_KEY` on the deployment. A
 * missing key throws at boot rather than producing a client that fails every
 * query with a 401 nobody can read.
 */
export function resolveProject(env: Record<string, string | undefined>): Project {
  const target = env.VITE_OW_TARGET === 'production' ? 'production' : 'staging';
  const key = env.VITE_OW_SUPABASE_KEY;

  if (key === undefined || key.trim() === '') {
    throw new Error(
      'VITE_OW_SUPABASE_KEY is not set. Put the publishable key for the ' +
        `${target} project in .env.local — either the modern ` +
        '`sb_publishable_…` or the legacy anon JWT. It is a public key — but ' +
        'it is not committed, so that pointing a build at production is ' +
        'always a deliberate act.',
    );
  }

  const url = target === 'production' ? PRODUCTION_URL : STAGING_URL;
  const facts = readKey(key.trim());

  if (facts.kind === 'secret') {
    throw new Error(
      'VITE_OW_SUPABASE_KEY is a SECRET key. It bypasses row-level security, ' +
        'and this value is compiled into the browser bundle — shipping it ' +
        'would hand every visitor the whole database, and a cached build ' +
        'cannot be un-shipped. Use the publishable key instead, and rotate ' +
        'this one.',
    );
  }

  if (facts.kind === 'unrecognised') {
    throw new Error(
      'VITE_OW_SUPABASE_KEY is neither an `sb_publishable_…` key nor an anon ' +
        'JWT. Rather than send an unknown credential to the database, this ' +
        'build refuses to start.',
    );
  }

  // A legacy key names its project, so the commonest mistake — the right key
  // for the wrong target — is caught here instead of as a 401 on every
  // query, which reads like the database being down.
  if (facts.ref !== null && facts.ref !== refOf(url)) {
    throw new Error(
      `VITE_OW_SUPABASE_KEY belongs to project ${facts.ref}, but VITE_OW_TARGET ` +
        `is ${target}, which is ${refOf(url)}. One of the two is wrong; every ` +
        'request would fail with a 401 that looks like an outage.',
    );
  }

  return { name: target, url, publishableKey: key.trim() };
}

/** True when this build is writing to the shop's real books. */
export const isProduction = (p: Project): boolean => p.name === 'production';
