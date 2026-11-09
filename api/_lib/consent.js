// Must match the checkbox wording in index.html. Bump the version whenever
// the wording changes, so each stored request shows what the person saw.
export const CONSENT_VERSION = '2026-11-v2';
export const CONSENT_TEXT =
  'Yes, keep me inspired! I’d like to receive email updates about Adam Foundation’s news, events and campaigns.';

// Kawthar pages (/donate, /masjids, /bottle, /corporate): each shows its own
// "updates" wording, AUDIENCE_UPDATES in kawthar/assets/forms.js, versioned by
// AUDIENCE_CONSENT_VERSION there (the page scripts need it too). Rows from the
// removed /kawthar page keep their own version, '2026-11-kawthar-v1'.
export { AUDIENCE_CONSENT_VERSION } from '../../kawthar/assets/forms.js';
