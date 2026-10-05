# Adam Foundation — merchandise QR landing page

Developer handover · 2 October 2026

## Open the page

Open `index.html` in a browser. No build step, package install, JavaScript framework, API or backend is needed. The three pillar sections use native HTML details/summary controls.

For a local HTTP preview, run this command from the folder and open http://localhost:8080:

```sh
python3 -m http.server 8080
```

## Files

- `index.html` — complete standalone page and editable content.
- `assets/css/styles.css` — responsive styles scoped to `#af-discover`.
- `assets/images/` — all four logos, event photograph, Westminster border and WhatsApp QR image.
- `links.json` — destination links in one reference list. Edit actual links in `index.html` when changing a destination; this JSON file is documentation, not runtime configuration.
- `references/` — the supplied brochure PDF, design reference image and image dimensions manifest. These are reference material and do not need to be deployed.

## Design and behaviour

The page is intended for people arriving by scanning a QR code on merchandise. It uses a white background, navy text, blue accents and a gold headline, following the supplied brochure. Each pillar retains its own logo colours.

The layout is mobile first, with a maximum content width of 510px. On larger screens the same landing page remains centred. The three expandable sections introduce Community Exchange, Avicenna Foundation and Adam Hub. All external destinations open in a new tab, with `rel="noopener noreferrer"`.

The WhatsApp button and tappable QR image both point to:

https://whatsapp.com/channel/0029VbDWNkVDuMRgS0HBpA2h

The QR image is extracted from the supplied PDF, and the destination above is taken from its associated PDF link. A separate scan of the QR payload has not been performed.

Instagram, LinkedIn, TikTok, X and the main website links are retained from the preview. This package does not collect contact details or include analytics, cookies or a consent-management service.

## Branding assets

The logo images, event photo and Westminster border used on the page are cropped from the supplied brochure design JPEG. They preserve the appearance shown in the latest preview. The source PDF is included for comparison, including its updated vertical Adam Hub mark.

These are raster extracts, not vector master logos. If master SVGs or high-resolution transparent PNGs are available, substitute those for production while preserving proportions, wording and colours. Do not redraw or recolour the marks. The page currently uses the horizontal Adam Hub mark shown in the selected design reference.

The stylesheet preserves the preview's styling cascade so the handover matches the design. It can be consolidated when integrating into the existing website. The implemented palette is white `#ffffff`, navy `#061238`, blue `#0055b8` / `#0055a7`, and gold `#ad8c60`. These are implementation colours matched visually to the reference, not a certified brand-guideline palette.

## Publish

1. Upload `index.html` and the `assets` folder to the chosen hosting path, preserving relative paths. Only these files are needed to serve the page.
2. A permanent path such as `https://adamfoundation.com/discover/` would suit the merchandise QR destination. This is a suggested route; it has not been created or deployed.
3. Point the QR printed on merchandise to that permanent page URL. The WhatsApp QR included here points directly to the WhatsApp channel and is a separate destination.
4. Before launch, check appearance at 320px, 390px, 768px and desktop widths; expand all pillars; open every external link; and scan the WhatsApp QR with a phone. Confirm text, logo sharpness and tap targets on iOS and Android.
5. If integrating into a CMS, move the page content into the chosen template and enqueue the stylesheet. Keep asset paths aligned with the deployed route.

## Validation completed

The package has been checked for a complete HTML document, local stylesheet and image references, readable image files, three expandable pillar sections, and matching WhatsApp button/QR link destinations. The ZIP is integrity checked.

A browser rendering check could not be completed in the preparation environment because a browser executable was unavailable. Live external destinations and QR scanning still need the short pre-launch check above. No deployment has been performed.
