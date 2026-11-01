import { describe,it,expect } from 'vitest';
import { calculateEmployeeSalary } from '../../src/lib/calculators/employee-salary';
import { calculatePensionProjection } from '../../src/lib/calculators/pension-projection';
import { buildSnapshot } from '../../src/lib/reports/calculations';
const salary={taxYear:'2026/27' as const,region:'england' as const,salary:72000,employeePercent:5,employerPercent:3,pensionMethod:'net-pay' as const,pensionBasis:'full-salary' as const};
const pension={taxYear:'2026/27' as const,salary:72000,currentPot:10000,currentAge:35,retirementAge:45,employeePercent:5,employerPercent:3,pensionBasis:'full-salary' as const,salaryGrowthPercent:0,investmentGrowthPercent:0,annualFeePercent:0,inflationPercent:0,withdrawalPercent:4};
describe('monthly salary and pension methods',()=>{
 it('matches the supplied Scottish annual salary comparison without changing pension amounts',()=>{
  const result=calculateEmployeeSalary({...salary,salary:44160,region:'scotland',pensionMethod:'salary-sacrifice',employerPercent:10,studentPlan:'plan4',niBasis:'annual-estimate'});
  expect(result).toMatchObject({grossEmployeePensionPence:220800,cashSalaryPence:4195200,payslipIncomeTaxPence:596099,employeeNIPence:235056,studentLoanPence:73200,takeHomePence:3290845,monthlyTakeHomePence:274237});
 });
 it('keeps monthly payroll NI available separately from annual planning NI',()=>{
  const input={...salary,salary:44160,region:'scotland' as const,pensionMethod:'salary-sacrifice' as const,studentPlan:'plan4' as const};
  const monthly=calculateEmployeeSalary({...input,niBasis:'monthly-payroll'}),annual=calculateEmployeeSalary({...input,niBasis:'annual-estimate'});
  expect(monthly.employeeNIPence).toBe(235008);expect(annual.employeeNIPence-monthly.employeeNIPence).toBe(48);
  expect(monthly.payslipIncomeTaxPence).toBe(annual.payslipIncomeTaxPence);
 });
 it.each([[12570,0],[12571,8],[50270,301600],[50271,301602]])('applies annual NI thresholds at salary £%s', (annualSalary,expectedNI)=>{
  expect(calculateEmployeeSalary({...salary,salary:annualSalary,pensionMethod:'none',employeePercent:0,niBasis:'annual-estimate'}).employeeNIPence).toBe(expectedNI);
 });
 it.each(['england','wales','northern-ireland'] as const)('uses the selected home country and its applicable bands: %s',region=>{
  const input={...salary,salary:44160,region,pensionMethod:'salary-sacrifice' as const,niBasis:'annual-estimate' as const};
  const result=calculateEmployeeSalary(input);
  expect(result.region).toBe(region);expect(result.payslipIncomeTaxPence).toBe(587640);
  expect(calculateEmployeeSalary({...input,region:'scotland'}).payslipIncomeTaxPence).toBe(596099);
  const snapshot=buildSnapshot({toolSlug:'salary-take-home-calculator',taxYear:'2026/27',inputs:input});
  expect(snapshot.metrics.find(metric=>metric.key==='region')?.value).toBe({england:'England',wales:'Wales','northern-ireland':'Northern Ireland'}[region]);
 });
 it('calculates no employee deduction with standard monthly NI',()=>{const result=calculateEmployeeSalary({...salary,pensionMethod:'none',employeePercent:0});expect(result).toMatchObject({payslipIncomeTaxPence:1623200,employeeNIPence:345000,takeHomePence:5231800,payslipPensionPence:0});});
 it('deducts net-pay pension before Income Tax but not before NI',()=>{expect(calculateEmployeeSalary(salary)).toMatchObject({grossEmployeePensionPence:360000,payslipPensionPence:360000,payslipIncomeTaxPence:1479200,employeeNIPence:345000,takeHomePence:5015800,totalPensionPence:576000});});
 it('reduces tax, NI and cash salary under salary sacrifice',()=>{expect(calculateEmployeeSalary({...salary,pensionMethod:'salary-sacrifice'})).toMatchObject({cashSalaryPence:6840000,payslipPensionPence:0,sacrificePence:360000,payslipIncomeTaxPence:1479200,employeeNIPence:337800,takeHomePence:5023000,totalPensionPence:576000,employerNISavingPence:54000});});
 it('does not silently credit additional RAS relief to monthly payslip cash',()=>{expect(calculateEmployeeSalary({...salary,pensionMethod:'relief-at-source'})).toMatchObject({payslipPensionPence:288000,providerReliefPence:72000,payslipIncomeTaxPence:1623200,additionalReliefPence:72000,takeHomePence:4943800,takeHomeAfterClaimPence:5015800,totalPensionPence:576000});});
 it('distinguishes a cash percentage from a gross pension percentage',()=>{expect(calculateEmployeeSalary({...salary,pensionMethod:'relief-at-source',employeePercent:4,rasRateBasis:'net'})).toMatchObject({grossEmployeePensionPence:360000,payslipPensionPence:288000,totalPensionPence:576000});});
 it('uses qualifying earnings rather than accidentally applying percentages to all pay',()=>{const result=calculateEmployeeSalary({...salary,pensionBasis:'qualifying-earnings'});expect(result.basisPence).toBe(4403000);expect(result.grossEmployeePensionPence).toBe(220150);expect(result.employerBasePensionPence).toBe(132090);});
 it('does not create qualifying-earnings contributions below the lower limit',()=>{expect(calculateEmployeeSalary({...salary,salary:5000,pensionBasis:'qualifying-earnings'}).totalPensionPence).toBe(0);});
 it('uses Scottish rates independently of the loan plan selected',()=>{const result=calculateEmployeeSalary({...salary,region:'scotland'});expect(result).toMatchObject({payslipIncomeTaxPence:1671005,employeeNIPence:345000,takeHomePence:4823995});});
 it('leaves NI and student loan deductions unchanged for net-pay/RAS but lowers them for sacrifice',()=>{const base={...salary,salary:30000,studentPlan:'plan2' as const};const net=calculateEmployeeSalary(base),ras=calculateEmployeeSalary({...base,pensionMethod:'relief-at-source'}),sacrifice=calculateEmployeeSalary({...base,pensionMethod:'salary-sacrifice'});expect(net.studentLoanPence).toBe(4800);expect(ras.studentLoanPence).toBe(net.studentLoanPence);expect(ras.employeeNIPence).toBe(net.employeeNIPence);expect(sacrifice.studentLoanPence).toBe(0);expect(sacrifice.employeeNIPence).toBeLessThan(net.employeeNIPence);});
 it('supports postgraduate deductions in addition to one undergraduate plan',()=>{const result=calculateEmployeeSalary({...salary,pensionMethod:'none',employeePercent:0,studentPlan:'plan2',postgraduateLoan:true});expect(result.studentLoanPence).toBe(382800);expect(result.postgraduateLoanPence).toBe(306000);});
 it('uses each year’s loan threshold rather than silently using the latest',()=>{const current=calculateEmployeeSalary({...salary,studentPlan:'plan2'}),previous=calculateEmployeeSalary({...salary,taxYear:'2025/26',studentPlan:'plan2'});expect(previous.studentLoanPence).toBeGreaterThan(current.studentLoanPence);});
 it('does not support Plan 5 repayments before 2026/27',()=>{expect(()=>calculateEmployeeSalary({...salary,taxYear:'2025/26',studentPlan:'plan5'})).toThrow('2026/27');});
 it('does not double-count salary sacrifice or employer contributions',()=>{for(const pensionMethod of ['salary-sacrifice','net-pay','relief-at-source'] as const){const r=calculateEmployeeSalary({...salary,pensionMethod});expect(r.cashSalaryPence-r.payslipIncomeTaxPence-r.employeeNIPence-r.studentLoanPence-r.postgraduateLoanPence-r.payslipPensionPence).toBe(r.takeHomePence);expect(r.totalPensionPence).toBe(r.grossEmployeePensionPence+r.employerBasePensionPence);}});
 it('does not let an employer rate reduce employee take-home',()=>{expect(calculateEmployeeSalary({...salary,employerPercent:20}).takeHomePence).toBe(calculateEmployeeSalary(salary).takeHomePence);});
 it('rejects impossible or unsupported pension inputs',()=>{expect(()=>calculateEmployeeSalary({...salary,employeePercent:101})).toThrow();expect(()=>calculateEmployeeSalary({...salary,pensionMethod:'none'})).toThrow(/0%/);expect(()=>calculateEmployeeSalary({...salary,pensionMethod:'salary-sacrifice',employeePercent:100})).toThrow(/cash pay/);expect(()=>calculateEmployeeSalary({...salary,pensionMethod:'relief-at-source',rasRateBasis:'net',employeePercent:90})).toThrow(/exceed/);});
 it('handles zero salary without NaN or deductions',()=>{const result=calculateEmployeeSalary({...salary,salary:0});expect(result.takeHomePence).toBe(0);expect(result.totalPensionPence).toBe(0);});
});
describe('pension pot illustration with unchanged salary',()=>{
 it('shows an exact no-growth contribution baseline',()=>{const result=calculatePensionProjection(pension);expect(result).toMatchObject({projectedPotPence:6760000,noGrowthBaselinePence:6760000,employeeContributionsPence:3600000,employerContributionsPence:2160000,monthlyInitialEmployeePence:30000,monthlyInitialEmployerPence:18000,investmentChangePence:0,years:10});});
 it('matches the month-end compound contribution formula',()=>{const result=calculatePensionProjection({...pension,investmentGrowthPercent:5});const r=Math.pow(1.05,1/12)-1;const expected=1000000*Math.pow(1+r,120)+48000*(Math.pow(1+r,120)-1)/r;expect(result.projectedPotPence).toBe(Math.round(expected));});
 it('applies fees and inflation without hiding their effect',()=>{const gross=calculatePensionProjection({...pension,investmentGrowthPercent:5});const net=calculatePensionProjection({...pension,investmentGrowthPercent:5,annualFeePercent:1,inflationPercent:2.5});expect(net.projectedPotPence).toBeLessThan(gross.projectedPotPence);expect(net.todayPotPence).toBe(Math.round(net.projectedPotPence/Math.pow(1.025,10)));});
 it('keeps salary constant by default and only grows it if explicitly selected',()=>{const flat=calculatePensionProjection({...pension,salaryGrowthPercent:undefined});expect(flat.employeeContributionsPence).toBe(3600000);expect(calculatePensionProjection({...pension,salaryGrowthPercent:2}).employeeContributionsPence).toBeGreaterThan(flat.employeeContributionsPence);});
 it('keeps the current pot separate from future contributions',()=>{const result=calculatePensionProjection({...pension,employeePercent:0,employerPercent:0});expect(result.projectedPotPence).toBe(1000000);expect(result.employeeContributionsPence+result.employerContributionsPence).toBe(0);});
 it('can illustrate losses rather than assuming positive returns',()=>{const result=calculatePensionProjection({...pension,investmentGrowthPercent:-10});expect(result.investmentChangePence).toBeLessThan(0);expect(result.projectedPotPence).toBeLessThan(result.noGrowthBaselinePence);});
 it('labels withdrawals as an illustration, separate from pot size',()=>{const result=calculatePensionProjection(pension);expect(result.yearlyWithdrawalPence).toBe(270400);expect(result.monthlyWithdrawalPence).toBe(22533);});
 it('emits yearly points including the current and target ages',()=>{const points=calculatePensionProjection(pension).points;expect(points).toHaveLength(11);expect(points[0]).toMatchObject({age:35,potPence:1000000,contributionsPence:0});expect(points.at(-1)).toMatchObject({age:45,potPence:6760000,contributionsPence:5760000});});
 it('uses qualifying earnings for both employer and employee',()=>{expect(calculatePensionProjection({...pension,pensionBasis:'qualifying-earnings'}).monthlyInitialEmployeePence).toBe(18346);});
 it.each([{retirementAge:35},{retirementAge:30},{currentAge:35.5},{investmentGrowthPercent:Infinity},{salaryGrowthPercent:-1},{annualFeePercent:-1},{employeePercent:101}])('rejects invalid scenario %s',change=>{expect(()=>calculatePensionProjection({...pension,...change})).toThrow();});
});
describe('new tools in Advanced snapshots',()=>{
 it('recalculates salary inputs and preserves a distinct calculator version',()=>{expect(buildSnapshot({toolSlug:'salary-take-home-calculator',taxYear:'2026/27',inputs:salary})).toMatchObject({ruleSetVersion:'salary-draft-2',metrics:expect.arrayContaining([expect.objectContaining({key:'annualTakeHome',value:5015800})])});});
 it('can save/compare/export pension scenarios through the common record format',()=>{expect(buildSnapshot({toolSlug:'pension-pot-predictor',taxYear:'2026/27',inputs:pension})).toMatchObject({ruleSetVersion:'pension-draft-1',metrics:expect.arrayContaining([expect.objectContaining({key:'pot',value:6760000})])});});
 it('refuses an unsupported tax year',()=>{expect(()=>buildSnapshot({toolSlug:'salary-take-home-calculator',taxYear:'2024/25',inputs:salary})).toThrow(/2025/);});
});
