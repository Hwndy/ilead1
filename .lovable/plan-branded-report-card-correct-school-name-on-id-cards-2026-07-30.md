# Branded Report Card + Correct School Name on ID Cards

## What is wrong today

- `school_info` is a **key/value** table (`info_key` / `info_value`). The report card builder reads it as if it had columns (`.name`, `.logo_url`, `.address`), so every branding field comes back empty  that is why the school name and logo never appear on the report card.
- The Students page reads the key `school_name`, which currently holds "Al-Bari College", so ID cards show the wrong name. The correct value lives under the `name` key: "Al-Bari Group of Schools".
- The printable report card itself is a plain black-bordered table with no school identity, no watermark, and no branded layout.

## What will be built

1. **Shared school-branding helper**
   A single loader that reads `school_info` key/value pairs and returns `{ name, address, phone, email, motto, logo_url, principal_name }`, falling back to "Al-Bari Group of Schools" and `/albari_logo.jpg`. Used by the report card builder and the ID card screens so branding is identical everywhere.

2. **Fully redesigned printable report card** (A4, print-ready)
   - Branded header band: crest/logo left, school name in large caps, address, phone, email, motto line, and the term/session ribbon.
   - Student identity strip: passport photo, full name, admission number, class/section, age, gender, position.
   - Results table in school colours: Test 1 (20), Test 2 (20), Exam (60), Total (100), Grade, Subject position, Class average, Highest, Lowest, Remark  with a totals row.
   - Summary cards: total score, average %, class position, overall grade.
   - Attendance block, grading-scale legend.
   - Remarks blocks for class teacher, head teacher, principal (auto-remark when blank), and signature lines carrying the principal name from settings.
   - Faint centred logo watermark, page-break-safe styles, exact colour printing.

3. **ID card school name fix**
   ID card screens use the shared helper, so cards render "Al-Bari Group of Schools" with the real logo, address and motto instead of the stale `school_name` value.

4. **Consistency across portals**
   Admin, teacher, parent and student report-card downloads all go through the same builder, so everyone sees the same branded document.

## Technical notes

- New `src/lib/school-branding.ts` with `fetchSchoolBranding()` (key/value → object, with fallbacks and legacy-key aliasing: `name` before `school_name`, `contact_phone` before `phone`, `contact_email` before `email`).
- Rewrite the markup and styles in `src/lib/report-card-html.ts` (data shape unchanged, so no call-site churn); add `principal_name` to `ReportCardSchoolInfo`.
- `src/hooks/useReportCardBuilder.ts`: replace the broken `school_info` query with `fetchSchoolBranding()`.
- `src/components/admin/ReportCardGenerator.tsx`: use the same branding source for preview and bulk print.
- `src/components/admin/StudentsByClass.tsx` and `IDCardGenerator.tsx`: use `fetchSchoolBranding()` for the `school` prop.
- No database or business-logic changes; scoring, positions and grading scale stay exactly as they are.