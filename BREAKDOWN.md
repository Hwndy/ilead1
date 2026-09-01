# School Management System  Full Application Breakdown

_Generated: 2026-06-06 · Based on direct scan of `src/`, `supabase/migrations/`, `supabase/functions/`, and live DB schema._

---

## 0. At-a-glance

- **Pages:** 12 (`src/pages/`) + 11 website pages
- **Admin components:** 41 in `src/components/admin/` (+ 3 SMS, 6 CMS)
- **Teacher components:** 16 · **Student:** 3 · **Parent:** 7 · **PWA:** 3
- **Database tables:** 68 with RLS
- **Edge functions:** 20 deployed
- **Migrations:** 20+ (latest batch: 2026-01-04 added promotion, staff, installments, push, library, ID cards)
- **PWA:** ✅ enabled (`vite-plugin-pwa`, 6MB cache cap)
- **Multi-tenancy:** ✅ school_id on all critical tables + super admin

---

## 1. ✅ What Has Been Done

### 1.1 Authentication & Authorization
- Email/password auth via Supabase (`AuthPage.tsx`, `LoginForm`, `RegisterForm`, `ForgotPasswordForm`)
- OTP password reset (`send-otp` + `verify-otp` edge functions, `password_reset_otps` table)
- Roles in dedicated `user_roles` table with `has_role()` security-definer function
- `ProtectedRoute` enforces role-based access
- `SessionMonitor` tracks tab switches & inactivity during exams
- Super-admin detection via `is_super_admin()` (null `school_id` + `admin` role)

### 1.2 Multi-Tenancy (Schools)
- `schools` table with branding, settings, custom domains
- `SchoolProvider` context + `useSchoolQuery` hook auto-injects `school_id` filter
- `SchoolSwitcher` for super admins
- BEFORE-INSERT triggers auto-populate `school_id` on 10 critical tables
- `create-school` + `create-school-admins` edge functions
- `SchoolManagement.tsx` for super admin
- `SuperAdminDashboard.tsx` separate UI

### 1.3 Student Management (Spec §4.1)
- Registration via admissions pipeline OR direct admin creation (`create-student` edge function)
- Auto-generated admission numbers (`generate_application_number`)
- Student profiles with bio, class, guardian, medical (`students` table  19 columns)
- `SMS/StudentManagement.tsx` for admin CRUD + bulk import
- `SMS/StudentPromotion.tsx` for batch promotion / graduation / retention (uses `promotion_history`)
- Student-parent links (`student_parent_relationships`)
- ID card generator (`IDCardGenerator.tsx`, `student_id_cards`)

### 1.4 Staff / Teacher Management (Spec §4.2)
- Profile creation via auth signup + handle_new_user trigger
- `StaffManagement.tsx` for staff profiles (department, designation, salary, qualifications, documents JSONB, bank details)
- `StaffAttendance.tsx` for daily check-in/out (`staff_attendance` table)
- Class allocation: `TeacherClassAssignment.tsx` + `create_teacher_class_assignments` RPC
- Subject allocation: `subject_assignments` table

### 1.5 Class & Academic Structure (Spec §4.3)
- `ClassManagement.tsx`  classes, arms, streams (`classes` table)
- `SubjectManagement.tsx`  subjects (`subjects` table)
- Periods & rooms (`periods`, `rooms` tables)
- `TimetableManager.tsx`  manual builder with conflict checking (`check_timetable_conflict` function, `class_timetables`, `timetable_templates`)
- Student/Teacher timetable views (`StudentTimetable.tsx`, `TeacherTimetable.tsx`)
- `academic_calendar` table + parent calendar view

### 1.6 Attendance Management (Spec §4.4)
- `AttendanceSystem.tsx` (teacher)  daily class attendance
- `student_attendance` + `attendance_sessions` tables
- `attendance_summary` aggregation table
- Parent `AttendanceMonitor.tsx`
- Staff attendance (`StaffAttendance.tsx`, `staff_attendance`)

### 1.7 Examination & Result Management (Spec §4.5)
- Full exam engine:
  - Creation: `ExamBuilder`, `TeacherExamBuilder`, `ConsolidatedExamCreator`, `EnhancedExamForm`, `ExamCreationModal`
  - Question banks: `AdminQuestionBank`, `QuestionBank`, `EnhancedQuestionCreator`, `BulkQuestionImport`, `QuestionBulkImport`
  - Selectors & randomization: `QuestionSelector`, `RandomizedExamGenerator`, `QuestionCategorizer`
  - Runtime: `ExamInterface`, `EnhancedExamInterface`, `MobileExamInterface`, `JAMBExamInterface`
  - Instructions & results: `ExamInstructionsPage`, `ExamResultsPage`, `ExamResults`
  - Live monitoring: `LiveExamMonitor`, `EnhancedLiveMonitor`
- Auto grading via DB triggers (`grade_question_response`, `calculate_exam_score`)
- CA / assessments: `assessment_types`, `assessments`, `GradebookSystem.tsx`, `gradebook_entries`
- Grading: `grades`, `grading_scales`, `grade_comments`, `report_card_comments`
- Report cards: `ReportCardGenerator.tsx` (PDF)
- Result history: `AdminStudentResults`, `AdminResultsModal`, `EnhancedExamResults`, `StudentResultDetails`

### 1.8 Fees & Accounting (Spec §4.6)
- `SMS/FeeManagement.tsx`  fee structure CRUD per class (`fee_structures`)
- Payment tracking (`fee_payments`)  cash, transfer, online (Paystack)
- Installment plan tables (`fee_installment_plans`, `fee_installments`)  schema only
- Fee reminder logs (`fee_reminder_logs`)
- Receipt PDF generator (`FeeReceiptGenerator.tsx`)
- Parent fee views: `parent/FeeManagement.tsx`, `parent/FeeManagementEnhanced.tsx`
- `send-fee-reminders` edge function (SMS+email)
- Paystack integration: `initialize-*` / `verify-*` / `paystack-webhook` edge functions

### 1.9 Parent Portal (Spec §4.7)
- `ParentDashboard.tsx` with 6 tabs: Overview, Academics, Attendance, Fees, Messages, Calendar
- Components: `StudentOverview`, `AcademicProgress`, `AttendanceMonitor`, `FeeManagementEnhanced`, `CommunicationHub`, `AcademicCalendar`
- Announcements (`announcements` table)

### 1.10 Admissions Pipeline
- 12 admin components covering full workflow:
  - `AdmissionManagement`, `AdmissionSessionManager`, `AdmissionPaymentVerification`
  - `AdmissionExamScheduler`, `AdmissionDecisionBoard`, `AdmissionAnalytics`
  - `AdmissionDocumentViewer`, `InterviewScheduler`, `InterviewPanelManager`, `InterviewFeedbackForm`
  - `OfferLetterGenerator`, `RejectionNotifier`
- 8 supporting DB tables (`admission_applications`, `admission_documents`, `admission_interviews`, `admission_offers`, `admission_payments`, `admission_sessions`, `admission_workflow_logs`, `admission_exam_assignments`)
- Public site: `AdmissionForm.tsx`, `ApplicationTracker.tsx`, `TrackApplicationPage`, `AcceptOfferPage`, `PaymentCallbackPage`
- Edge functions: `initialize-admission-payment`, `verify-admission-payment`, `initialize-acceptance-payment`, `verify-acceptance-payment`, `send-offer-letter`, `send-admission-notification`, `accept-offer`, `track-application`

### 1.11 Library Management
- `LibraryManager.tsx` (admin)  catalog CRUD + issue/return
- `LibraryCatalog.tsx` (student)  browse
- Tables: `library_books`, `book_issues`

### 1.12 Notifications
- `BulkNotificationSender.tsx`  multi-channel (email + SMS + push)
- `NotificationSettings.tsx`  per-user preferences
- Edge functions: `send-bulk-email`, `send-bulk-sms`, `send-push-notification`
- Tables: `notification_templates`, `notification_queue`, `push_subscriptions`, `email_logs`
- `EmailLogsViewer.tsx`, `EmailTestingPanel.tsx`

### 1.13 PWA (Progressive Web App)
- `vite-plugin-pwa` with autoUpdate, NetworkFirst for Supabase, CacheFirst for assets
- `public/sw.js`, `public/manifest.json`
- `InstallPrompt.tsx`, `OfflineIndicator.tsx`, `UpdateAvailable.tsx`
- `usePWA` hook + `PWAProvider` context
- `InstallPage.tsx`  per-platform install guide
- `pushNotifications.ts` service

### 1.14 Website CMS (Public-Facing Site)
- 11 public pages: Home, About, Admissions, Apply, AcceptOffer, Facilities, News, PaymentCallback, Portals, SchoolLife, TrackApplication
- Admin editors: `NewsManager`, `GalleryManager`, `TestimonialManager`, `SchoolInfoEditor`, `SiteSettingsEditor`, `NewsEditor`
- Tables: `news_articles`, `gallery`, `testimonials`, `school_info`, `website_pages`, `website_sections`, `website_settings`

### 1.15 Auditing & Security
- `AuditLogs.tsx`, `EnhancedAuditLogs.tsx`
- Rate limiting (`rate_limits` table + `cleanup_old_rate_limits` function)
- App settings (`app_settings`)

---

## 2. 🟡 Partial  Built But Not Wired / Missing UI Coverage

### 🚨 Critical integration gaps (built components NOT mounted)

The following components exist in code but are **not registered in `AdminSidebar`** and have **no rendering branch in `AdminDashboard.tsx`**  meaning the user cannot reach them from the UI:

| Component | File | Status |
|---|---|---|
| Student Management (SMS) | `src/components/admin/SMS/StudentManagement.tsx` | Orphaned |
| Student Promotion | `src/components/admin/SMS/StudentPromotion.tsx` | Orphaned |
| Staff Management | `src/components/admin/StaffManagement.tsx` | Orphaned |
| Staff Attendance | `src/components/admin/StaffAttendance.tsx` | Orphaned |
| Fee Receipt Generator | `src/components/admin/FeeReceiptGenerator.tsx` | Orphaned |
| Notification Settings | `src/components/settings/NotificationSettings.tsx` | Orphaned (no settings page) |
| Audit Logs | `src/components/admin/AuditLogs.tsx`, `EnhancedAuditLogs.tsx` | Only Enhanced is used in SuperAdmin; basic version orphaned |

**Fix:** Add menu entries in `src/components/ui/admin-sidebar.tsx` and corresponding `if (activeTab === ...)` branches in `AdminDashboard.tsx` (around lines 269–411).

### Feature-level partials

| Area | What exists | What's missing |
|---|---|---|
| Fee installments | `fee_installment_plans` + `fee_installments` tables | No UI to create plans or display installments to admin/parent |
| Fee reminders | `send-fee-reminders` edge function | No cron schedule configured; no admin UI to trigger manually |
| Financial reports | Raw `fee_payments` data | No dashboard with daily/monthly/yearly aggregates, charts, by-class breakdown |
| Bulk student import | Single-student creation only | No Excel/CSV bulk import for students (question bulk import exists; student version doesn't) |
| Bulk student export | `export-users` edge function | Not surfaced in admin UI |
| Staff documents | `documents` JSONB column in `staff_details` | No upload UI for contracts/certificates |
| Staff performance | `staff_details` has fields | No performance review module |
| Teacher attendance modes | Manual marking via `StaffAttendance.tsx` | No biometric / QR / geofencing |
| Student attendance modes | Manual via `AttendanceSystem.tsx` | No QR / biometric / parent app-based |
| Library fines | `book_issues` has dates | No fine calculation / collection |
| Notification prefs | `NotificationSettings.tsx` exists | Not enforced  bulk senders ignore per-user opt-outs |
| Push subscriptions | `push_subscriptions` table + service | Service worker `push` event handler is bare; no rich notifications, no action buttons |
| Report cards | Single-student PDF works | No bulk class-wide batch generation, no email-to-parent flow |
| Email custom domain | Resend integration via `RESEND_API_KEY` | No domain verification UI |
| Payment gateways | Paystack only | No Flutterwave / Stripe / bank transfer reconciliation |
| Multi-school detection | `lib/school-utils.ts` | Hard-coded domain→school_id map (lines 11-19); not DB-driven |
| Settings page | None | No `/settings` route for users to manage profile, password, notifications |
| Two-Factor Auth (2FA) | Not implemented | Supabase MFA not enabled |

---

## 3. ❌ Not Built  Spec & Roadmap Gaps

### Core SMS modules absent
- **Transport**  routes, vehicles, drivers, student bus assignments, GPS tracking
- **Hostel / Boarding**  rooms, allocations, attendance, fees
- **Inventory / Asset management**  stationery, lab equipment, lifecycle
- **Cafeteria / Meal management**  menus, allergies, billing
- **Medical / Health records**  vaccinations, visits, allergies (only a basic `medical_info` field exists on students)
- **Disciplinary records**  incident log, demerits, suspensions
- **Alumni management**  graduates, contact, events
- **HR / Payroll**  leave management, payroll runs, payslips (only `salary` field, no run cycle)
- **Auto timetable generator**  current is manual only
- **Inter-school comparison** for super admin

### Communication
- **Real-time chat** between teachers/parents/students (only async announcements)
- **Video conferencing** for virtual classes (Zoom / Jitsi / Meet integration)
- **In-app messaging inbox**
- **SMS/Email/WhatsApp templates UI** (templates table exists, no editor)

### Intelligence
- **AI analytics**  predictive performance, dropout risk, recommendations
- **AI-assisted question generation**
- **Auto-grading for essay questions**
- **Plagiarism detection**

### Platform
- **Internationalization (i18n)**  no `react-i18next`, English only
- **Multi-currency** support
- **Dark mode toggle** (CSS supports it, no UI toggle)
- **Native mobile shell** via Capacitor (PWA only today)
- **Public API / webhooks** for integrators
- **Data export per user (GDPR)**
- **Backup & restore tooling**

---

## 4. 🐛 Fixes Required

### 4.1 Critical (block features)
1. **Orphaned components (§2)**  wire `StudentManagement`, `StudentPromotion`, `StaffManagement`, `StaffAttendance`, `FeeReceiptGenerator` into sidebar + dashboard router. Without this, the recent migrations create unused tables.
2. **`src/lib/school-utils.ts` hard-coded domain map**  multi-tenancy will route every new school to "Albari Model Schools" by default until replaced with a DB lookup.
3. **Push notification handler in `public/sw.js`** is incomplete  `push` events need proper `event.waitUntil(showNotification(...))` wiring.

### 4.2 Type & code quality
4. `BulkNotificationSender.tsx` and `LibraryManager.tsx` use `(supabase as any)` casts  types should regenerate cleanly now that migrations are applied. Remove casts.
5. Many components use `any` for Supabase rows  tighten with `Database['public']['Tables'][...]['Row']`.
6. `AdminDashboard.tsx` is **551 lines**  split into smaller route components.
7. `src/integrations/supabase/types.ts` was hand-edited at points in history  confirm it matches DB regeneration.

### 4.3 Performance
8. **Bundle size 5MB+**  `vite-plugin-pwa` precache raised to 6MB as workaround. Real fix: route-level code splitting with `React.lazy` on every page (`App.tsx` lines 17-30) and `Suspense` boundaries.
9. Admin Dashboard loads 30+ component modules eagerly even when on `overview`.
10. No image optimization pipeline; gallery uploads stored raw.
11. No pagination on `LibraryManager`, `StudentManagement`, `AuditLogs`  will hit Supabase 1000-row default.

### 4.4 Security & Supabase config
12. **Leaked Password Protection disabled** in Supabase Auth  enable in dashboard.
13. **MFA / 2FA not configured.**
14. `send-fee-reminders` has `verify_jwt = true` but no cron schedule defined  needs `pg_cron` or external scheduler.
15. Cron also missing for `cleanup_expired_otps()` and `cleanup_old_rate_limits()`.
16. Verify GRANTs exist on every table created in the 2026-01-04 migration batch (`promotion_history`, `staff_details`, `staff_attendance`, `fee_installment_plans`, `fee_installments`, `fee_reminder_logs`, `push_subscriptions`, `student_id_cards`, `library_books`, `book_issues`).
17. `auto_assign_teacher_class` trigger is a no-op (returns `NEW` only)  either implement or drop.

### 4.5 UX / functional bugs to verify
18. `DashboardRouter` (App.tsx) shows two consecutive spinners (`isLoading` then `checkingSuperAdmin`)  merge into one.
19. `StudentDashboard` tab labels render as empty (icons only)  check `TabsTrigger` children at lines 18-23 of grep output.
20. Logout in `AuthContext.tsx` manually removes `localStorage.removeItem('sb-irrxmoqbgygyyzozifdl-auth-token')`  project-ref hardcoded; use `import.meta.env.VITE_SUPABASE_PROJECT_ID`.
21. `AdminDashboard.fetchDashboardData` does `withSchoolFilter(profiles).then(.map)`  for super admin returning ALL profiles, this could be >1000 rows and silently truncate the stat counts.
22. Toast spam on long save operations in several admin forms.

### 4.6 Database integrity
23. No soft-delete columns  cascading deletes lose history.
24. `subjects` references `school_id` but `subject_assignments` lacks a unique constraint on `(user_id, subject_id, class_id)` (verify).
25. Storage bucket `admission-documents` is **public**  confirm intentional (signed URLs preferred for PII).

---

## 5. 🔐 Security & Config Checklist

- [x] RLS enabled on all 68 public tables
- [x] Roles in dedicated `user_roles` table (no privilege escalation)
- [x] `service_role_key` never exposed to frontend
- [x] Secrets stored via Supabase secrets (PAYSTACK, RESEND, SENDER_EMAIL)
- [x] Rate limiting table + cleanup function
- [x] Audit log tables
- [ ] Leaked Password Protection enabled
- [ ] MFA / 2FA configured
- [ ] Cron schedules for fee reminders, OTP cleanup, rate-limit cleanup
- [ ] Sentry / error monitoring
- [ ] GDPR data export
- [ ] Replace hard-coded school-domain map
- [ ] Confirm GRANTs on all 2026-01-04 tables
- [ ] Storage policies reviewed for `admission-documents` (currently public)

---

## 6. 📋 Recommended Next-Step Priorities

**Sprint 1  Ship what's already built (1-2 days)**
1. Wire orphaned components into `AdminSidebar` + `AdminDashboard.tsx` (Students, Promotion, Staff, Staff Attendance, Receipts, Settings).
2. Add `/settings` route with `NotificationSettings.tsx`.
3. Build minimal Installments UI inside `FeeManagement` so the tables aren't dead.
4. Schedule the cron for `send-fee-reminders`.

**Sprint 2  Fix multi-tenancy & performance (2-3 days)**
5. Replace hard-coded school detection with `schools.custom_domain` lookup.
6. Code-split routes with `React.lazy`  target <1 MB initial JS.
7. Add pagination to long lists.

**Sprint 3  Close core spec gaps (1 week)**
8. Bulk Excel student import.
9. Financial reports dashboard.
10. Bulk class-wide report cards.
11. Library fines.
12. Enable Supabase Auth hardening (leaked passwords + MFA).

**Sprint 4  Phase 5 modules (prioritize per business need)**
13. Transport OR Hostel (pick highest demand).
14. Real-time chat (Supabase Realtime).
15. i18n (`react-i18next`) for multi-language schools.
16. AI analytics on top of existing exam/attendance data.
17. Video conferencing integration.

---

_End of breakdown  total scan: 145 source files, 20 edge functions, 20 migrations, 68 tables._