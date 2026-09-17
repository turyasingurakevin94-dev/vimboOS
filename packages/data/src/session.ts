/**
 * Who is signed in, and which shop's books they may see.
 *
 * ## The same accounts as the old app
 *
 * Email and password through Supabase auth — `shared-worker.js` does exactly
 * `sb.auth.signInWithPassword({email, password})`. There is no second user
 * table and no separate registration: the person signs into this app with
 * the credentials they already use, and both apps see the same session
 * store, so signing in here does not sign them out there.
 *
 * ## Why a shop, and not just a user
 *
 * Every table in the schema is `shop_id`-scoped and every policy runs
 * `is_shop_member(shop_id)`. A signed-in user with no row in `shop_members`
 * can authenticate perfectly and then read **nothing** — every query returns
 * an empty list rather than an error, which looks exactly like a shop with
 * no invoices. So membership is resolved once, at sign-in, and its absence
 * is reported as what it is.
 *
 * ## What this file may not do
 *
 * Write. `read-only.test.ts` holds the whole package to reads while the old
 * app still runs the business; `signInWithPassword` is an auth call, not a
 * row change, and the guard is scoped to PostgREST verbs for that reason.
 */

import { connect, type Client } from './client.js';
import { readText } from './boundary.js';
import type { Project } from './env.js';

export type Role = 'owner' | 'admin' | 'staff';

export interface Membership {
  readonly shopId: string;
  readonly shopName: string;
  readonly role: Role;
}

export interface Session {
  readonly userId: string;
  readonly email: string;
  /**
   * `null` when the account is real but belongs to no shop.
   *
   * This is not an edge case to swallow: RLS makes it look identical to a
   * shop where nothing has happened yet, and a screen that showed an empty
   * ledger for it would be lying about the books.
   */
  readonly shop: Membership | null;
}

/** What went wrong, in words a person can act on. */
export interface SignInFailure {
  readonly ok: false;
  readonly why: string;
}

export type SignInResult = { readonly ok: true; readonly session: Session } | SignInFailure;

const roleOf = (value: unknown): Role =>
  value === 'owner' || value === 'admin' ? value : 'staff';

/**
 * The shop this user belongs to.
 *
 * One query, joined, because `shop_members` and `shops` are both readable to
 * a member and asking twice invites the two answers to disagree. More than
 * one membership is possible in the schema; the first is taken and the rest
 * are ignored until there is a screen that lets someone choose, which there
 * is no mockup for.
 */
async function readMembership(sb: Client, userId: string): Promise<Membership | null> {
  const { data, error } = await sb
    .from('shop_members')
    .select('shop_id, role, shops(name)')
    .eq('user_id', userId)
    .limit(1);

  if (error !== null || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as unknown as Record<string, unknown>;
  const shopId = readText(row.shop_id);
  if (shopId === null) return null;

  // PostgREST returns an embedded one-to-one as an object, and older
  // versions as a single-element array. Both are read rather than assumed.
  const embedded: unknown = row.shops;
  const shop: unknown = Array.isArray(embedded) ? embedded[0] : embedded;
  const name =
    shop !== null && typeof shop === 'object'
      ? readText((shop as Record<string, unknown>).name)
      : null;

  return { shopId, shopName: name ?? 'this shop', role: roleOf(row.role) };
}

/** The session already stored in the browser, if there is a usable one. */
export async function resume(env: Record<string, string | undefined>): Promise<Session | null> {
  const { sb } = connect(env);
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (user === undefined) return null;
  return {
    userId: user.id,
    email: user.email ?? '',
    shop: await readMembership(sb, user.id),
  };
}

export async function signIn(
  env: Record<string, string | undefined>,
  email: string,
  password: string,
): Promise<SignInResult> {
  const { sb } = connect(env);
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });

  if (error !== null) {
    // Supabase's own wording is already the clearest account of what went
    // wrong ("Invalid login credentials", "Email not confirmed"), and
    // replacing it with something friendlier would hide which it was.
    return { ok: false, why: error.message };
  }
  /**
   * No null check on `data.user`: the SDK types it as present whenever
   * there is no error, and the lint rule is right that testing it is dead
   * code. The old app DOES check, but after `signUp` — where a project with
   * email confirmation on returns neither an error nor a usable session.
   * This app does not sign anyone up; accounts already exist.
   */
  const user = data.user;

  return {
    ok: true,
    session: {
      userId: user.id,
      email: user.email ?? email,
      shop: await readMembership(sb, user.id),
    },
  };
}

export async function signOut(env: Record<string, string | undefined>): Promise<void> {
  const { sb } = connect(env);
  await sb.auth.signOut();
}

/**
 * What the app should say when it cannot even try.
 *
 * `resolveProject` throws when the key is missing, deliberately — a build
 * that reached production by accident would be worse than one that refuses
 * to start. But an uncaught throw at boot is a white screen, and a white
 * screen is not a message. This turns it into one.
 */
export function describeConnection(
  env: Record<string, string | undefined>,
): { readonly ok: true; readonly project: Project } | SignInFailure {
  try {
    return { ok: true, project: connect(env).project };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) };
  }
}
