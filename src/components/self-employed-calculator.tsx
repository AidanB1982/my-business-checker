"use client";
import { useState } from "react";
import Link from "next/link";
import { calculateSelfEmployed } from "@/lib/calculators/self-employed";
import { selfEmployedRules, selfEmployedSources, type TaxYear } from "@/rules/self-employed";
const gbp = (pence: number) => new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP"}).format(pence / 100);
type Result = ReturnType<typeof calculateSelfEmployed>;
export function SelfEmployedCalculator() {
  const [year, setYear] = useState<TaxYear>("2026/27");
  const [region, setRegion] = useState("england");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  function clearResult() { setResult(null); setError(""); }
  return <>
    <div className="notice"><strong>Development estimate · source review pending</strong><p>For sole traders in England, Wales or Northern Ireland who are aged 16 or over and below State Pension age throughout the tax year. Scotland is not supported yet. The rule snapshots need current HMRC source verification before release.</p></div>
    <div className="calculator tax-calculator">
      <form onChange={clearResult} onSubmit={event => {
        event.preventDefault(); clearResult();
        const form = new FormData(event.currentTarget);
        try {
          if (!["england", "wales", "northern-ireland"].includes(region)) throw new Error("Scottish Income Tax is not supported. Please use the official guidance.");
          const money = (name: string) => { const value = form.get(name); if (value === null || String(value).trim() === "") throw new Error("Complete all income and expense fields. Enter 0 where needed."); return Number(value); };
          setResult(calculateSelfEmployed({income: money("income"), expenses: money("expenses"), otherIncome: money("otherIncome"), region: region as "england" | "wales" | "northern-ireland"}, selfEmployedRules[year]));
        } catch (err) { setError(err instanceof Error && !err.message.startsWith("[") ? err.message : "Enter valid amounts from £0 to £10,000,000, using no more than two decimal places."); }
      }}>
        <h2>Your figures</h2>
        <label htmlFor="tax-year">Tax year</label><select id="tax-year" value={year} onChange={event => { setYear(event.target.value as TaxYear); clearResult(); }}><option>2026/27</option><option>2025/26</option></select>
        <label htmlFor="tax-region">Where do you pay Income Tax?</label><select id="tax-region" value={region} onChange={event => { setRegion(event.target.value); clearResult(); }}><option value="england">England</option><option value="wales">Wales</option><option value="northern-ireland">Northern Ireland</option><option value="scotland">Scotland — not supported yet</option></select>
        {region === "scotland" && <p role="status" className="field-help">Scotland uses different Income Tax bands. This calculator cannot estimate your tax. <a className="text-link" href="https://www.gov.uk/scottish-income-tax">See Scottish Income Tax guidance.</a></p>}
        <label htmlFor="business-income">Business income (£)</label><p className="field-help" id="income-help">Annual turnover before expenses. Exclude VAT you collect.</p><input id="business-income" name="income" type="number" min="0" max="10000000" step="0.01" inputMode="decimal" required defaultValue="72000" aria-describedby="income-help"/>
        <label htmlFor="business-expenses">Allowable business expenses (£)</label><p className="field-help" id="expense-help">Actual allowable expenses. The trading allowance is not applied.</p><input id="business-expenses" name="expenses" type="number" min="0" max="10000000" step="0.01" inputMode="decimal" required defaultValue="14000" aria-describedby="expense-help"/>
        <label htmlFor="other-income">Other non-savings income (£)</label><p className="field-help" id="other-help">Before the Personal Allowance, for example employment or pension income. Exclude savings and dividends. Tax on this income is shown separately; PAYE already paid is not deducted.</p><input id="other-income" name="otherIncome" type="number" min="0" max="10000000" step="0.01" inputMode="decimal" required defaultValue="0" aria-describedby="other-help"/>
        <div className="eligibility"><input id="eligibility" type="checkbox" required/><label htmlFor="eligibility">I meet the age and location assumptions above and understand that pension relief, student loans and other exclusions below are not included.</label></div>
        <button className="button" type="submit" disabled={region === "scotland"}>Calculate my take-home →</button>
        {error && <p role="alert" className="field-error">{error}</p>}
        <p className="fine">No account needed. These figures are calculated in your browser and are not saved or sent to Supabase.</p>
      </form>
      <section className="result" aria-live="polite" aria-atomic="true">
        <p className="eyebrow">Your business estimate</p>
        {result ? <>
          <p className="result-label">Annual business take-home</p><h2>{gbp(result.takeHomePence)}</h2><p>{gbp(result.monthlyTakeHomePence)} per month on average</p>
          <dl className="tax-breakdown"><dt>Business income</dt><dd>{gbp(result.incomePence)}</dd><dt>Allowable expenses</dt><dd>{gbp(result.expensesPence)}</dd><dt>Estimated profit</dt><dd>{gbp(result.profitPence)}</dd><dt>Income Tax attributable to business</dt><dd>{gbp(result.businessIncomeTaxPence)}</dd><dt>Class 4 National Insurance</dt><dd>{gbp(result.class4Pence)}</dd><dt><strong>Business tax and NI estimate</strong></dt><dd><strong>{gbp(result.businessTaxPence)}</strong></dd></dl>
          <h3>How much should I put aside?</h3><p>About <strong>{gbp(result.monthlySetAsidePence)} each month</strong> covers the business tax and Class 4 NI estimated here. Payments on account can mean you need more cash at payment time.</p>
          {result.lossPence > 0 && <p>Your expenses exceed income by {gbp(result.lossPence)}. We use £0 taxable profit and do not calculate loss relief or a refund. Actual business cash flow is negative before tax.</p>}
          <details><summary>Why is it that number?</summary><p>Your profit is income less expenses, with a minimum taxable profit of £0. Personal Allowance used: {gbp(result.incomeTax.allowancePence)}.</p><p>Total Income Tax on business profit plus other income: {gbp(result.incomeTax.totalPence)}. Income Tax on your other income alone: {gbp(result.otherIncomeTaxPence)}. The difference is attributed to your business.</p><ul>{result.incomeTax.bands.map(band => <li key={band.label}>{band.label}: {gbp(band.taxablePence)} × {band.rate * 100}% = {gbp(band.taxPence)}</li>)}</ul><p>Class 4 NI uses business profit only: {gbp(result.mainClass4Pence)} at the main rate and {gbp(result.upperClass4Pence)} above the upper limit.</p></details>
          <p className="fine">Tax year {result.taxYear} · Rule set {result.ruleSetVersion} · HMRC source review pending. This is an estimated liability, not your Self Assessment balance due. Tax already paid is not deducted.</p>
        </> : <><h2>A clearer picture<br/>starts here.</h2><p>Enter your annual figures and calculate to see your tax, National Insurance and business take-home estimate.</p><p>Your result will explain what went into the calculation and what to check next.</p></>}
      </section>
    </div>
    <section className="section"><h2>Important assumptions</h2><ul><li>One sole-trader business using actual allowable expenses. No trading allowance, capital allowances or loss relief.</li><li>Other income is non-savings income. The estimate does not calculate dividends, savings interest, capital gains or rental-business rules.</li><li>No pension contributions, Gift Aid, Marriage Allowance, student or postgraduate loans, Child Benefit charge or other reliefs and charges.</li><li>Class 4 NI only. No employment NI, voluntary Class 2 NI, annual maximum adjustments or age-transition rules. NI credits and voluntary contributions may still matter.</li><li>No tax already paid, payments on account, refunds, penalties or interest. Monthly figures divide the annual estimate by 12; they are not a payment schedule.</li><li>For other income, business take-home deducts only the extra Income Tax attributable to business profit, plus Class 4 NI. It does not include other income in take-home.</li></ul></section>
    <section className="notice"><h2>What should I check next?</h2><p>VAT registration looks at taxable turnover, not profit. Check rolling 12-month turnover and the separate next-30-days test.</p><Link className="text-link" href="/tools/vat-threshold-checker">Explore the VAT checker →</Link><p>Making Tax Digital considers qualifying gross self-employment and property income in the relevant reference year, rather than the profit estimated here.</p><Link className="text-link" href="/tools/mtd-checker">Explore Making Tax Digital →</Link></section>
    <section className="section"><h2>Rules and official sources</h2><p>2025/26 and 2026/27 are separate, versioned draft snapshots. These source links are provided for checking; current source review is pending. No review date is claimed.</p><ul>{selfEmployedSources.map(source => <li key={source.url}><a className="text-link" href={source.url}>{source.label} →</a></li>)}</ul><p>Informational estimates only, not personalised tax or financial advice.</p></section>
  </>;
}
