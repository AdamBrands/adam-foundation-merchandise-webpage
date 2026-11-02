// Friendly names for QR codes in the report. Each printed QR encodes
// https://connect.adamfoundation.com/q/<code>. Codes not listed here are still
// recorded and appear in the report under their code.
export const SOURCE_LABELS = {
  direct: 'Direct visits (no QR code)',
  test: 'Test scans',
};

export const sourceLabel = (code) => SOURCE_LABELS[code] || code;
