# Central Auto Repair UI/UX concepts

Open `index.html` to compare three standalone homepage directions. Each page uses only HTML, CSS, inline SVG, and a small amount of vanilla JavaScript.

## Concepts

1. **Bayline** — industrial and cinematic. Best when the shop can supply strong real photography and wants an assertive performance-influenced look.
2. **Signal** — bright and diagnostic-led. Best for leading with clarity, warning-light concerns, and TPMS programming as a local search differentiator.
3. **Local Mile** — warm and neighborhood-oriented. Best for a more personal independent-shop voice, local familiarity, and low-pressure service intake.

## Preview

You can open `index.html` directly, or run a local server from the project root:

```bash
python3 -m http.server 4173 --directory prototypes --bind 127.0.0.1
```

Then visit `http://127.0.0.1:4173`.

## Important prototype boundaries

- The phone number and address are taken from the current Google Maps listing used during discovery.
- Services, hours, business identity, photos, and intake workflow still require client confirmation.
- The request form in Local Mile is deliberately non-functional and does not send data.
- The concepts include TPMS programming/relearn language and do not publish the excluded competitor services.
- Real shop, technician, and vehicle photography should replace the illustrative placeholders in the selected direction.

## Verification

`tests/test_prototypes.cjs` checks both mobile and desktop rendering for page errors, console errors, horizontal overflow, heading structure, mobile menu behavior, required phone/TPMS content, service exclusions, and the two interactive prototypes. It also produces review screenshots in `prototypes/screenshots/`.
