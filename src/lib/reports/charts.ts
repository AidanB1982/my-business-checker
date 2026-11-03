import type { CalculationSnapshot,Metric } from './calculations';
export type ChartRow={label:string;value:number;unit:Metric['unit'];tone?:'income'|'cost'|'neutral'};
export type ChartGroup={title:string;note:string;rows:ChartRow[]};
type Spec={title:string;note:string;keys:string[]};
const specs:Partial<Record<CalculationSnapshot['toolSlug'],Spec[]>>={
 'business-mileage-calculator':[{title:'Business miles by rate band',note:'Qualifying miles split by the selected year’s mileage bands. The resulting allowance is a potential expense, not tax saved.',keys:['firstMiles','additionalMiles']}],
 'salary-take-home-calculator':[{title:'Where your annual salary goes',note:'Annual amounts. Pension sacrifice and pension cash deductions are shown separately; employer contributions are outside your salary.',keys:['annualTakeHome','incomeTax','ni','sacrifice','pensionDeduction','studentLoan','postgraduate']}],
 'self-employed-tax-calculator':[{title:'Business cash and deductions',note:'Annual amounts after entered expenses. Loans shown are the amounts still due, including the effect of any other income entered. Negative cash is a shortfall.',keys:['takehome','incomeTax','ni','pension','studentDue','postgradDue']}],
 'sole-trader-working-sheet':[{title:'Your month at a glance',note:'Receipts, business costs and operating surplus are compared, not added together. Drawings and private costs remain separate in the workings.',keys:['receipts','businessCosts','surplus','drawings','reserve','cash']}],
 'landlord-rent-reconciliation':[{title:'Rent and arrears',note:'Current and older rent due is separate from advance rent for future periods. This is a rent control, not profit.',keys:['due','gross','arrears','advance']},{title:'Agent statement check',note:'Expected and actual closing balances should agree. A difference needs investigation.',keys:['expected','actual','difference']}],
 'property-maintenance-reserve':[{title:'Funding your maintenance plan',note:'Totals over the chosen horizon. A negative closing reserve is a funding gap. Immediate funding and the largest shortfall overlap; do not add them together.',keys:['spend','contributions','immediate','shortfall','ending']}],
 'rental-yield-mortgage-planner':[{title:'First-year rent and cash flow',note:'Before tax. Costs, mortgage interest and capital repayments are shown separately. Cash flow is what remains, not taxable profit.',keys:['collected','operatingCosts','interest','principal','annualCash']},{title:'Yield before mortgage finance',note:'Both yields use the same property-value basis. Gross yield is before voids; net operating yield deducts voids and operating costs.',keys:['grossYield','netYield']},{title:'Mortgage scenarios: first-year cash flow',note:'Current, higher-rate and alternative mortgage-type scenarios share the entered rent and operating costs. Negative values are shortfalls.',keys:['annualCash','stressCash','alternativeCash']}],
 'vat-threshold-checker':[{title:'Rolling turnover against the VAT threshold',note:'The rolling 12-month test is separate from the next-30-days test. These amounts must not be added together.',keys:['turnover','threshold']},{title:'Next 30 days alone against the VAT threshold',note:'Compare the next 30 days alone with the threshold. The charts do not determine exceptions or earlier obligations.',keys:['forecast','threshold']}],
 'mtd-checker':[{title:'Reference-year income and threshold',note:'This is the selected reference-year test, not a completion score or a final eligibility decision. Exemptions and earlier obligations still matter.',keys:['income','threshold']}],
 'salary-dividend-calculator':[{title:'Compare annual personal take-home',note:'Both scenarios use the same company budget. This is a comparison of your choices, not an optimal-salary recommendation.',keys:['takehome','salaryOnly']}],
 'pension-pot-predictor':[{title:'What makes up the projected pension pot',note:'Future contributions plus the starting pot and illustrated investment change after fees. Investment change may be negative.',keys:['initialPot','employeeContributions','employerContributions','investmentChange']},{title:'Future value and purchasing power',note:'These are alternative views of the same target-age pot, not amounts to add together.',keys:['pot','realPot','baseline']}],
};
const incomeKeys=new Set(['annualTakeHome','takehome','salaryOnly','receipts','surplus','cash','collected','annualCash','stressCash','alternativeCash','gross','ending','pot','realPot','baseline']);
const costKeys=new Set(['incomeTax','ni','sacrifice','pensionDeduction','studentLoan','postgraduate','pension','studentDue','postgradDue','businessCosts','drawings','operatingCosts','interest','principal','spend']);
export function chartGroups(snapshot:CalculationSnapshot):ChartGroup[]{
 return (specs[snapshot.toolSlug]??[]).flatMap(spec=>{
  const rows=spec.keys.flatMap(key=>{const metric=snapshot.metrics.find(item=>item.key===key);return metric&&typeof metric.value==='number'&&Number.isFinite(metric.value)?[{label:metric.label,value:metric.value,unit:metric.unit,tone:incomeKeys.has(key)?'income' as const:costKeys.has(key)?'cost' as const:'neutral' as const}]:[];});
  return rows.length? [{title:spec.title,note:spec.note,rows}]:[];
 });
}
// All rows in a figure share a scale and a zero baseline, including losses.
export function barDomain(rows:ChartRow[]){const values=rows.map(row=>row.value);const min=Math.min(0,...values),max=Math.max(0,...values);const span=max-min||1;return {min,max,zero:(-min/span)*100,span};}
export function barGeometry(value:number,domain:ReturnType<typeof barDomain>){return {left:(Math.min(0,value)-domain.min)/domain.span*100,width:Math.abs(value)/domain.span*100};}
export function comparisonGroups(left:CalculationSnapshot,right:CalculationSnapshot,leftName:string,rightName:string):ChartGroup[]{
 if(left.toolSlug!==right.toolSlug)return [];
 const preferred=specs[left.toolSlug]?.[0]?.keys??['allowance'];
 return preferred.flatMap(key=>{const a=left.metrics.find(item=>item.key===key),b=right.metrics.find(item=>item.key===key&&item.unit===a?.unit);if(!a||!b||typeof a.value!=='number'||typeof b.value!=='number')return [];
  return [{title:a.label,note:'Each pair uses one shared scale. Scales differ between measures; compare values within each pair.',rows:[{label:`${leftName} · ${left.taxYear}`,value:a.value,unit:a.unit,tone:'income' as const},{label:`${rightName} · ${right.taxYear}`,value:b.value,unit:b.unit,tone:'neutral' as const}]}];
 });
}
