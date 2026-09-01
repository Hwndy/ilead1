-- Operational defaults for iVintage College (idempotent).
-- Amounts and dates are starting points; admins can edit them in the portal.

-- ---------------------------------------------------------------- admissions
insert into admission_sessions
  (academic_year, session_name, start_date, end_date, status, application_fee,
   classes_open, required_documents, is_current)
select '2026/2027', '2026/2027 Admissions', date '2026-01-05', date '2026-09-30',
       'active', 5000,
       '["JSS 1","JSS 2","JSS 3","SSS 1","SSS 2","SSS 3"]'::jsonb,
       '["Birth Certificate","Passport Photograph","Last Report Card","Transfer Certificate"]'::jsonb,
       true
where not exists (select 1 from admission_sessions);

-- --------------------------------------------------------------------- fees
insert into fee_structures (class_id, academic_year, term, fee_type, amount, is_mandatory)
select c.id, '2026/2027', t.term, f.fee_type, f.amount, f.mandatory
from classes c
cross join (values ('First Term'),('Second Term'),('Third Term')) as t(term)
cross join (values
  ('Tuition', 120000, true),
  ('Development Levy', 15000, true),
  ('ICT Levy', 10000, true),
  ('Books and Stationery', 20000, false)
) as f(fee_type, amount, mandatory)
where not exists (select 1 from fee_structures);

-- ------------------------------------------------------- academic calendar
insert into academic_calendar (event_type, title, description, start_date, end_date, is_school_wide)
select * from (values
  ('term_start','First Term Begins','Resumption for the 2026/2027 session', date '2026-09-14', date '2026-09-14', true),
  ('holiday','Mid-Term Break','First term mid-term break', date '2026-11-02', date '2026-11-06', true),
  ('exam','First Term Examinations','End of first term examinations', date '2026-12-07', date '2026-12-18', true),
  ('term_end','First Term Ends','Vacation for the Christmas break', date '2026-12-18', date '2026-12-18', true),
  ('term_start','Second Term Begins','Resumption for second term', date '2027-01-11', date '2027-01-11', true),
  ('exam','Second Term Examinations','End of second term examinations', date '2027-03-22', date '2027-04-02', true),
  ('term_end','Second Term Ends','Vacation for the Easter break', date '2027-04-02', date '2027-04-02', true),
  ('term_start','Third Term Begins','Resumption for third term', date '2027-04-26', date '2027-04-26', true),
  ('exam','Third Term Examinations','End of session examinations', date '2027-07-05', date '2027-07-16', true),
  ('term_end','Third Term Ends','End of the 2026/2027 academic session', date '2027-07-23', date '2027-07-23', true),
  ('exam','Entrance Examination','Entrance examinations hold every Saturday at 10:00am', date '2026-09-05', date '2026-09-05', true)
) as v(event_type,title,description,start_date,end_date,is_school_wide)
where not exists (select 1 from academic_calendar);

-- --------------------------------------------------- notification templates
insert into notification_templates (name, type, subject, body, variables)
select * from (values
  ('Fee Reminder (Email)','email','Outstanding school fees for {{student_name}}',
   E'Dear Parent/Guardian,\n\nThis is a reminder that the sum of {{amount}} remains outstanding on {{student_name}}''s account for {{term}}, {{academic_year}}. Kindly make payment on or before {{due_date}}.\n\nThank you.\niVintage College',
   array['student_name','amount','term','academic_year','due_date']),
  ('Fee Reminder (SMS)','sms',null,
   'iVintage College: {{amount}} is outstanding on {{student_name}}''s fees for {{term}}. Kindly pay before {{due_date}}. Thank you.',
   array['student_name','amount','term','due_date']),
  ('Payment Receipt (Email)','email','Payment received - {{student_name}}',
   E'Dear Parent/Guardian,\n\nWe have received your payment of {{amount}} for {{student_name}} ({{term}}, {{academic_year}}). Reference: {{reference}}.\n\nThank you.\niVintage College',
   array['student_name','amount','term','academic_year','reference']),
  ('Absence Alert (SMS)','sms',null,
   'iVintage College: {{student_name}} was marked absent on {{date}}. Please contact the school office if this is unexpected.',
   array['student_name','date']),
  ('Result Published (Email)','email','{{term}} results are available for {{student_name}}',
   E'Dear Parent/Guardian,\n\n{{student_name}}''s {{term}} result for the {{academic_year}} session has been published. Log in to the parent portal to view and download the report card.\n\niVintage College',
   array['student_name','term','academic_year']),
  ('Admission Offer (Email)','email','Admission offer - iVintage College',
   E'Dear {{applicant_name}},\n\nCongratulations! You have been offered admission into {{class_name}} at iVintage College for the {{academic_year}} session. Kindly accept your offer before {{deadline}}.\n\niVintage College',
   array['applicant_name','class_name','academic_year','deadline']),
  ('General Announcement (Email)','email','{{title}}',
   E'Dear Parent/Guardian,\n\n{{message}}\n\niVintage College',
   array['title','message']),
  ('General Announcement (SMS)','sms',null,
   'iVintage College: {{message}}',
   array['message'])
) as v(name,type,subject,body,variables)
where not exists (select 1 from notification_templates);

-- ----------------------------------------------------- report card defaults
insert into result_automation_settings (id) select gen_random_uuid()
where not exists (select 1 from result_automation_settings);

-- --------------------------------------------------------- grading scale name
update grading_scales set name = 'iVintage Standard (A-F)'
where name ilike '%al-bari%';

-- -------------------------------------------------------------- media bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('media','media', true, 10485760)
on conflict (id) do update set public = true;

drop policy if exists "Public read media" on storage.objects;
create policy "Public read media" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "Authenticated upload media" on storage.objects;
create policy "Authenticated upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "Authenticated update media" on storage.objects;
create policy "Authenticated update media" on storage.objects
  for update to authenticated using (bucket_id = 'media');

drop policy if exists "Authenticated delete media" on storage.objects;
create policy "Authenticated delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
