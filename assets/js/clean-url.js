// Tidies the address bar. Google's tag on adamfoundation.com adds
// ?_gl=1*…*_gcl_au*… to every link to this subdomain, and ads and social apps add
// their own click IDs. Nothing on this site reads them (it has no analytics, and
// the two sites already share cookies as subdomains of adamfoundation.com), so
// they come off the address bar as soon as the page opens. ?src= and utm_* stay.
// If analytics is ever added to these pages, load it before this script or drop
// the matching names from the list.
(() => {
  const TRACKING = ['_gl', '_ga', 'gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'];
  const url = new URL(location.href);
  const found = TRACKING.filter((name) => url.searchParams.has(name));
  if (!found.length) return;
  found.forEach((name) => url.searchParams.delete(name));
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
})();
