/**
 * Who owns this copy of the game (and so sees the Admin panel).
 *
 * - On the claude.ai link: the platform says whether the viewer owns the
 *   artifact (`user.isOwner()`, no extra permission needed).
 * - Anywhere else there are no accounts, so the owner is whoever runs it on
 *   their own machine: the double-clicked file, or the dev/relay server opened
 *   on the computer running it (localhost). Other devices on the network,
 *   joining through the relay server, are not the owner.
 *
 * Admin tools only change this device's own game: progression saved here, and
 * matches this device simulates (solo, or online as the host). A guest in
 * someone else's match can never use them on that match.
 */

export const owner = { is: false, how: '', checked: false, onChange: null };

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '']);

export async function detectOwner() {
  let is = false, how = '';
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const user = await Promise.race([window.claude.use('user'), new Promise((r) => setTimeout(() => r(null), 10000))]);
      is = user ? !!(await user.isOwner()) : false;
      how = 'you own this game link';
    } else if (location.protocol === 'file:' || LOCAL.has(location.hostname)) {
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
