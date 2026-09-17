import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';

/**
 * Stamp the build with the repository and commit it came from.
 *
 * ## Why this exists
 *
 * "The live site is not loading the new edits" is not answerable by looking
 * at the page. Two ground-up rebuilds of this app existed in one account at
 * once, and the Vercel project was serving the other one — a *different
 * repository* — while looking close enough to be plausible. Comparing
 * screenshots could not settle it; only reading the source could.
 *
 * So the deployed page says what it is. `/build.txt` answers it in one
 * request, with no devtools and no view-source:
 *
 *     curl https://<the-domain>/build.txt
 *
 * ## Where the values come from
 *
 * Vercel sets `VERCEL_GIT_*` during a build, and those are authoritative
 * because they describe what Vercel actually checked out — which is exactly
 * the fact in doubt. Locally there is no Vercel, so it asks git. If both
 * fail the stamp still renders, with `unknown` in the gaps, because a build
 * that dies over its own provenance note would be a worse failure than the
 * one this prevents.
 */

const ask = (cmd: string): string | null => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
};

export interface BuildStamp {
  readonly repo: string;
  readonly sha: string;
  readonly ref: string;
  readonly builtAt: string;
}

export function readStamp(): BuildStamp {
  const env = process.env;
  const remote = ask('git config --get remote.origin.url');
  return {
    repo:
      env['VERCEL_GIT_REPO_SLUG'] !== undefined && env['VERCEL_GIT_REPO_OWNER'] !== undefined
        ? `${env['VERCEL_GIT_REPO_OWNER']}/${env['VERCEL_GIT_REPO_SLUG']}`
        : (remote?.replace(/^.*[/:]([^/]+\/[^/]+?)(?:\.git)?$/, '$1') ?? 'unknown'),
    sha: (env['VERCEL_GIT_COMMIT_SHA'] ?? ask('git rev-parse HEAD') ?? 'unknown').slice(0, 7),
    ref: env['VERCEL_GIT_COMMIT_REF'] ?? ask('git rev-parse --abbrev-ref HEAD') ?? 'unknown',
    builtAt: new Date().toISOString(),
  };
}

export const format = (s: BuildStamp): string => `${s.repo}@${s.sha} (${s.ref}) ${s.builtAt}`;

export function buildStamp(): Plugin {
  const stamp = readStamp();
  const line = format(stamp);

  return {
    name: 'ow-build-stamp',

    transformIndexHtml() {
      return [
        // A meta tag rather than visible chrome: the mockup is the design,
        // and nothing in the handoff draws a version string on the screen.
        { tag: 'meta', attrs: { name: 'ow-build', content: line }, injectTo: 'head' },
      ];
    },

    generateBundle() {
      // Vercel matches the filesystem before it applies a rewrite, so this
      // survives the `/(.*)` → `/index.html` catch-all that swallows every
      // other unknown path.
      this.emitFile({
        type: 'asset',
        fileName: 'build.txt',
        source: `${line}\n`,
      });
    },
  };
}
