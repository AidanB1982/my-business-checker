# Employee salary and pension tools

## Salary take-home checker

Route: `/tools/salary-take-home-calculator`.

Inputs: tax year (2025/26 or 2026/27), UK tax region, annual reference salary, employee/employer pension percentages, contribution basis, pension method, one undergraduate student-loan plan and optional postgraduate loan.

The percentage can be based on full original/reference salary or the draft qualifying-earnings band (£6,240–£50,270). Employer contribution percentages use the same basis, including for salary sacrifice; a real employer may have a different policy. Income Tax uses the existing regional rule snapshots. Monthly category A NI in the employment draft uses a £1,048 primary threshold, £4,189 upper limit and 8%/2% employee rates for both supported years. Student/postgraduate deductions use NI cash pay and the selected year's monthly loan threshold, rounded down to whole pounds per month. These new payroll assumptions need independent official-source review.

- **Salary sacrifice:** the selected gross employee-directed amount reduces contractual cash salary. Tax, NI and student-loan bases reduce accordingly. It is pension funding paid by the employer, not an additional cash deduction. The total pension credit is this amount plus the employer's base contribution, counted once.
- **Net pay:** the employee pension contribution reduces taxable pay, but not NI/student-loan pay. The contribution is deducted in full from cash.
- **Relief at source:** select whether the percentage means gross pension credit or the net cash percentage actually deducted. Basic provider relief is included once. Payroll Income Tax is calculated before any additional relief claim; the after-claim result is explicitly separate. Scottish additional relief uses the shared tax-band extension logic.

The calculation assumes standard full-year monthly employee payroll, age 21 or over and below State Pension age. It does not implement a personalised tax code, cumulative PAYE history, bonuses, benefits in kind, multiple jobs, director annual NI, pension allowance charges, loan-balance caps, multiple undergraduate plans, salary-sacrifice minimum-wage tests or scheme eligibility. Monthly take-home is an annual planning average and may differ from an actual payslip. Employer NI savings are gross liability differences before allowances and are not automatically credited to the pension.

Fixture at £72,000, 5% gross employee pension and 3% employer pension, full salary, England, 2026/27, no loans: net-pay take-home £50,158/year; salary-sacrifice £50,230/year; relief-at-source payslip cash £49,438/year plus £720 additional relief potentially claimable. Each credits £5,760/year to the pension under the stated employer policy.

## Pension pot predictor

Route: `/tools/pension-pot-predictor`.

Inputs: current salary and defined-contribution pension pot, current and target ages, gross employee/employer pension percentages, contribution basis, annual salary growth (default 0%), investment growth (default 5% before fees), annual fee (default 0.5%), inflation (default 2.5%) and an example withdrawal percentage (default 4%). These are editable scenario assumptions, not recommended or guaranteed returns.

Each month's growth factor is `((1 + annual growth) × (1 − annual fee))^(1/12)`. The existing balance grows by that factor, then gross employee and employer contributions are added at month end. Salary increases, if selected, occur after each twelve-month period. Qualifying-earnings bounds remain frozen at the selected reference-year values in this scenario.

The chart/table shows nominal future money and today's money (`future balance ÷ (1 + inflation)^years`). The no-growth/no-fee baseline is current pot plus the same future contributions. The displayed annual withdrawal is simply final pot × selected percentage, before personal tax; it does not model drawdown survival or an annuity. No State Pension, defined-benefit pension, tax-free cash, future legislation, pension allowance charges, contribution gaps or access-age eligibility is calculated.

Employee percentages are gross money reaching the pension. For example, 4% net plus 1% provider relief is entered as 5% here, not 4% followed by a second top-up. Employer contributions are added separately once. At £72,000 salary, 5% employee and 3% employer, £10,000 current pot, ten years, zero growth/fees/inflation and no salary changes, the pot is £67,600.

Both tools calculate locally and use the existing explicit-save Advanced API, server recalculation, snapshots, comparisons and reports. No new database migration is needed. Projection reports preserve summary metrics and inputs; the interactive yearly chart is part of the live tool.
