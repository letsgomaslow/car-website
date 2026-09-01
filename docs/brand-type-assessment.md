# Central Auto Repair logo and typography assessment

## Authoritative assets

- **Official source:** `site/assets/images/central-auto-repair-logo.jpg`
- **Source location:** the profile picture on `https://www.instagram.com/central.autorepair/`
- **Source dimensions:** 1024×1024 JPEG
- **Authority:** user-declared official logo
- **Website adaptation:** `site/assets/images/central-auto-repair-logo-transparent.png`, 1024×1024 RGBA PNG
- **Dark-surface variant:** `site/assets/images/central-auto-repair-logo-dark.png`, 1024×1024 RGBA PNG

The original JPEG remains untouched. The transparent adaptation was produced deterministically from that file. Only border-connected near-white background pixels were converted to alpha; the logo was not generated, redrawn, recolored, cropped, or rescaled.

The dark-surface variant is a user-directed selective colorway. The gear, skyline buildings, and black panel behind `AUTO REPAIR` are white; the car, tires, wrench, `CENTRAL` plaque, red accents, geometry, canvas dimensions, and alpha channel remain unchanged.

## Measured visual tokens

- Dominant palette: black, white, cool silver/gray, and red.
- Representative high-frequency red sampled from the raster: approximately `#E00808`.
- Composition: upper gear and skyline, central performance-car silhouette, road/wrench base, and stacked wordmark.
- Contrast behavior: the black outer geometry and white/silver internal details read best on a deep charcoal surface rather than a light card.

The sampled red is a measured reference from a compressed raster, not a formal source-declared brand color.

## Typography findings

The exact logo font cannot be established from pixels alone.

- **CENTRAL:** visually observed as a very heavy, condensed, squared display face with automotive/sport styling and a metallic bevel treatment.
- **AUTO REPAIR:** visually observed as a wide-tracked geometric uppercase sans serif.
- **Confidence:** visual classification only; neither line is identified as an exact typeface.

### Selected website pairing

- **Display:** Saira Condensed, weights 600–900
- **Body and utility:** Manrope, weights 400–800

Saira Condensed repeats the logo's compressed, technical proportions without trying to imitate its bevel or turn every heading into a second logo. Manrope provides a calmer, high-x-height counterpoint for descriptions, hours, search, directions, and the long service catalog. Both families are currently available through Google Fonts.

The previous Barlow Semi Condensed and Manrope pairing was readable, but Barlow's softer humanist forms did not connect as closely to the squared logo lettering. Saira Condensed is the stronger bridge between the official mark and the existing Bayline-inspired industrial layout.

## Safe extension rules

- Preserve the official logo's geometry and colors.
- Use `central-auto-repair-logo-dark.png` on charcoal or black surfaces; do not put it back inside a white tile.
- Keep `central-auto-repair-logo-transparent.png` as the unrecolored transparent master rather than overwriting it.
- Keep the adjacent live-text business name in compact navigation because the detailed embedded wordmark cannot remain fully legible at icon size.
- Use Saira Condensed for headings, navigation, labels, and strong numerals only.
- Use Manrope for paragraphs, service descriptions, addresses, and controls.
- Avoid aggressive negative tracking. Website headings use neutral-to-slightly-positive tracking so the condensed forms do not appear glued together.
- Do not add bevels, metallic gradients, or racing effects to ordinary website text. Those treatments belong to the official mark only.
