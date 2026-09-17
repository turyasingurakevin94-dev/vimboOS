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
      'VITE_OW_SUPABASE_KEY is not set. Put the publishable (anon) key for the ' +
        `${target} project in .env.local. It is a public key — but it is not ` +
        'committed, so that pointing a build at production is always a ' +
        'deliberate act.',
    );
  }

  return {
    name: target,
    url: target === 'production' ? PRODUCTION_URL : STAGING_URL,
    publishableKey: key,
  };
}

/** True when this build is writing to the shop's real books. */
export const isProduction = (p: Project): boolean => p.name === 'production';
