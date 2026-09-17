-- Phase 7: wire the new billing model into payments
-- Safe to run more than once.

-- Payments can now be attached to a termly invoice.
alter table public.fee_payments add column if not exists invoice_id uuid references public.student_invoices(id) on delete set null;
create index if not exists fee_payments_invoice_idx on public.fee_payments(invoice_id);

-- Keep an invoice's paid total in step with its payments.
create or replace function public.sync_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
  paid numeric(12,2);
  total numeric(12,2);
begin
  if target is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount_paid), 0) into paid
  from public.fee_payments
  where invoice_id = target and status = 'completed';

  select total_amount into total from public.student_invoices where id = target;

  update public.student_invoices
     set amount_paid = paid,
         status = case
           when paid <= 0 then 'open'
           when paid >= coalesce(total, 0) then 'paid'
           else 'part_paid'
         end
   where id = target and status <> 'cancelled';

  return coalesce(new, old);
end;
$$;

drop trigger if exists fee_payments_sync_invoice on public.fee_payments;
create trigger fee_payments_sync_invoice
after insert or update or delete on public.fee_payments
for each row execute function public.sync_invoice_paid();

-- Applicant identity carried onto the pupil record at enrolment.
alter table public.students add column if not exists nin text;
alter table public.students add column if not exists admission_application_id uuid;
