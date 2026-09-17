/**
 * The door.
 *
 * Email and password, because that is what the old app uses and these are
 * the same accounts — signing in here does not sign anyone out there.
 *
 * **This is the one screen with no mockup**, and it is deliberately plain
 * for that reason: see the note at the head of `SignIn.module.css`.
 *
 * Two failures it refuses to hide. A build with no key cannot try at all,
 * and says that instead of showing a form that will never work. And an
 * account that signs in but belongs to no shop reads NOTHING through RLS —
 * which looks exactly like a shop where nothing has happened — so it is
 * named as what it is rather than left to look like an empty ledger.
 */

import { useState, type ReactElement } from 'react';
import { describeConnection, signIn, type Session } from '@ow/data';
import s from './SignIn.module.css';

export function SignIn({ onIn }: { readonly onIn: (session: Session) => void }): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const connection = describeConnection(import.meta.env);

  /**
   * `void` rather than `async`: a form's onSubmit is a void handler, and
   * handing it a promise means a rejection has nowhere to go. The work is
   * kicked off inside instead, where its own failure is caught.
   */
  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!connection.ok) return;
    void run();
  };

  const run = async (): Promise<void> => {
    setBusy(true);
    setProblem(null);
    const result = await signIn(import.meta.env, email, password).catch(
      (e: unknown): { ok: false; why: string } => ({
        ok: false,
        why: e instanceof Error ? e.message : 'Could not reach the database.',
      }),
    );
    setBusy(false);
    if (!result.ok) {
      setProblem(result.why);
      return;
    }
    if (result.session.shop === null) {
      // Authenticating and being allowed to read are different things here.
      setProblem(
        `Signed in as ${result.session.email}, but this account is not a member of any shop. ` +
          'Every table is shop-scoped, so it would show empty books rather than an error. ' +
          'An owner or admin needs to add it in Setup → Staff.',
      );
      return;
    }
    onIn(result.session);
  };

  return (
    <div className={s.page}>
      <div className={s.panel}>
        <div className={s.brand}>
          <span className={s.mark} aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35" />
            </svg>
          </span>
          {/* A non-breaking hyphen: "Omni-Ware" must never wrap mid-name. */}
          <span className={s.name}>Omni&#8209;Ware</span>
        </div>

        <form className={s.card} onSubmit={submit}>
          <div className={s.title}>Sign in</div>
          <p className={s.sub}>
            The same email and password you use in the current app. This one only reads the
            books — nothing you do here can change them yet.
          </p>

          {!connection.ok ? (
            <div className={s.problem}>{connection.why}</div>
          ) : (
            <>
              <label className={s.label} htmlFor="ow-email">
                Email
              </label>
              <input
                id="ow-email"
                className={s.field}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label className={s.label} htmlFor="ow-password">
                Password
              </label>
              <input
                id="ow-password"
                className={s.field}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {problem !== null && <div className={s.problem}>{problem}</div>}

              <button
                type="submit"
                className={s.go}
                disabled={busy || email.trim() === '' || password === ''}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </>
          )}
        </form>

        {connection.ok && (
          <div className={connection.project.name === 'production' ? s.targetLive : s.target}>
            {connection.project.name === 'production'
              ? "Reading the shop's real books"
              : 'Reading the staging database'}
          </div>
        )}

        {/* Named rather than hidden. Most screens have no data path yet, and
            a login wall in front of them would hide the work without
            protecting anything. */}
        <div className={s.target}>
          <a className={s.look} href="?demo=1">
            Look around with example data
          </a>
        </div>
      </div>
    </div>
  );
}
