import type { TaxYear } from './self-employed';
// Draft reference rules. Links identify the official material that needs review;
// no independent source check is claimed for these new snapshots.
export const businessRules = Object.freeze({
 version:'draft-1', vatThresholdPence:9_000_000,
 corporationSmallLimitPence:5_000_000,corporationUpperLimitPence:25_000_000,
 corporationSmallRate:0.19,corporationMainRate:0.25,marginalFraction:0.015,
 employerNIThresholdPence:500_000,employerNIRate:0.15,employmentAllowancePence:1_050_000,
 employeeNILowerPence:1_257_000,employeeNIUpperPence:5_027_000,employeeNIRate:0.08,employeeNIUpperRate:0.02,
 dividendAllowancePence:50_000,dividendAdditionalRate:0.3935,
 sourceReview:'pending' as const,
});
export const dividendRates:Readonly<Record<TaxYear,{basic:number;higher:number}>>={
 '2025/26':{basic:0.0875,higher:0.3375},'2026/27':{basic:0.1075,higher:0.3575},
};
export const studentLoanRules:Readonly<Record<TaxYear,{plan1:number;plan2:number;plan4:number;plan5:number|null;postgraduate:number}>>={
 '2025/26':{plan1:26065,plan2:28470,plan4:32745,plan5:null,postgraduate:21000},
 '2026/27':{plan1:26900,plan2:29385,plan4:33795,plan5:25000,postgraduate:21000},
};
export const mtdSchedule = Object.freeze({
 '2024/25':{thresholdPence:5_000_000,startDate:'2026-04-06'},
 '2025/26':{thresholdPence:3_000_000,startDate:'2027-04-06'},
 '2026/27':{thresholdPence:2_000_000,startDate:'2028-04-06'},
});
export const businessSources = {
 vat:[{label:'When to register for VAT',url:'https://www.gov.uk/vat-registration/when-to-register'}],
 mtd:[{label:'Check eligibility for MTD for Income Tax',url:'https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax'}],
 salary:[{label:'Corporation Tax rates',url:'https://www.gov.uk/government/publications/rates-and-allowances-corporation-tax/rates-and-allowances-corporation-tax'},{label:'Dividend tax rates',url:'https://www.gov.uk/tax-on-dividends'},{label:'Employer National Insurance and Employment Allowance',url:'https://www.gov.uk/claim-employment-allowance/eligibility'}],
 loans:[{label:'Student loan repayment thresholds',url:'https://www.gov.uk/repaying-your-student-loan/what-you-pay'},{label:'Tax relief on pension contributions',url:'https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief'},{label:'Payments on account',url:'https://www.gov.uk/understand-self-assessment-bill/payments-on-account'}],
} as const;
