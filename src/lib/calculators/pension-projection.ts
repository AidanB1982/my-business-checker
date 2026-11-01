import { z } from 'zod';
import { pounds,pence,taxYearSchema } from './validation';
import { pensionableEarnings } from '../../rules/employment';
export const pensionProjectionInput=z.object({
 taxYear:taxYearSchema,salary:pounds,currentPot:pounds,
 currentAge:z.number().int().min(18).max(99),retirementAge:z.number().int().min(19).max(100),
 employeePercent:z.number().finite().min(0).max(100),employerPercent:z.number().finite().min(0).max(100),
 pensionBasis:z.enum(['full-salary','qualifying-earnings']),
 salaryGrowthPercent:z.number().finite().min(0).max(10).optional().default(0),
 investmentGrowthPercent:z.number().finite().min(-20).max(15).optional().default(5),
 annualFeePercent:z.number().finite().min(0).max(5).optional().default(0.5),
 inflationPercent:z.number().finite().min(0).max(10).optional().default(2.5),
 withdrawalPercent:z.number().finite().min(0).max(10).optional().default(4),
}).strict().refine(input=>input.retirementAge>input.currentAge,{message:'Target retirement age must be later than your current age.',path:['retirementAge']});
export type PensionProjectionInput=z.input<typeof pensionProjectionInput>;
export function calculatePensionProjection(raw:PensionProjectionInput){
 const input=pensionProjectionInput.parse(raw);const years=input.retirementAge-input.currentAge,months=years*12;
 const initialPotPence=pence(input.currentPot),initialSalaryPence=pence(input.salary);
 const netAnnualFactor=(1+input.investmentGrowthPercent/100)*(1-input.annualFeePercent/100);
 const monthlyFactor=Math.pow(netAnnualFactor,1/12);
 let balance=initialPotPence,employeeContributions=0,employerContributions=0;
 const points=[{age:input.currentAge,potPence:initialPotPence,todayPence:initialPotPence,contributionsPence:0}];
 for(let month=0;month<months;month++){
  const salary=initialSalaryPence*Math.pow(1+input.salaryGrowthPercent/100,Math.floor(month/12));
  const base=pensionableEarnings(salary,input.pensionBasis,input.taxYear);
  const employee=Math.round(base*input.employeePercent/100/12),employer=Math.round(base*input.employerPercent/100/12);
  balance=balance*monthlyFactor+employee+employer;employeeContributions+=employee;employerContributions+=employer;
  if(!Number.isFinite(balance)||balance>Number.MAX_SAFE_INTEGER)throw new Error('This scenario exceeds the supported projection range. Reduce the inputs.');
  if((month+1)%12===0){const elapsed=(month+1)/12;points.push({age:input.currentAge+elapsed,potPence:Math.round(balance),todayPence:Math.round(balance/Math.pow(1+input.inflationPercent/100,elapsed)),contributionsPence:employeeContributions+employerContributions});}
 }
 const projectedPotPence=Math.round(balance),todayPotPence=points.at(-1)!.todayPence;
 const yearlyWithdrawalPence=Math.round(projectedPotPence*input.withdrawalPercent/100),todayYearlyWithdrawalPence=Math.round(todayPotPence*input.withdrawalPercent/100);
 return {initialPotPence,projectedPotPence,todayPotPence,employeeContributionsPence:employeeContributions,employerContributionsPence:employerContributions,
 noGrowthBaselinePence:initialPotPence+employeeContributions+employerContributions,investmentChangePence:projectedPotPence-initialPotPence-employeeContributions-employerContributions,
 monthlyInitialEmployeePence:Math.round(pensionableEarnings(initialSalaryPence,input.pensionBasis,input.taxYear)*input.employeePercent/100/12),monthlyInitialEmployerPence:Math.round(pensionableEarnings(initialSalaryPence,input.pensionBasis,input.taxYear)*input.employerPercent/100/12),
 yearlyWithdrawalPence,monthlyWithdrawalPence:Math.round(yearlyWithdrawalPence/12),todayMonthlyWithdrawalPence:Math.round(todayYearlyWithdrawalPence/12),
 years,months,points,ruleSetVersion:'pension-draft-1',inputs:input};
}
