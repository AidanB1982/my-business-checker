import { z } from "zod";
import { studentLoanRules } from "../../rules/business";
import type { IncomeTaxBand, SelfEmployedRules, TaxRegion } from "../../rules/self-employed";
const amount = z.number().finite().min(0).max(10_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use no more than two decimal places.");
export const selfEmployedInput = z.object({
  income: amount,
  expenses: amount,
  otherIncome: amount,
  pensionNet: amount.optional().default(0),
  studentPlan: z.enum(["none","plan1","plan2","plan4","plan5"]).optional().default("none"),
  postgraduateLoan: z.boolean().optional().default(false),
  studentLoanAlreadyPaid: amount.optional().default(0),
  postgraduateLoanAlreadyPaid: amount.optional().default(0),
  taxDeducted: amount.optional().default(0),
  priorPaymentsOnAccount: amount.optional().default(0),
  region: z.enum(["england", "wales", "northern-ireland", "scotland"]),
});
export type SelfEmployedInput = z.input<typeof selfEmployedInput>;
export function calculateIncomeTax(incomePence: number, rules: SelfEmployedRules, region: TaxRegion = "england", options: {grossPensionPence?:number;adjustedNetIncomePence?:number} = {}) {
  if (region === "scotland" && !rules.scottishBands) throw new Error(`Scottish rates for ${rules.taxYear} are awaiting verification. Choose a supported tax year.`);
  const pension = options.grossPensionPence ?? 0;
  const adjustedIncome = options.adjustedNetIncomePence ?? Math.max(0,incomePence-pension);
  const allowancePence = Math.max(0, rules.personalAllowancePence - Math.floor(Math.max(0, adjustedIncome - rules.allowanceTaperStartPence) / 2));
  const taxablePence = Math.max(0, incomePence - allowancePence);
  const thresholds: readonly IncomeTaxBand[] = region === "scotland" ? rules.scottishBands! : [
    {label:"Basic rate",upperTaxablePence:rules.basicBandPence,rate:rules.basicRate},
    {label:"Higher rate",upperTaxablePence:rules.additionalRateThresholdPence,rate:rules.higherRate},
    {label:"Additional rate",upperTaxablePence:null,rate:rules.additionalRate},
  ];
  // Relief-at-source gross contributions extend the basic and higher limits.
  // Scotland retains its starter band; extension starts with its basic band.
  const extended = thresholds.map((band,index)=>({...band,upperTaxablePence:band.upperTaxablePence===null?null:band.upperTaxablePence+(region==="scotland" && index===0?0:pension)}));
  let lowerPence = 0;
  const bands = extended.map(band => {
    const bandTaxablePence = Math.max(0, Math.min(taxablePence, band.upperTaxablePence ?? taxablePence) - lowerPence);
    lowerPence = band.upperTaxablePence ?? taxablePence;
    return {label:band.label, taxablePence:bandTaxablePence, rate:band.rate, taxPence:Math.round(bandTaxablePence * band.rate)};
  });
  return { allowancePence, taxablePence, bands, totalPence: bands.reduce((sum, band) => sum + band.taxPence, 0) };
}
export function calculateSelfEmployed(raw: SelfEmployedInput, rules: SelfEmployedRules) {
  const input = selfEmployedInput.parse(raw);
  const incomePence = Math.round(input.income * 100);
  const expensesPence = Math.round(input.expenses * 100);
  const otherIncomePence = Math.round(input.otherIncome * 100);
  const profitPence = Math.max(0, incomePence - expensesPence);
  const pensionNetPence=Math.round(input.pensionNet*100),grossPensionPence=Math.round(pensionNetPence/0.8);
  if(grossPensionPence>Math.max(360000,profitPence)||grossPensionPence>6000000)throw new Error("This preview supports gross pension contributions up to the greater of £3,600 or business profit, capped at £60,000. Annual allowance tapering and MPAA are not modelled.");
  const loanRules=studentLoanRules[rules.taxYear];
  if(input.studentPlan==="plan5" && loanRules.plan5===null)throw new Error("Plan 5 repayments start in 2026/27. Choose the correct tax year or repayment plan.");
  const loanIncome=profitPence+otherIncomePence;
  const studentLoanPence=input.studentPlan==="none"?0:Math.floor(Math.max(0,loanIncome-(loanRules[input.studentPlan]??0)*100)*0.09/100)*100;
  const postgraduateLoanPence=input.postgraduateLoan?Math.floor(Math.max(0,loanIncome-loanRules.postgraduate*100)*0.06/100)*100:0;
  const incomeTax = calculateIncomeTax(profitPence + otherIncomePence, rules, input.region,{grossPensionPence});
  const otherIncomeTax = calculateIncomeTax(otherIncomePence, rules, input.region,{grossPensionPence});
  // Incremental liability: the difference between tax with and without business profit.
  const businessIncomeTaxPence = incomeTax.totalPence - otherIncomeTax.totalPence;
  const mainClass4Pence = Math.round(Math.max(0, Math.min(profitPence, rules.class4UpperPence) - rules.class4LowerPence) * rules.class4MainRate);
  const upperClass4Pence = Math.round(Math.max(0, profitPence - rules.class4UpperPence) * rules.class4UpperRate);
  const class4Pence = mainClass4Pence + upperClass4Pence;
  const businessTaxPence = businessIncomeTaxPence + class4Pence;
  const studentLoanDuePence=Math.max(0,studentLoanPence-Math.round(input.studentLoanAlreadyPaid*100));
  const postgraduateLoanDuePence=Math.max(0,postgraduateLoanPence-Math.round(input.postgraduateLoanAlreadyPaid*100));
  const totalLoansPence=studentLoanDuePence+postgraduateLoanDuePence;
  const relevantLiabilityPence=incomeTax.totalPence+class4Pence;
  const taxDeductedPence=Math.round(input.taxDeducted*100),priorPaymentsPence=Math.round(input.priorPaymentsOnAccount*100);
  const paymentsBasePence=Math.max(0,relevantLiabilityPence-taxDeductedPence);
  const paymentsOnAccountRequired=paymentsBasePence>=100000 && taxDeductedPence*5<=relevantLiabilityPence*4;
  const paymentOnAccountPence=paymentsOnAccountRequired?Math.round(paymentsBasePence/2):0;
  const selfAssessmentBalancePence=relevantLiabilityPence+totalLoansPence-taxDeductedPence-priorPaymentsPence;
  const endYear=Number(rules.taxYear.slice(0,4))+1;
  const cashTakeHome=incomePence-expensesPence-pensionNetPence-businessTaxPence-totalLoansPence;
  return {
    incomePence, expensesPence, profitPence,
    lossPence: Math.max(0, expensesPence - incomePence),
    incomeTax, otherIncomeTaxPence: otherIncomeTax.totalPence,
    businessIncomeTaxPence, class4Pence, mainClass4Pence, upperClass4Pence,
    businessTaxPence, takeHomePence: cashTakeHome,
    monthlyTakeHomePence: Math.round(cashTakeHome / 12),
    monthlySetAsidePence: Math.ceil((businessTaxPence+totalLoansPence) / 12),
    pensionNetPence,grossPensionPence,studentLoanPence,postgraduateLoanPence,studentLoanDuePence,postgraduateLoanDuePence,totalLoansPence,
    selfAssessmentBalancePence,paymentsOnAccountRequired,paymentOnAccountPence,
    januaryCashDuePence:Math.max(0,selfAssessmentBalancePence+paymentOnAccountPence),
    julyCashDuePence:Math.max(0,paymentOnAccountPence-Math.max(0,-(selfAssessmentBalancePence+paymentOnAccountPence))),
    januaryDate:`${endYear+1}-01-31`,julyDate:`${endYear+1}-07-31`,
    inputs:input,region: input.region, taxYear: rules.taxYear, ruleSetVersion: rules.version, sourceReview: rules.sourceReview,
  };
}
