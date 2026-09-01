# Finance module rebuild + timetable crash fix

## 1. Timetable "+" crash
Clicking an empty slot opens the entry dialog, which crashes to the "Something went wrong" screen. The room dropdown already uses a "No room" sentinel, so the remaining risk is option lists rendering an item whose id is missing.

- Filter out any subject / teacher / room / class option without a valid id before rendering.
- Reset the dialog form to a clean state on open so no stale value reaches the dropdowns.
- Give the dialog an accessible description (removes the console warning).
- Verify by opening the dialog and saving an entry.

## 2. Remove Analytics
Delete the Analytics entry from the admin sidebar, its route case in the dashboard, and the `AnalyticsDashboard` component file. (Admissions analytics inside the Admissions hub stays.)

## 3. Fee management → full Finance module
Rename the "Fees" area to **Finance** with these sections:

**Income (fees)**  keeps and repairs what exists:
- Fix the Overview: it still uses a broken student/profile join, so defaulter names fail. Rebuild the numbers as Billed / Collected / Outstanding / Collection rate, with month-on-month collection trend and class-level breakdown.
- Fee structures, student balances, installment plans, payments, receipts, reminders, reconciliation stay as tabs.

**Expenses**  new:
- Expense categories (salaries, utilities, maintenance, supplies, transport, etc.)
- Expense records: date, category, payee/vendor, description, amount, payment method, reference, receipt attachment, status (pending/approved/paid), recorded-by and approved-by.
- List with filters (date range, category, status), approve/mark-paid actions, CSV export.

**Other revenue**  new: income that is not school fees (uniforms, books, events, donations, rent), with category, date, source, amount, reference.

**Financial reports**  new:
- Income vs expenses summary for a chosen period (term, month, custom range)
- Profit/surplus figure, expense breakdown by category, revenue breakdown by source
- Cash-flow style monthly table and CSV export

## 4. Payroll reworked as a professional module
- **Salary structures**: per-staff basic pay plus named allowance and deduction components (housing, transport, tax, pension, loans) instead of three flat numbers.
- **Period run**: create a month, load staff, auto-compute gross → deductions → net from each staff member's salary structure, edit any line, add one-off bonuses or deductions.
- **Approval flow**: draft → approved → paid, with the period locked once paid.
- **Payslips**: branded printable payslip per staff member and bulk print; CSV bank-transfer schedule export.
- **Staff view**: staff see their own payslips from their dashboard.
- **Fees/finance link**: marking a payroll period paid posts a single "Salaries" expense entry for that month into Expenses, so payroll flows into the financial reports automatically.

## Technical notes
- New tables: `expense_categories`, `expenses`, `revenue_categories`, `other_revenue`, `salary_components` (per staff), plus columns on `payroll_items` for a component breakdown and on `payroll_periods` for the posted expense reference. All admin-only via RLS, with staff able to read their own payroll rows.
- A reporting SQL function returns income (fee payments + other revenue) and expenses (expense records) aggregated by month/category for a date range, so the reports tab is one round trip.
- Frontend: `FeesHub` becomes `FinanceHub` with Income / Expenses / Other revenue / Payroll / Reports groups; existing fee components are reused unchanged where they already work.
