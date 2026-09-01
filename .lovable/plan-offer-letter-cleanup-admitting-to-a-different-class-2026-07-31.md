# Offer letter cleanup + admitting to a different class

## 1. Email body: drop the letterhead
The offer email currently paints the full letterhead PNG as a background image behind the message. Remove it and send a clean, plain branded email (white card, green accent line, school name in text). The letterhead stays exactly as it is on the attached PDF, which is the official document.

Side benefit: many mail clients block background images, so the current email often renders with a large blank gap at the top.

## 2. Wording change
Replace, in both the PDF and the email:

- Old: "...you have been offered a place in {Class}..."
- New: "...you have been admitted to {Class} at Al-Bari Group of Schools for the {session} academic session."

The "provisional until the acceptance fee is paid" sentence stays.

## 3. Admitting a candidate to a different (lower) class
Today the offer always names the class the candidate applied for. Add the ability to admit into another class  typically the class below when the entrance exam result falls short.

In the "Send Admission Offer" dialog the admin will now see:

```text
Class applied for:  JSS 2            (read-only)
Admit into class:   [ JSS 1  v ]     (dropdown, defaults to applied class)
Reason / note:      [ optional short note shown in the letter ]
```

- When the admitted class differs from the applied class, the letter adds one line:
  "Following your performance in the entrance assessment, the school is offering admission into {Admitted Class} rather than {Applied Class}." followed by the admin's optional note.
- The decision is stored on the application (`admitted_to_class_id`), which the enrolment flow already reads  so on payment the student is placed in the admitted class automatically, and the parent portal, ID card and fee structure all follow the correct class.
- The Decision Board / application review will show "Admitted to" alongside "Applied for" so the downgrade is visible to staff.

## Technical notes
- `supabase/functions/send-offer-letter/index.ts`
  - Accept `admitted_class_id` and `class_change_note` in the request body; resolve both applied and admitted class names.
  - Persist `admitted_to_class_id` (and note) on `admission_applications` before generating the letter.
  - PDF: change wording, use the admitted class in the body and in the "Class offered" row, add the class-change paragraph when the classes differ.
  - Email HTML: remove `background-image: url(LETTERHEAD_URL)` and its spacer rows; rebuild as a plain card with a text header, same content and Accept button.
- `src/components/admin/OfferLetterGenerator.tsx`: load classes, add the "Admit into class" select (default = applied class) plus optional note, pass both to the function.
- No new tables or columns  `admission_applications.admitted_to_class_id` already exists and is already consumed by `verify-acceptance-payment` and `paystack-webhook`.
