// Friendly names for QR codes and ?src= codes in the report. Each printed QR encodes
// https://connect.adamfoundation.com/q/<code>. Codes not listed here are still
// recorded and appear in the report under their code.
export const SOURCE_LABELS = {
  direct: 'Direct visits (no QR code)',
  test: 'Test scans',
  'website-homepage': 'adamfoundation.com homepage button',
  'kawthar-donate': 'No source tag',
  'kawthar-masjids': 'No source tag',
  'kawthar-bottle': 'No source tag',
  'kawthar-corporate': 'No source tag',
};

export const sourceLabel = (code) => SOURCE_LABELS[code] || code;
