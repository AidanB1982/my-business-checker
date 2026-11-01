import { describe,expect,it } from 'vitest';
import { calculateVAT } from '../../src/lib/calculators/vat';
import { calculateMTD } from '../../src/lib/calculators/mtd';
import { calculateSalaryDividend,corporationTax } from '../../src/lib/calculators/salary-dividend';
import { calculateSelfEmployed } from '../../src/lib/calculators/self-employed';
import { selfEmployedRules } from '../../src/rules/self-employed';
import { buildSnapshot } from '../../src/lib/reports/calculations';
import { csvCell,htmlReport,csvReport } from '../../src/lib/reports/export';
const vat={months:Array(12).fill(0),next30Days:0,periodEnd:'2026-10'};
const salary={taxYear:'2026/27' as const,region:'england' as const,companyProfit:60000,salary:12570,otherIncome:0};
const self={income:72000,expenses:14000,otherIncome:0,region:'england' as const};
describe('VAT threshold tests',()=>{
 it.each([[89999.99,false],[90000,false],[90000.01,true]])('rolling turnover £%s',(total,expected)=>{expect(calculateVAT({...vat,months:[total,...Array(11).fill(0)]}).historicTest).toBe(expected);});
 it('does not add the next-30-days forecast to historic turnover',()=>{expect(calculateVAT({...vat,months:Array(12).fill(7500),next30Days:90000})).toMatchObject({historicTest:false,futureTest:false,turnoverPence:9000000});});
 it('can trigger the next-30-days-alone test without a historic breach',()=>{expect(calculateVAT({...vat,next30Days:90000.01})).toMatchObject({historicTest:false,futureTest:true,status:'registration-check-required'});});
 it('recognises existing registration',()=>{expect(calculateVAT({...vat,alreadyRegistered:true}).status).toBe('already-registered');});
 it.each([11,13])('requires exactly 12 months, not %s',length=>{expect(()=>calculateVAT({...vat,months:Array(length).fill(0)})).toThrow();});
 it('rejects negative entries',()=>{expect(()=>calculateVAT({...vat,next30Days:-1})).toThrow();});
});
describe('MTD reference years and strict thresholds',()=>{
 it.each([['2024/25',50000,'2026-04-06'],['2025/26',30000,'2027-04-06'],['2026/27',20000,'2028-04-06']] as const)('uses %s income', (referenceYear,threshold,date)=>{
  expect(calculateMTD({referenceYear,businessIncome:threshold,propertyIncome:0}).aboveThreshold).toBe(false);
  expect(calculateMTD({referenceYear,businessIncome:threshold,propertyIncome:0.01})).toMatchObject({aboveThreshold:true,startDate:date});
 });
 it('keeps possible exemptions distinct from definitive exemption',()=>{expect(calculateMTD({referenceYear:'2024/25',businessIncome:60000,propertyIncome:0,possibleExemption:true}).status).toBe('check-exemption');});
 it('does not opt an existing user out merely because income falls',()=>{expect(calculateMTD({referenceYear:'2025/26',businessIncome:0,propertyIncome:0,alreadyInMtd:true}).status).toBe('already-in-mtd');});
});
describe('company and personal tax comparison',()=>{
 it.each([[0,0],[50000,950000],[100000,2275000],[250000,6250000]])('Corporation Tax on £%s',(profit,tax)=>{expect(corporationTax(profit*100)).toBe(tax);});
 it('divides small and upper thresholds for associated companies',()=>{expect(corporationTax(5000000,1)).toBe(1137500);});
 it('includes employer NI, company tax and both personal taxes',()=>{
  const result=calculateSalaryDividend(salary).chosen;
  expect(result.employerNIPence).toBe(113550);expect(result.corporationTaxPence).toBeGreaterThan(0);expect(result.dividendTaxPence).toBeGreaterThan(0);
  expect(result.takeHomePence+result.totalTaxPence).toBe(6000000);
 });
 it('uses different dividend rates in each year',()=>{
  const older=calculateSalaryDividend({...salary,taxYear:'2025/26'});const newer=calculateSalaryDividend(salary);
  expect(newer.chosen.dividendTaxPence).toBeGreaterThan(older.chosen.dividendTaxPence);
 });
 it('does not assume Employment Allowance eligibility',()=>{
  expect(calculateSalaryDividend(salary).chosen.employerNIPence).toBe(113550);
  expect(calculateSalaryDividend({...salary,employmentAllowance:true}).chosen.employerNIPence).toBe(0);
 });
 it('handles Scottish salary and UK dividend tax separately',()=>{
  const scottish=calculateSalaryDividend({...salary,region:'scotland',salary:30000});const english=calculateSalaryDividend({...salary,salary:30000});
  expect(scottish.chosen.salaryTaxPence).not.toBe(english.chosen.salaryTaxPence);
  expect(scottish.chosen.dividendTaxPence).toBe(english.chosen.dividendTaxPence);
 });
 it('rejects a salary the company cannot fund',()=>{expect(()=>calculateSalaryDividend({...salary,salary:60000})).toThrow(/exceed/);});
 it('never chooses a salary whose company cost exceeds the common budget',()=>{
  for(const companyProfit of [0,100,5000,10000,60000,100000,1000000]){
   const result=calculateSalaryDividend({...salary,companyProfit,salary:0});
   expect(result.salaryOnly.salaryPence+result.salaryOnly.employerNIPence).toBeLessThanOrEqual(companyProfit*100);
   expect(result.salaryOnly.takeHomePence+result.salaryOnly.totalTaxPence).toBe(companyProfit*100);
  }
 });
});
describe('pension, loans and payments on account',()=>{
 const rules=selfEmployedRules['2026/27'];
 it('grosses up net relief-at-source contributions and extends bands',()=>{
  const result=calculateSelfEmployed({...self,pensionNet:8000},rules);
  expect(result.grossPensionPence).toBe(1000000);expect(result.businessIncomeTaxPence).toBe(908600);expect(result.class4Pence).toBe(241660);
  expect(result.takeHomePence).toBe(3849740);
 });
 it('gives Scottish higher-rate relief without extending the starter band',()=>{
  const noPension=calculateSelfEmployed({...self,region:'scotland'},rules);
  const pension=calculateSelfEmployed({...self,region:'scotland',pensionNet:8000},rules);
  expect(noPension.incomeTax.totalPence-pension.incomeTax.totalPence).toBe(220000);
 });
 it('restores allowance when gross contributions lower adjusted income',()=>{
  const result=calculateSelfEmployed({...self,income:110000,expenses:0,pensionNet:8000},rules);expect(result.incomeTax.allowancePence).toBe(1257000);
 });
 it('limits unsupported pension amounts rather than silently claiming relief',()=>{expect(()=>calculateSelfEmployed({...self,pensionNet:48000},rules)).toThrow(/pension/);});
 it('models undergraduate and postgraduate repayments separately',()=>{
  const result=calculateSelfEmployed({...self,studentPlan:'plan2',postgraduateLoan:true},rules);
  expect(result.studentLoanPence).toBe(257500);expect(result.postgraduateLoanPence).toBe(222000);
 });
 it('blocks Plan 5 before repayments begin',()=>{expect(()=>calculateSelfEmployed({...self,studentPlan:'plan5'},selfEmployedRules['2025/26'])).toThrow(/start/);});
 it('excludes loans from the payment-on-account base',()=>{
  const base=calculateSelfEmployed(self,rules),loan=calculateSelfEmployed({...self,studentPlan:'plan2'},rules);
  expect(base.paymentOnAccountPence).toBe(652430);expect(loan.paymentOnAccountPence).toBe(base.paymentOnAccountPence);
  expect(loan.januaryCashDuePence-base.januaryCashDuePence).toBe(257500);
 });
 it('deducts prior payments only from the balance, not the next POA base',()=>{
  const base=calculateSelfEmployed(self,rules),paid=calculateSelfEmployed({...self,priorPaymentsOnAccount:10000},rules);
  expect(paid.paymentOnAccountPence).toBe(base.paymentOnAccountPence);expect(paid.selfAssessmentBalancePence).toBe(base.selfAssessmentBalancePence-1000000);
 });
 it('recognises the 80% tax-deducted test and potential credits',()=>{
  const result=calculateSelfEmployed({...self,taxDeducted:14000},rules);expect(result.paymentsOnAccountRequired).toBe(false);expect(result.selfAssessmentBalancePence).toBeLessThan(0);expect(result.januaryCashDuePence).toBe(0);
 });
 it('does not request payments on account below £1,000',()=>{expect(calculateSelfEmployed({...self,income:14000,expenses:0},rules).paymentsOnAccountRequired).toBe(false);});
 it('shows the correct due dates for each tax year',()=>{expect(calculateSelfEmployed(self,rules)).toMatchObject({januaryDate:'2028-01-31',julyDate:'2028-07-31'});});
});
describe('reproducible reports and safe downloads',()=>{
 const draft={toolSlug:'self-employed-tax-calculator' as const,taxYear:'2026/27' as const,inputs:self};
 it('recalculates from inputs and retains the rule version',()=>{expect(buildSnapshot(draft)).toMatchObject({taxYear:'2026/27',ruleSetVersion:'draft-3',toolSlug:'self-employed-tax-calculator'});});
 it('rejects an unsupported year instead of substituting current rules',()=>{expect(()=>buildSnapshot({...draft,taxYear:'2024/25'})).toThrow();});
 it('escapes HTML and formula-like CSV cells',()=>{
  const snapshot=buildSnapshot(draft);const html=htmlReport('<script>alert(1)</script>',snapshot,{note:'<img onerror=alert(1)>'});
  expect(html).not.toContain('<script>');expect(html).not.toContain('<img');expect(html).toContain('&lt;script&gt;');
  expect(csvCell('=HYPERLINK("evil")')).toMatch(/^"'=/);expect(csvCell('  =1+1')).toContain("'  =");expect(csvReport('Report',snapshot,self)).toContain('Rule version');
 });
});

describe('repayment offsets and exact payment-on-account test',()=>{
 const input={income:72000,expenses:14000,otherIncome:0,region:'england' as const};const rules=selfEmployedRules['2026/27'];
 it('offsets loan repayments already deducted without changing the annual estimate',()=>{
  const result=calculateSelfEmployed({...input,studentPlan:'plan2',studentLoanAlreadyPaid:1000},rules);expect(result.studentLoanPence).toBe(257500);expect(result.studentLoanDuePence).toBe(157500);
 });
 it('does not invent a loan refund when deductions exceed the estimate',()=>{expect(calculateSelfEmployed({...input,studentPlan:'plan2',studentLoanAlreadyPaid:5000},rules).studentLoanDuePence).toBe(0);});
 it('requires payments at exactly 80% deducted but not more than 80%',()=>{
  expect(calculateSelfEmployed({...input,taxDeducted:10438.88},rules).paymentsOnAccountRequired).toBe(true);
  expect(calculateSelfEmployed({...input,taxDeducted:10438.89},rules).paymentsOnAccountRequired).toBe(false);
 });
 it('offsets a credit against the January and July cash estimates',()=>{
  const result=calculateSelfEmployed({...input,priorPaymentsOnAccount:18000},rules);expect(result.selfAssessmentBalancePence).toBe(-495140);expect(result.januaryCashDuePence).toBe(157290);expect(result.julyCashDuePence).toBe(652430);
 });
});
