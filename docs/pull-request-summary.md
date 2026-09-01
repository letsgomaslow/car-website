# Build the Central Auto Repair website

## Summary

This change delivers the complete, mobile-first Central Auto Repair website based on the client-approved Bayline direction. It includes the verified service catalog, TPMS differentiation, accessible navigation and interactions, official logo treatment, responsive QA artifacts, and Vercel-ready static deployment configuration.

## Public pages

- Homepage
- Searchable services directory
- TPMS programming page
- About page
- Contact, hours, and directions page
- Privacy page
- Custom 404 page

## Service inventory

- Publishes 89 service items in 17 categories.
- Preserves 88 applicable items from the B-C Tire reference catalog.
- Adds Central Auto Repair's TPMS Programming service.
- Explicitly excludes Wheel Alignment, Auto Glass, and WeatherTech Products.
- Leaves fleet service, customer-supplied TPMS compatibility, and TPMS sensor replacement unpublished pending owner confirmation.
- Stores the reviewable source of truth in `data/services.json`.

## UX and accessibility

- Responsive layouts verified from 320px through 1440px.
- Full-screen mobile navigation with focus trapping, Escape support, focus restoration, inert background content, and scroll locking.
- Sticky mobile Call and Directions actions.
- Searchable, progressively disclosed service categories that remain usable without JavaScript.
- Visible two-tone focus treatment, semantic landmarks, sequential heading structure, screen-reader labels, and WCAG-conscious contrast.
- Motion is restrained and disabled through `prefers-reduced-motion` when requested.
- Saira Condensed display typography connects to the squared automotive logo forms without tight negative tracking; Manrope remains the body and utility typeface.

## Logo and favicon system

- Preserves the untouched 1024×1024 Instagram profile image as the raster source.
- Provides a transparent master without redrawing the logo.
- Provides a dark-surface variant with the gear, skyline, and lower `AUTO REPAIR` panel changed from black to white while preserving the car, wrench, `CENTRAL` plaque, red lettering, geometry, and alpha silhouette.
- Includes verified transparent favicon/PWA derivatives at 32×32, 180×180, 192×192, and 512×512.
- Keeps the live-text business name beside the detailed mark for small-screen legibility.

## Deployment and security

- Dependency-free static output in `site/`.
- Vercel uses `vercel.json` with no install or build step.
- Clean URLs, no trailing slash, and custom 404 support.
- Security headers cover content-type sniffing, framing, referrer policy, and unused browser permissions.
- No unapproved online form or fake submission workflow is included.

## Verification

- All seven public routes pass at 320, 360, 390, 430, 768, 1024, and 1440 pixel widths.
- No horizontal overflow, console errors, page errors, or undersized primary controls.
- Mobile navigation interaction checks pass at every mobile/tablet breakpoint.
- The rendered service directory exactly matches all 89 items in `data/services.json`.
- Excluded services are absent from public copy.
- Internal route and no-JavaScript fallback checks pass.
- Logo tests verify real alpha transparency, preserved dimensions, unchanged master RGB pixels, unchanged dark-variant alpha geometry, authorized selective recoloring, and exact favicon dimensions.
- Desktop and mobile screenshots were visually reviewed.

## Launch checklist

- Confirm the owner's preferred address spelling, phone number, and operating hours immediately before launch.
- Connect the final production domain.
- Add final canonical URLs, `og:url` values, social preview image URLs, and `sitemap.xml` after the domain is known.
- Submit the sitemap through Google Search Console.
- Replace illustrative bay artwork with permission-cleared shop photography when available.
- Obtain an original SVG, AI, EPS, or vector PDF of the logo for future print/signage work if available.

## Vercel handoff

Import the GitHub repository in Vercel and select the **Other** framework preset if prompted. `vercel.json` publishes the `site/` directory; no build command is required.
