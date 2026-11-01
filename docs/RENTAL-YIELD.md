# Rental yield and mortgage planner

## Scope and provenance

The owner requested a landlord mortgage planner to show gross/net rental yield, supplied the £200,000 / £1,000 monthly rent / £4,000 annual cost example, and authorised useful related additions. The new `/tools/rental-yield-mortgage-planner` is linked from `/landlords`, the tool catalogue, guides and a native lesson. No original file is distributed.

Gross/net formulas follow the supplied definitions. A useful distinction is made explicit: net **operating** yield excludes finance; before-tax **cash flow** deducts the full regular mortgage payment. No statutory mortgage-interest tax relief, personal/company tax, Stamp Duty/devolved purchase tax, mortgage offer, lender underwriting decision or house-price forecast is implemented. User-provided MoneySuperMarket/NatWest links are contextual references; no independent retrieval or validation of those pages is claimed.

## Inputs

- Purchase price or current market value; positive denominator, maximum £10m.
- Monthly or weekly rent; annualised using 12 or 52 respectively.
- Voids in weeks, 0–52, at most one decimal place.
- Management percentage on expected receipts, plus annual maintenance, insurance, service charges/ground rent and other running costs.
- Mortgage amount/current balance, interest-only or repayment, nominal annual rate 0–25%, whole remaining years 1–40, and an editable higher-rate increase 0–10 percentage points.
- For a purchase: buying costs and initial cash-funded works, entered directly rather than calculated from legal/tax rules.
- For a current-value scenario: separately entered actual cash invested, not assumed current equity.
- Saved report reference tax year: a label, not allocation of the next twelve mortgage months to a tax return.

Prefilled figures are labelled examples and only sent to the account through the existing explicit save/consent action. Rates and percentages are limited to two decimal places. Money is validated to pennies.

## Yield, costs and cash flow

1. Scheduled annual rent = monthly rent × 12 or weekly rent × 52.
2. Vacancy loss = annual rent × vacant weeks / 52, rounded to pence.
3. Expected receipts = scheduled rent − vacancy loss.
4. Management fees = expected receipts × entered management percentage, rounded to pence.
5. Operating costs = management fees + annual entered fixed running costs. Fixed costs continue during voids.
6. Operating income = expected receipts − operating costs.
7. Gross scheduled yield = scheduled annual rent / entered property value × 100.
8. Gross yield after voids = expected receipts / same property value × 100.
9. Net operating yield = operating income / same property value × 100, before all finance and tax.
10. First-year cash flow = operating income − first twelve regular mortgage payments. Average monthly cash flow is that result / 12, rounded to pence.

Vacancy loss and mortgage payments must not be entered again as running costs. Purchase costs and initial capital work are outside annual operating costs and the property-value yield denominator. Cost classification/tax eligibility is not inferred.

## Mortgage illustration

For balance P, monthly nominal rate r = annual percentage / 1200, and n = years × 12:

- Interest-only regular payment = P × r, rounded to pence. Principal remains outstanding, including at term end. Final capital redemption is excluded from **regular-payment** cash flow and shown separately as the term-end amount owed.
- Repayment regular payment = P × r / (1 − (1 + r)^−n), rounded to pence. The denominator uses `expm1`/`log1p` for numerical stability near zero rates.
- At a zero rate, repayment payment = P / n, rounded; positive penny balances have a minimum 1p payment.
- Each month's interest is rounded to a penny; payment minus interest reduces principal. Payments are capped at the balance plus interest. The final repayment instalment settles accumulated rounding differences, never a negative balance.
- A zero loan produces no finance payment or interest. An interest-only zero-rate loan still has its principal owing.

Both repayment types are shown with the same starting loan, rate and term. The selected mortgage's year-by-year table shows payments, interest, principal repaid and closing balance. It is not a forecast of rent, future products or property prices. Rate is assumed constant for the whole remaining term; fees, daily-interest conventions, overpayments and early repayment charges are excluded.

## Extra planning measures

- LTV = loan / entered property value. Over-100% LTV/negative equity is permitted as an existing-property scenario, not approved borrowing.
- Equity = property value − loan. This is explicitly not labelled cash invested.
- For a purchase, own cash basis = price − loan + entered buying costs + initial cash-funded works, only where loan does not exceed price. More complex financing does not get an invented deposit/cash return.
- For an existing property, own cash basis is the separately entered actual invested cash after cash returned to the investor; 0 means unknown/not positive.
- Cash-on-cash return = first-year cash flow / positive own cash basis × 100. Debt principal repaid and capital growth are not added to cash income.
- Break-even scheduled monthly rent = (fixed annual operating costs + first-year regular mortgage payments) / [(1 − void weeks/52) × (1 − management percentage/100)] / 12, rounded up to a penny.
- Break-even occupancy = (fixed costs + first-year payments) / [scheduled annual rent × retained management fraction] × 100. Values over 100% remain visible as unachievable; they are not clipped to a pass result.
- Impossible positive-cost cases with zero occupancy or 100% fees return a clear unavailable/unattainable result, not infinity. Zero required costs and borrowing can break even at zero rent.
- Illustrative rent-to-interest cover = expected rent after voids / first-year interest. It is not a lender-specific ICR or underwriting threshold. No positive interest charge means no ratio rather than division by zero.
- The higher-rate scenario uses current nominal rate + entered percentage-point increase and the same starting loan and remaining term. It displays payment and first-year cash flow, not a lender stress-test approval.

## Reproducible reports and comparisons

The new tool uses `rental-yield-1` snapshots through the existing server-recalculated Advanced save API and ownership controls. No database migration or environment setting is required. Old snapshot formats remain accepted; `percentage` is an additional metric unit. HTML/CSV reports format yield/rate metrics as percentages. Scenario-comparison percentage differences display **pp** (percentage points), not relative percentage changes. Cash values remain pounds/pence.

The save captures all inputs and summary metrics, including selected basis, operating costs, mortgage interest/capital, higher-rate results and the alternative repayment type. The browser's full amortisation table is an illustration; the standard exported report contains summary metrics and the saved inputs rather than a duplicated long schedule.

## Fixtures and verification

Default example:

- Value £200,000; monthly rent £1,000; no voids.
- Management 10% (£1,200/year), maintenance £1,500, insurance £500, service charges £0, other costs £800: total operating costs £4,000.
- Gross yield 6%; net operating yield 4%; operating income £8,000.
- £150,000 interest-only mortgage at 5%: £625/month and £7,500 annual interest; first-year cash flow £500. Capital still owing at term end £150,000.
- Buying costs £10,000; own cash basis £60,000; cash-on-cash return 0.8333…%.
- Break-even scheduled monthly rent £953.71; occupancy 95.3703…%; illustrative rent/interest cover 1.6.
- A +2 percentage-point rate scenario means 7%, £875/month and −£2,500 annual cash flow, a £3,000 reduction.

An independent Python Decimal calculation (40-digit precision, half-up penny interest) confirms a £150,000, 5%, 25-year repayment loan: regular payment £876.89; first-year payments £10,522.68; interest £7,429.78; principal repaid £3,092.90; balance £146,907.10. With the same £8,000 operating income, cash flow is −£2,522.68. At term end, the repayment balance is zero after final rounding settlement.

Tests include weekly rent, partial/full voids, management fees, 0% rates, zero loans, negative cash flow/yields, zero/negative/unknown cash bases, excessive precision, near-limit scenarios, amortisation principal conservation, first-year repayment fixtures, unchanged operating yield when borrowing changes, rates measured in percentage points and validated percentage-format snapshots. Browser checks exercise current versus repayment results, the higher-rate panel, weekly inputs, no borrowing, mobile overflow, stale-result clearing and the final repayment balance.
