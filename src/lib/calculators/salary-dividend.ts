import { z } from 'zod';
import { businessRules as rules,dividendRates } from '../../rules/business';
import { selfEmployedRules } from '../../rules/self-employed';
import { calculateIncomeTax } from './self-employed';
import { pounds,pence,taxYearSchema } from './validation';
export const salaryDividendInput=z.object({taxYear:taxYearSchema,region:z.enum(['england','wales','northern-ireland','scotland']),companyProfit:pounds,salary:pounds,otherIncome:pounds,associatedCompanies:z.number().int().min(0).max(99).default(0),employmentAllowance:z.boolean().default(false)}).strict();
export type SalaryDividendInput=z.input<typeof salaryDividendInput>;
export function corporationTax(profitPence:number,associatedCompanies=0){
 const lower=rules.corporationSmallLimitPence/(1+associatedCompanies),upper=rules.corporationUpperLimitPence/(1+associatedCompanies);
 if(profitPence<=lower)return Math.round(Math.max(0,profitPence)*rules.corporationSmallRate);
 if(profitPence>=upper)return Math.round(profitPence*rules.corporationMainRate);
 return Math.round(profitPence*rules.corporationMainRate-(upper-profitPence)*rules.marginalFraction);
}
export function calculateSalaryDividend(raw:SalaryDividendInput){
 const input=salaryDividendInput.parse(raw);const yearRules=selfEmployedRules[input.taxYear];const profit=pence(input.companyProfit),other=pence(input.otherIncome);
 const employerNI=(salary:number)=>Math.max(0,Math.round(Math.max(0,salary-rules.employerNIThresholdPence)*rules.employerNIRate)-(input.employmentAllowance?rules.employmentAllowancePence:0));
 function scenario(salary:number){
  const employerNIPence=employerNI(salary);if(salary+employerNIPence>profit)throw new Error('The salary and employer NI exceed the available company profit. Reduce the salary.');
  const companyTaxableProfitPence=profit-salary-employerNIPence;const corporationTaxPence=corporationTax(companyTaxableProfitPence,input.associatedCompanies);
  const dividendPence=companyTaxableProfitPence-corporationTaxPence;
  const totalIncome=other+salary+dividendPence;
  const incomeTax=calculateIncomeTax(other+salary,yearRules,input.region,{adjustedNetIncomePence:totalIncome});
  const baselineTax=calculateIncomeTax(other,yearRules,input.region).totalPence;
  // Dividends use UK bands even for Scottish taxpayers. The dividend allowance
  // occupies a band at 0%; it is not a deduction from income or adjusted income.
  const nonSavingsTaxable=Math.max(0,other+salary-incomeTax.allowancePence);
  const unusedPersonalAllowance=Math.max(0,incomeTax.allowancePence-other-salary);
  const taxableDividend=Math.max(0,dividendPence-unusedPersonalAllowance);
  const allowance=Math.min(taxableDividend,rules.dividendAllowancePence);
  const rates=dividendRates[input.taxYear];const bands=[{end:yearRules.basicBandPence,rate:rates.basic},{end:yearRules.additionalRateThresholdPence,rate:rates.higher},{end:Infinity,rate:rules.dividendAdditionalRate}];
  let position=nonSavingsTaxable+allowance,remaining=taxableDividend-allowance,dividendTaxPence=0;
  for(const band of bands){const used=Math.min(remaining,Math.max(0,band.end-position));dividendTaxPence+=Math.round(used*band.rate);position+=used;remaining-=used;}
  const salaryTaxPence=incomeTax.totalPence-baselineTax;
  const employeeNIPence=Math.round(Math.max(0,Math.min(salary,rules.employeeNIUpperPence)-rules.employeeNILowerPence)*rules.employeeNIRate)+Math.round(Math.max(0,salary-rules.employeeNIUpperPence)*rules.employeeNIUpperRate);
  const totalTaxPence=employerNIPence+corporationTaxPence+salaryTaxPence+dividendTaxPence+employeeNIPence;
  return {salaryPence:salary,employerNIPence,corporationTaxPence,dividendPence,salaryTaxPence,dividendTaxPence,employeeNIPence,totalTaxPence,takeHomePence:salary+dividendPence-salaryTaxPence-dividendTaxPence-employeeNIPence};
 }
 // Binary search in pence to compare the same company budget with salary only.
 let low=0,high=profit;while(low<high){const mid=Math.ceil((low+high)/2);if(mid+employerNI(mid)<=profit)low=mid;else high=mid-1;}
 const salaryOnly=scenario(low);const chosen=scenario(pence(input.salary));
 return {chosen,salaryOnly,differencePence:chosen.takeHomePence-salaryOnly.takeHomePence,taxYear:input.taxYear,region:input.region,ruleSetVersion:rules.version};
}
