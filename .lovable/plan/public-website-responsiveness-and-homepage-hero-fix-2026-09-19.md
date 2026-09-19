# Public Website Responsiveness and Homepage Hero Fix

## Goal
Make the complete public website fit cleanly across phones, tablets, laptops, and wide screens, with a polished homepage opening that keeps the iVintage identity and all existing editable content.

## Homepage hero
- Rebuild the hero’s responsive layout so text and photography form a balanced split on large screens and a deliberate stacked composition on smaller screens.
- Remove the oversized white overlay/cutout behavior that obscures the photograph or creates empty blocks at narrow widths.
- Keep the headline readable without awkward line breaks, and constrain its width and size for each breakpoint.
- Give the image a stable responsive height and focal position so students remain visible without stretching or severe cropping.
- Reposition the “iVintage difference” panel and slideshow controls so they remain inside the image and never collide with each other, the WhatsApp button, or page edges.
- Keep both calls to action easy to tap, full-width only where appropriate, and preserve the existing slideshow, reduced-motion behavior, CMS fields, links, and fallback images.
- Keep the four programme shortcuts readable and usable, changing their column count by available width.

## Whole public website
- Audit the shared header, navigation, page openings, sections, cards, forms, galleries, news layouts, footer, and floating actions for overflow, clipping, crowded text, and unstable widths.
- Strengthen shared container and spacing rules so content scales consistently instead of relying on page-specific fixes.
- Make the header adapt cleanly between full navigation and the menu, preserving the school name, motto, contact details, and Apply action where space allows.
- Ensure long school content, addresses, email addresses, form labels, buttons, images, and grids wrap without breaking the viewport.
- Preserve every public route, submission flow, CMS-controlled field, SEO entry, and signed-in application style.

## Verification
- Test the homepage and every public route at phone, tablet, laptop, desktop, and wide-screen widths.
- Check for horizontal scrolling, clipped text, overlapping controls, distorted images, menu behavior, slideshow controls, application/tracker forms, and footer layout.
- Confirm the page remains usable with reduced motion and that the project builds without errors.

## Technical details
- Refine the existing responsive Tailwind rules in the shared website layout, public design utilities, homepage, and affected public sections only.
- Use stable grid tracks, `min-width: 0`, responsive aspect ratios/heights, and overflow-safe text rules rather than viewport-specific patches.
- Keep the existing semantic iVintage color tokens, Sora/Manrope typography, logo, navy/steel/lime palette, and light public-site theme.
