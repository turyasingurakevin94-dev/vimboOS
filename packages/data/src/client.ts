/**
 * The Supabase client.
 *
 * One per application, made at boot. The old app's equivalent held the whole
 * shop in memory and diffed it on every save; nothing here does that. A
 * screen asks for what it needs, and gets that.
 */

import { createClient } from '@supabase/supabase-js';
import { resolveProject, type Project } from './env.js';

/**
 * Typed as whatever `createClient` returns rather than as `SupabaseClient`.
 * The two are not the same generic instantiation, and writing the name out
 * by hand is how a client ends up `any` at the one boundary that matters.
 */
export type Client = ReturnType<typeof createClient>;

export interface Connection {
  readonly project: Project;
  readonly sb: Client;
}

let connection: Connection | null = null;

export function connect(env: Record<string, string | undefined>): Connection {
  connection ??= (() => {
    const project = resolveProject(env);
    return {
      project,
      sb: createClient(project.url, project.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    };
  })();
  return connection;
}

/** The live connection. Throws rather than returning a half-made client. */
export function current(): Connection {
  if (connection === null) {
    throw new Error('connect() has not been called — the app booted without a database');
  }
  return connection;
}
