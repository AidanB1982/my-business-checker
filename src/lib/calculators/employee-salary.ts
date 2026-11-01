import { z } from 'zod';
import { pounds,pence,taxYearSchema } from './validation';
import { selfEmployedRules } from '../../rules/self-employed';
import { employmentRules,pensionableEarnings } from '../../rules/employment';
import { studentLoanRules } from '../../rules/business';
import { calculateIncomeTax } from './self-employed';
export const employeeSalaryInput=z.object({
 taxYear:taxYearSchema,region:z.enum(['england','wales','northern-ireland','scotland']),salary:pounds,
 employeePercent:z.number().finite().min(0).max(100),employerPercent:z.number().finite().min(0).max(100),
 pensionMethod:z.enum(['none','salary-sacrifice','net-pay','relief-at-source']),
 pensionBasis:z.enum(['full-salary','qualifying-earnings']),
 rasRateBasis:z.enum(['gross','net']).optional().default('gross'),
 niBasis:z.enum(['monthly-payroll','annual-estimate']).optional().default('monthly-payroll'),
 studentPlan:z.enum(['none','plan1','plan2','plan4','plan5']).optional().default('none'),
 postgraduateLoan:z.boolean().optional().default(false),
}).strict();
export type EmployeeSalaryInput=z.input<typeof employeeSalaryInput>;
export function calculateEmployeeSalary(raw:EmployeeSalaryInput){
 const input=employeeSalaryInput.parse(raw);const rules=employmentRules[input.taxYear],taxRules=selfEmployedRules[input.taxYear];
 const salaryPence=pence(input.salary),basisPence=pensionableEarnings(salaryPence,input.pensionBasis,input.taxYear);
 if(input.pensionMethod==='none'&&input.employeePercent!==0)throw new Error('Set your employee contribution to 0% when no employee pension deduction is selected.');
 const percentageAmount=Math.round(basisPence*input.employeePercent/100);
 const grossEmployeePensionPence=input.pensionMethod==='relief-at-source'&&input.rasRateBasis==='net'?Math.round(percentageAmount/(1-rules.reliefAtSourceRate)):percentageAmount;
 if(grossEmployeePensionPence>salaryPence)throw new Error('The gross pension contribution cannot exceed the salary used by this preview.');
 const employerBasePensionPence=Math.round(basisPence*input.employerPercent/100);
 const sacrificePence=input.pensionMethod==='salary-sacrifice'?grossEmployeePensionPence:0;
 const cashSalaryPence=salaryPence-sacrificePence;
 if(salaryPence>0&&cashSalaryPence<=0)throw new Error('Salary sacrifice must leave cash pay. Minimum-wage eligibility is not checked by this preview.');
 const payslipPensionPence=input.pensionMethod==='net-pay'?grossEmployeePensionPence:input.pensionMethod==='relief-at-source'?Math.round(grossEmployeePensionPence*(1-rules.reliefAtSourceRate)):0;
 const taxableSalaryPence=cashSalaryPence-(input.pensionMethod==='net-pay'?grossEmployeePensionPence:0);
 const payslipIncomeTax=calculateIncomeTax(taxableSalaryPence,taxRules,input.region);
 const taxAfterClaim=input.pensionMethod==='relief-at-source'?calculateIncomeTax(cashSalaryPence,taxRules,input.region,{grossPensionPence:grossEmployeePensionPence}):payslipIncomeTax;
 const additionalReliefPence=Math.max(0,payslipIncomeTax.totalPence-taxAfterClaim.totalPence);
 const monthlyCashPence=Math.round(cashSalaryPence/12);
 const monthlyNIPence=Math.round(Math.max(0,Math.min(monthlyCashPence,rules.monthlyNIUpperPence)-rules.monthlyNIPrimaryPence)*rules.employeeNIMainRate)+Math.round(Math.max(0,monthlyCashPence-rules.monthlyNIUpperPence)*rules.employeeNIUpperRate);
 const loanRules=studentLoanRules[input.taxYear];
 if(input.studentPlan==='plan5'&&loanRules.plan5===null)throw new Error('Plan 5 repayments start in 2026/27. Choose a different tax year or loan plan.');
 // Student loan deductions use NI earnings. Net-pay and relief-at-source
 // pension deductions do not reduce this pay; salary sacrifice does.
 const monthlyStudentLoanPence=input.studentPlan==='none'?0:Math.floor(Math.max(0,monthlyCashPence-Math.floor((loanRules[input.studentPlan]??0)*100/12))*9/10000)*100;
 const monthlyPostgraduatePence=input.postgraduateLoan?Math.floor(Math.max(0,monthlyCashPence-Math.floor(loanRules.postgraduate*100/12))*6/10000)*100:0;
 // Annual planning basis is optional; existing saved inputs retain monthly payroll NI.
 const annualNIPence=Math.round(Math.max(0,Math.min(cashSalaryPence,rules.annualNIUpperPence)-rules.annualNIPrimaryPence)*rules.employeeNIMainRate)+Math.round(Math.max(0,cashSalaryPence-rules.annualNIUpperPence)*rules.employeeNIUpperRate);
 const employeeNIPence=input.niBasis==='annual-estimate'?annualNIPence:monthlyNIPence*12,studentLoanPence=monthlyStudentLoanPence*12,postgraduateLoanPence=monthlyPostgraduatePence*12;
 const takeHomePence=cashSalaryPence-payslipIncomeTax.totalPence-employeeNIPence-payslipPensionPence-studentLoanPence-postgraduateLoanPence;
 if(takeHomePence<0)throw new Error('These pension and payroll deductions exceed the pay available. Reduce the percentage or check the payroll arrangement.');
 const employerNI=(monthlyPay:number)=>Math.round(Math.max(0,monthlyPay-rules.monthlyEmployerNIThresholdPence)*rules.employerNIRate)*12;
 return {salaryPence,basisPence,cashSalaryPence,taxableSalaryPence,sacrificePence,payslipPensionPence,grossEmployeePensionPence,
 employerBasePensionPence,totalPensionPence:grossEmployeePensionPence+employerBasePensionPence,
 providerReliefPence:input.pensionMethod==='relief-at-source'?grossEmployeePensionPence-payslipPensionPence:0,
 payslipIncomeTaxPence:payslipIncomeTax.totalPence,incomeTaxAfterClaimPence:taxAfterClaim.totalPence,additionalReliefPence,
 employeeNIPence,studentLoanPence,postgraduateLoanPence,takeHomePence,monthlyTakeHomePence:Math.round(takeHomePence/12),
 takeHomeAfterClaimPence:takeHomePence+additionalReliefPence,monthlyTakeHomeAfterClaimPence:Math.round((takeHomePence+additionalReliefPence)/12),
 employerNISavingPence:Math.max(0,employerNI(Math.round(salaryPence/12))-employerNI(monthlyCashPence)),
 taxYear:input.taxYear,region:input.region,pensionMethod:input.pensionMethod,ruleSetVersion:rules.version,inputs:input};
}
