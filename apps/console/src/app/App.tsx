/**
 * The root: a session, then one of two designs.
 *
 * Two applications, one switch, no middle. Each is lazy so a phone in a yard
 * never downloads the desktop console's tables and a desk never downloads
 * the tab bar — and, more to the point, so that neither tree can quietly
 * start importing the other without it showing up in the bundle.
 *
 * Nothing below this line branches on screen width. If you find yourself
 * wanting to, you are writing the responsive compromise the law forbids;
 * the answer is a different component in the design that needs it.
 *
 * ## Looking around without signing in
 *
 * `?demo=1` skips the door and runs every screen on example data. It exists
 * because 24 of the 27 destinations have no data path yet, and reviewing a
 * design is still the main activity here — a login wall in front of screens
 * that have nothing to fetch would hide the work without protecting
 * anything. The door says so in words rather than hiding the flag, and the
 * screenshot and deploy harnesses use it, so a change that breaks a screen
 * is still caught by CI.
 *
 * ## The session comes first, and it is resolved before anything renders
 *
 * Every table in the schema is `shop_id`-scoped behind RLS. A screen that
 * mounted before the session was known would fire its queries as an
 * anonymous user, get empty lists back — not errors, empty lists — and draw
 * a shop where nothing has ever happened. So `Booting` holds the door until
 * `resume()` has answered.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { resume, type Session } from '@ow/data';
import { useDesign } from './useDesign.js';
import { Booting } from './Booting.js';
import { SignIn } from './SignIn.js';

const Desktop = lazy(async () => import('../desktop/DesktopApp.js'));
const Phone = lazy(async () => import('../phone/PhoneApp.js'));

type Who =
  | { readonly at: 'asking' }
  | { readonly at: 'out' }
  | { readonly at: 'demo' }
  | { readonly at: 'in'; readonly session: Session };

const wantsDemo = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

export function App(): React.ReactElement {
  const design = useDesign();
  const [who, setWho] = useState<Who>(() => (wantsDemo() ? { at: 'demo' } : { at: 'asking' }));

  useEffect(() => {
    if (wantsDemo()) return;
    let live = true;
    void (async () => {
      // A missing key throws in `connect()`. The door says so in words —
      // it is the only screen that can, and a white page is not a message.
      const session = await resume(import.meta.env).catch(() => null);
      if (live) setWho(session === null ? { at: 'out' } : { at: 'in', session });
    })();
    return () => {
      live = false;
    };
  }, []);

  if (who.at === 'asking') return <Booting />;
  if (who.at === 'out') return <SignIn onIn={(session) => setWho({ at: 'in', session })} />;

  return (
    <Suspense fallback={<Booting />}>
      {design === 'desktop' ? <Desktop /> : <Phone />}
    </Suspense>
  );
}
