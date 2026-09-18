# Switch to bank transfer only

Card payments are removed everywhere. Parents and applicants are shown the school's bank account instead, and the office records money when it lands.

## Bank account shown across the app

```text
LOTUS BANK
IVINTAGE COLLEGE LTD
1012157409
```

A single shared "Pay by bank transfer" panel shows the bank, account name and number, with a copy button for the number and a note asking families to use the pupil's name and admission number as the transfer description. The details are stored as school settings (pre-filled with the above) and editable under Settings, so the account can be changed later without new work.

## What changes where

**Parent fees page**
- Every "Pay" button is removed.
- Each unpaid invoice, fee and installment shows its balance and the bank transfer panel.
- Payment history and downloadable receipts stay exactly as they are.

**Online application form**
- The application fee step is removed; submitting the form completes the application.
- Submitted applications go straight to "submitted" for staff review instead of waiting on payment.
- The confirmation screen keeps the application number and tracking link.

**Offer acceptance page**
- Accepting an offer no longer redirects to a card page.
- After accepting, the page shows the acceptance fee amount, the bank transfer panel and instructions to send proof to the school office.
- Staff continue to confirm and enrol the pupil with the existing "Record offline acceptance payment" action.

**Admin side**
- Cash/transfer recording, receipts, balances and invoices are unchanged — this is how all payments now get in.
- The card reconciliation screen and the card payment callback pages are removed from the menus and routes.

## Technical notes

- Delete card entry points: `initialize-fee-payment`, `initialize-admission-payment`, `initialize-acceptance-payment`, `verify-fee-payment`, `verify-admission-payment`, `verify-acceptance-payment`, `paystack-webhook`, `paystack-reconcile` are removed from `supabase/config.toml` and the repo; the enrolment path keeps using the shared `enroll_applicant` routine called by `record_offline_acceptance_payment`.
- Remove routes/pages `src/pages/FeePaymentCallback.tsx`, `src/pages/website/PaymentCallbackPage.tsx` and `src/components/admin/fees/Reconciliation.tsx` plus their tab entries.
- New `src/components/shared/BankTransferDetails.tsx` reading `app_settings` keys `bank_name`, `bank_account_name`, `bank_account_number` with the Lotus Bank values as defaults; add the three fields to the school settings editor.
- `AdmissionForm.tsx`: drop the payment step and the `payment_pending` status; `AcceptOfferPage.tsx`: accept then show the transfer panel; `ParentFees.tsx`: drop `pay()` and its buttons.
- A small SQL file inserts the three settings rows (idempotent) for the user to run in the SQL editor.
- The `PAYSTACK_SECRET_KEY` secret can be deleted afterwards; no code will reference it.
