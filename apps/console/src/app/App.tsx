/**
 * The root, and the whole of the two-designs law in eight lines.
 *
 * Two applications, one switch, no middle. Each is lazy so a phone in a yard
 * never downloads the desktop console's tables and a desk never downloads
 * the tab bar — and, more to the point, so that neither tree can quietly
 * start importing the other without it showing up in the bundle.
 *
 * Nothing below this line branches on screen width. If you find yourself
 * wanting to, you are writing the responsive compromise the law forbids;
 * the answer is a different component in the design that needs it.
 */

import { lazy, Suspense } from 'react';
import { useDesign } from './useDesign.js';
import { Booting } from './Booting.js';

const Desktop = lazy(async () => import('../desktop/DesktopApp.js'));
const Phone = lazy(async () => import('../phone/PhoneApp.js'));

export function App(): React.ReactElement {
  const design = useDesign();
  return (
    <Suspense fallback={<Booting />}>
      {design === 'desktop' ? <Desktop /> : <Phone />}
    </Suspense>
  );
}
