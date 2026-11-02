// Adhkar book form: sends the request without leaving the page and shows the
// confirmation in place. Without JavaScript the form still posts normally.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#af-discover .book-form');
  if (!form) return;

  // QR codes arrive as /?src=<code> (see api/scan.js).
  const src = new URLSearchParams(location.search).get('src');
  if (src && /^[a-z0-9-]{1,40}$/.test(src)) form.elements.source.value = src;

  // The button hides once the form is open, so move focus to the email field.
  form.closest('details').addEventListener('toggle', (event) => {
    if (event.target.open) form.elements.email.focus();
  });

  const status = form.querySelector('.book-status');
  const button = form.querySelector('button[type="submit"]');
  const done = document.querySelector('#af-discover .book-done');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Sending…';

    let data = {};
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: form.elements.email.value,
          marketing: form.elements.marketing.checked,
          source: form.elements.source.value,
          website: form.elements.website.value,
        }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
    } catch {
      status.textContent = data.message || 'Something went wrong. Please check your connection and try again.';
      button.disabled = false;
      return;
    }

    if (data.emailed === false) done.querySelector('h3').textContent = 'Thank you';
    done.querySelector('.book-done-text').textContent = data.message;
    form.closest('details').hidden = true;
    done.hidden = false;
    done.focus();
  });
});
