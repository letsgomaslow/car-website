# Central Auto Repair website

A dependency-free, multi-page static website based on the approved **Bayline** direction. The production output is the `site/` directory and is configured for Vercel through `vercel.json`.

## Public pages

- `/` — Homepage
- `/services/` — Searchable catalog with 89 published service items in 17 categories
- `/tpms-programming/` — Dedicated TPMS programming page
- `/about/` — Business overview
- `/contact/` — Phone, address, hours, and directions
- `/privacy/` — Current site privacy notice
- `/404.html` — Custom not-found page

## Local preview

From the repository root:

```bash
python3 -m http.server 4173 --directory site --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Vercel reads `vercel.json` and publishes the `site/` directory.
4. Use the **Other** framework preset if Vercel asks for one.
5. No install command or build command is required.

`cleanUrls` and `trailingSlash` settings provide clean public routes. Security headers are configured in `vercel.json`.

## Service inventory

`data/services.json` is the reviewable source of truth:

- 88 items from the reference catalog after the approved removals
- 1 Central-specific TPMS Programming item
- 89 published items total
- Explicit exclusions recorded separately

The website does not publish distinct commercial fleet service, TPMS sensor replacement, or customer-supplied sensor compatibility claims without further confirmation.

## Verified business information used

The following values were taken from the current Central Auto Repair Google Maps listing on August 31, 2026:

- Central Auto Repair
- 82 Lincoln Hwy, Edison, NJ 08820
- 732-822-4534
- Monday–Saturday: 9:00 AM–7:00 PM
- Sunday: Closed

The visible website writes the street name as “Lincoln Highway.” Confirm the legal/canonical address format, phone, and hours with the owner immediately before production launch.

## Domain and SEO launch step

The final production domain was not available during implementation, so the source intentionally contains no fake canonical URL or placeholder sitemap domain. After connecting the real domain:

1. Add an absolute canonical URL to every public page.
2. Add absolute `og:url` and social-preview image URLs.
3. Create a root `sitemap.xml` containing the canonical public URLs.
4. Add the absolute sitemap URL to `site/robots.txt`.
5. Validate the `AutoRepair` structured data and submit the sitemap in Google Search Console.

## Content and media boundaries

- No review count, warranty, certification, pricing, turnaround, or financing claim is published.
- No online request form is enabled because a secure submission destination and response workflow have not been approved.
- The current Bayline artwork is original SVG illustration. Replace it with permission-cleared shop, bay, technician, and TPMS-tool photography when those assets are available.

## Logo and typography

- `site/assets/images/central-auto-repair-logo.jpg` is the untouched 1024×1024 source recovered from the official Instagram profile on September 1, 2026.
- `site/assets/images/central-auto-repair-logo-transparent.png` is the geometry-preserving transparent master. Only border-connected near-white background pixels were converted to alpha.
- `site/assets/images/central-auto-repair-logo-dark.png` is the website's dark-surface variant. It preserves the same dimensions and alpha silhouette while changing only the gear, skyline buildings, and lower `AUTO REPAIR` panel from black to white.
- `site/assets/icons/` contains transparent, padding-trimmed 32×32 favicon, 180×180 Apple touch, and 192×192/512×512 web-app icons derived from the dark-surface variant. No logo details were removed.
- Display typography uses Saira Condensed at 600–900. Body and utility typography uses Manrope at 400–800.
- The detailed logo remains paired with a live-text business name in the header so the name stays legible at small mobile sizes.

See `docs/brand-type-assessment.md` for the evidence labels, font rationale, and safe-use guidance.
