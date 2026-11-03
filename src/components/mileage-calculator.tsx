"use client";
import { CalculationCharts } from "./calculation-charts";
import { buildSnapshot } from "@/lib/reports/calculations";
import { CalculationActions } from "./calculation-actions";
import { useState } from "react";
import { calculateMileage, mileageRuleSets, type MileageTaxYear } from "@/lib/calculators/mileage";
const money = new Intl.NumberFormat("en-GB", {style:"currency", currency:"GBP"});
export function MileageCalculator() {
  const [year, setYear] = useState<MileageTaxYear>("2026/27");
  const [result, setResult] = useState<ReturnType<typeof calculateMileage> | null>(null);
  const [error,setError]=useState("");
  const rules = mileageRuleSets[year];
  return <>
    <div className="calculator">
      <form onSubmit={event=>{
        event.preventDefault();setError("");setResult(null);
        const value=new FormData(event.currentTarget).get("miles");
        try {if(value===null || String(value).trim()==="")throw new Error("Enter your business miles.");setResult(calculateMileage(Number(value),rules));}
        catch(err){setError(err instanceof Error?err.message:"Check your miles.");}
      }}>
        <h2>Your journey details</h2>
        <p className="eyebrow">Cars and vans · {year}</p>
        <label htmlFor="mileage-tax-year">Tax year</label>
        <select id="mileage-tax-year" value={year} onChange={event=>{setYear(event.target.value as MileageTaxYear);setResult(null);setError("");}}><option>2026/27</option><option>2025/26</option></select>
        <p className="fine">{rules.firstBandPence}p per mile for the first {rules.firstBandMiles.toLocaleString("en-GB")} qualifying miles, then {rules.additionalPence}p per mile.</p>
        <label htmlFor="miles">Qualifying business miles</label>
        <p id="miles-help" className="fine">For one eligible vehicle across the selected tax year. Exclude ordinary commuting. This estimates a sole-trader expense, not an employee reimbursement or company-car fuel claim.</p>
        <input id="miles" name="miles" type="number" min="0" max="1000000" step="0.1" required aria-describedby="miles-help" onChange={()=>{setResult(null);setError("");}}/>
        <button className="button" type="submit">Estimate mileage allowance →</button>
        {error && <p role="alert">{error}</p>}
      </form>
      <section className="result" aria-live="polite" aria-atomic="true"><p className="eyebrow">Your estimate</p>
        {result ? <>
          <h2>{money.format(result.allowancePence/100)}</h2><p>Potential allowable expense, subject to eligibility.</p>
          <dl><dt>Miles at {rules.firstBandPence}p</dt><dd>{result.firstBandMiles.toLocaleString("en-GB")}</dd><dt>Miles at {rules.additionalPence}p</dt><dd>{result.additionalMiles.toLocaleString("en-GB")}</dd></dl>
          <p className="fine">Rule set {result.ruleSetVersion} · {result.taxYear}. This is an expense estimate, not your tax saving. Rates match the supplied HMRC guidance, updated 21 May 2026.</p>
        </> : <><h2>Let’s work it out.</h2><p>Choose a tax year and enter your business miles to see the breakdown. Your figures stay in your browser.</p></>}
      </section>
    </div>
    {result&&<CalculationCharts snapshot={buildSnapshot({toolSlug:"business-mileage-calculator",taxYear:year,inputs:{miles:result.firstBandMiles+result.additionalMiles}})}/>}
    {result&&<CalculationActions calculation={{toolSlug:"business-mileage-calculator",taxYear:year,inputs:{miles:result.firstBandMiles+result.additionalMiles}}}/>}
    <section className="notice"><h2>Rates and sources</h2>
      <p><a className="text-link" href="https://www.gov.uk/government/publications/rates-and-allowances-travel-mileage-and-fuel-allowances/travel-mileage-and-fuel-rates-and-allowances">HMRC mileage rates and allowances →</a> (updated 21 May 2026) lists 55p for the first 10,000 business miles in 2026/27 and 25p thereafter. The earlier 2025/26 rate is 45p, then 25p.</p>
      <p>The selected {year} snapshot applies from {year === "2026/27" ? "6 April 2026" : "6 April 2025"}. The rates were checked against the HMRC extract supplied for this update. This remains a preview of a sole-trader expense estimate.</p>
      <p>Eligibility, previous vehicle expense claims and your choice of accounting method affect whether simplified expenses can be used. Keep mileage records and do not claim the same vehicle costs twice.</p>
    </section>
  </>;
}
