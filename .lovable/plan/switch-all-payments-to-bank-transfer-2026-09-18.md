# Switch all payments to bank transfer

Card payments are turned off everywhere. Instead, parents and applicants see the school's
bank account, transfer the money themselves, then tell the school they have paid. Staff
confirm each payment in the office, and only then is it counted.

Bank account shown everywhere:

```text
LOTUS BANK
IVINTAGE COLLEGE LTD
0000000000
```

## What people will see

**Parents (school fees)**
- Every "Pay" button becomes "Pay by bank transfer".
- A panel shows the bank details, the exact amount, and the pupil's name plus the invoice
  or item to use as the transfer description.
- The parent can enter the transfer reference and, if they wish, attach a photo of the
  teller or transfer receipt. Both are optional — staff can also just confirm it themselves.
- The item then reads "Awaiting confirmation" until the office marks it received.

**Applicants (application fee and acceptance fee)**
- After submitting an application, the page shows the bank details and the application
  number to use as the transfer description, instead of sending them to a card page.
- Accepting an offer works the same way: the offer is accepted, the acceptance fee shows as
  awaiting confirmation, and the pupil is enrolled once the office confirms the money.

**Staff**
- A "Bank transfers" list in Finance and in Admissions shows every claimed transfer with the
  payer, amount, reference and any attached receipt, plus Confirm and Reject buttons.
- Confirming a school fee posts it to the pupil's balance and produces the usual receipt.
- Confirming an acceptance fee runs the same enrolment step that the card flow used, so
  admission numbers, logins and class placement still happen automatically.
- Staff can still record a cash/transfer payment directly from the existing Record Payment
  dialog — that is unchanged.

**Hidden, not deleted**
- The card gateway code and its server functions stay in place behind an off switch, so the
  school can turn it back on later without rebuilding anything.

## Admin settings

A new "Payments" tab in Settings holds the bank name, account name, account number and an
optional note, plus the on/off switch for card payments. Changing them updates every page
that shows the account, so the placeholder account number can be corrected without code
changes.

## Technical notes

- New SQL file `db/phase8-bank-transfer.sql` (for the user to run in the SQL editor):
  - `app_settings` keys `online_payments_enabled` = `false`, `bank_name`, `bank_account_name`,
    `bank_account_number`, `bank_transfer_note`.
  - `payment_proof_url` + `payer_reference` columns on `fee_payments` and `admission_payments`
    (added only if missing); `bank-transfer-proofs` storage bucket with insert-by-payer,
    read-by-staff policies.
  - A `confirm_bank_transfer(payment_id, kind)` function that marks the row completed, stamps
    `paid_at`/`recorded_by`, and for an acceptance fee calls the existing `enroll_applicant`
    routine so enrolment stays idempotent.
- Frontend: a shared `BankTransferPanel` component and `useOnlinePaymentsEnabled()` hook.
  `ParentFees.tsx`, `AdmissionForm.tsx` and `AcceptOfferPage.tsx` stop invoking
  `initialize-fee-payment` / `initialize-admission-payment` / `initialize-acceptance-payment`
  while the switch is off, and instead insert a pending row and show the panel.
- New staff screens: `fees/BankTransfers.tsx` (tab in FeesHub) and a matching section in
  `AdmissionPaymentVerification.tsx`, both calling `confirm_bank_transfer`.
- `Reconciliation.tsx` and `FeePaymentCallback.tsx` / `PaymentCallbackPage.tsx` stay, but the
  callback pages redirect home with a notice when card payments are off.
- Paystack secret and webhook remain untouched.

## After the build

Run `db/phase8-bank-transfer.sql` in the SQL editor, then replace the placeholder account
number in Settings → Payments with the real one.
