// Kawthar illustration animations (Donate, Masjids and Corporate): the refill
// cycle, the disposable habit and, on Donate, the growing grain.
//
// The comms team's design script, without its per-illustration pause/play
// buttons, which aren't used on the live site. Each illustration still only
// moves while it is on screen and the tab is visible. With "reduce motion"
// switched on, without JavaScript, or when printed, the complete static
// illustration shows instead. The animations themselves are CSS, in each
// page's styles.css (kawthar-motion-styles).
(() => {
  'use strict';
  const roots = Array.from(document.querySelectorAll('[data-kw-motion]'));
  if (!roots.length) return;
  const preference = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const hasObserver = typeof window.IntersectionObserver === 'function';
  const inView = new Map(roots.map((root) => [root, false]));

  function onScreen(root) {
    const box = root.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight;
  }

  function render(root) {
    const reduced = preference.matches;
    const visible = inView.get(root) && !root.closest('[hidden]') && document.visibilityState !== 'hidden';
    if (reduced) root.classList.remove('kw-motion-ready');
    else if (visible) root.classList.add('kw-motion-ready');
    root.dataset.motionRunning = String(visible && !reduced);
  }

  function refresh() {
    roots.forEach((root) => {
      if (!hasObserver) inView.set(root, onScreen(root));
      render(root);
    });
  }

  if (hasObserver) {
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        inView.set(entry.target, entry.isIntersecting && entry.intersectionRatio > 0);
        render(entry.target);
      });
    }, { threshold: [0, 0.1] });
    roots.forEach((root) => observer.observe(root));
  } else {
    window.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
  }

  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', refresh);
  if (typeof preference.addEventListener === 'function') preference.addEventListener('change', refresh);
  else if (typeof preference.addListener === 'function') preference.addListener(refresh);
  refresh();
})();
