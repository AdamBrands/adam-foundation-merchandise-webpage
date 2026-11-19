// Shows a connect page inside a page on adamfoundation.com, with tracking and
// donations working as they do on connect.adamfoundation.com. In an Elementor
// HTML widget:
//
//   <div data-adam-connect="donate"></div>
//   <script src="https://connect.adamfoundation.com/assets/js/embed.js" defer></script>
//
// data-adam-connect is one of home, donate, masjids, bottle or ourplanet.
//
// - ?src= (or ?source=) on the WordPress page is passed to the frame, so visits
//   and submissions are credited to the QR code or campaign link. The frame
//   can't read the parent page's address itself.
// - The frame is as tall as the window and scrolls inside, so the pages' forms
//   and dialogs behave as they do on their own.
// - Stripe Checkout won't open inside a frame. The page asks this script to
//   open it in the whole tab instead, and Stripe sends the donor back to this
//   WordPress page with ?donation=…&session_id=…, which is passed to the frame
//   to show the outcome.
(() => {
  const script = document.currentScript;
  const origin = new URL(script.src).origin;
  const PATHS = { home: '/', donate: '/donate', masjids: '/masjids', bottle: '/bottle', ourplanet: '/ourplanet' };
  const PASSED = ['src', 'source', 'donation', 'session_id'];
  const RETURN = ['donation', 'session_id'];

  const here = new URL(location.href);
  const frames = [];

  document.querySelectorAll('[data-adam-connect]').forEach((holder) => {
    const path = PATHS[holder.dataset.adamConnect];
    if (!path || holder.querySelector('iframe')) return;
    const url = new URL(path, origin);
    PASSED.forEach((name) => {
      if (here.searchParams.has(name)) url.searchParams.set(name, here.searchParams.get(name));
    });
    url.searchParams.set('embed', `${here.origin}${here.pathname}`);

    const frame = document.createElement('iframe');
    frame.src = url.href;
    frame.title = holder.dataset.title || 'Adam Foundation';
    frame.loading = 'eager';
    frame.style.cssText = 'display:block;width:100%;height:100vh;height:100dvh;border:0';
    holder.append(frame);
    frames.push(frame);
  });
  if (!frames.length) return;

  // The donation outcome has been handed to the frame: take it off this page's address.
  if (RETURN.some((name) => here.searchParams.has(name))) {
    RETURN.forEach((name) => here.searchParams.delete(name));
    history.replaceState(history.state, '', here.pathname + here.search + here.hash);
  }

  // Open Stripe Checkout in the whole tab when one of our frames asks.
  addEventListener('message', (event) => {
    if (event.origin !== origin || event.data?.type !== 'adam-connect:checkout') return;
    if (!frames.some((frame) => frame.contentWindow === event.source)) return;
    let url;
    try {
      url = new URL(event.data.url);
    } catch {
      return;
    }
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') return;
    event.source.postMessage({ type: 'adam-connect:leaving' }, origin);
    location.assign(url.href);
  });
})();
