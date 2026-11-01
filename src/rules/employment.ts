import type { TaxYear } from './self-employed';
const shared={version:'salary-draft-2',annualNIPrimaryPence:1257000,annualNIUpperPence:5027000,monthlyNIPrimaryPence:104800,monthlyNIUpperPence:418900,employeeNIMainRate:0.08,employeeNIUpperRate:0.02,monthlyEmployerNIThresholdPence:41700,employerNIRate:0.15,qualifyingLowerPence:624000,qualifyingUpperPence:5027000,reliefAtSourceRate:0.2,sourceReview:'pending' as const};
export const employmentRules:Readonly<Record<TaxYear,Readonly<typeof shared>>> = Object.freeze({
 '2025/26':Object.freeze({...shared}),'2026/27':Object.freeze({...shared}),
});
export const employmentSources=[
 {label:'Income Tax rates',url:'https://www.gov.uk/income-tax-rates'},
 {label:'Scottish Income Tax',url:'https://www.gov.uk/scottish-income-tax'},
 {label:'Employee National Insurance rates and letters',url:'https://www.gov.uk/national-insurance-rates-letters'},
 {label:'Salary sacrifice and PAYE',url:'https://www.gov.uk/guidance/salary-sacrifice-and-the-effects-on-paye'},
 {label:'Pension tax relief',url:'https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief'},
 {label:'Workplace pension contributions',url:'https://www.gov.uk/workplace-pensions/what-you-your-employer-and-the-government-pay'},
 {label:'Student loan repayments',url:'https://www.gov.uk/repaying-your-student-loan/what-you-pay'},
] as const;
export function pensionableEarnings(salaryPence:number,basis:'full-salary'|'qualifying-earnings',taxYear:TaxYear){
 const rules=employmentRules[taxYear];return basis==='full-salary'?salaryPence:Math.max(0,Math.min(salaryPence,rules.qualifyingUpperPence)-rules.qualifyingLowerPence);
}
