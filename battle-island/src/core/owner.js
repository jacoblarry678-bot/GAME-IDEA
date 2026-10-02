/**
 * Who owns this copy of the game (and so sees the Admin panel).
 *
 * - On the claude.ai link: the platform says whether the viewer owns the
 *   artifact (`user.isOwner()`, no extra permission needed).
 * - Anywhere else there are no accounts, so the owner is whoever runs it on
 *   their own machine, opened directly (not inside another page): the
 *   double-clicked file, or the dev/relay server opened on the computer
 *   running it (localhost). Other devices on the network, joining through the
 *   relay server, are not the owner, and neither is any embedded or sandboxed
 *   copy (those report a blank hostname).
 *
 * Admin tools only change this device's own game: progression saved here, and
 * matches this device simulates (solo, or online as the host). A guest in
 * someone else's match can never use them on that match.
 */

export const owner = { is: false, how: '', checked: false, onChange: null };

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function framed() {
  try {
    return window.self !== window.top;
  } catch {
    return true; // a cross-origin parent: we're embedded somewhere
  }
}

/** The claude.ai runtime, if this page runs inside it (it can attach a moment after load). */
async function claudeRuntime() {
  for (let i = 0; i < 30; i++) {
    if (window.claude && typeof window.claude.use === 'function') return window.claude;
    if (!framed()) return null; // opened directly: no runtime is coming
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

export async function detectOwner() {
  let is = false, how = '';
  try {
    const rt = await claudeRuntime();
    if (rt) {
      // the platform is the only authority on the claude.ai link
      const user = await Promise.race([rt.use('user'), new Promise((r) => setTimeout(() => r(null), 10000))]);
      is = user ? (await user.isOwner()) === true : false;
      how = 'you own this game link';
    } else if (!framed() && (location.protocol === 'file:' || LOCAL.has(location.hostname))) {
      // no accounts: the owner is whoever opens it directly on their own computer.
      // Embedded or sandboxed copies (blank hostname, someone else's page) never count.
      is = true;
      how = 'running on this computer';
    }
  } catch {
    is = false;
  }
  owner.is = is;
  owner.how = is ? how : '';
  owner.checked = true;
  owner.onChange?.();
  return is;
}
