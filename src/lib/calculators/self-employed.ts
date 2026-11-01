import { z } from "zod";
import type { IncomeTaxBand, SelfEmployedRules, TaxRegion } from "../../rules/self-employed";
const amount = z.number().finite().min(0).max(10_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use no more than two decimal places.");
export const selfEmployedInput = z.object({
  income: amount,
  expenses: amount,
  otherIncome: amount,
  region: z.enum(["england", "wales", "northern-ireland", "scotland"]),
});
export type SelfEmployedInput = z.infer<typeof selfEmployedInput>;
export function calculateIncomeTax(incomePence: number, rules: SelfEmployedRules, region: TaxRegion = "england") {
  if (region === "scotland" && !rules.scottishBands) throw new Error(`Scottish rates for ${rules.taxYear} are awaiting verification. Choose a supported tax year.`);
  const allowancePence = Math.max(0, rules.personalAllowancePence - Math.floor(Math.max(0, incomePence - rules.allowanceTaperStartPence) / 2));
  const taxablePence = Math.max(0, incomePence - allowancePence);
  const thresholds: readonly IncomeTaxBand[] = region === "scotland" ? rules.scottishBands! : [
    {label:"Basic rate",upperTaxablePence:rules.basicBandPence,rate:rules.basicRate},
    {label:"Higher rate",upperTaxablePence:rules.additionalRateThresholdPence,rate:rules.higherRate},
    {label:"Additional rate",upperTaxablePence:null,rate:rules.additionalRate},
  ];
  let lowerPence = 0;
  const bands = thresholds.map(band => {
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
  const incomeTax = calculateIncomeTax(profitPence + otherIncomePence, rules, input.region);
  const otherIncomeTax = calculateIncomeTax(otherIncomePence, rules, input.region);
  // Incremental liability: the difference between tax with and without business profit.
  const businessIncomeTaxPence = incomeTax.totalPence - otherIncomeTax.totalPence;
  const mainClass4Pence = Math.round(Math.max(0, Math.min(profitPence, rules.class4UpperPence) - rules.class4LowerPence) * rules.class4MainRate);
  const upperClass4Pence = Math.round(Math.max(0, profitPence - rules.class4UpperPence) * rules.class4UpperRate);
  const class4Pence = mainClass4Pence + upperClass4Pence;
  const businessTaxPence = businessIncomeTaxPence + class4Pence;
  return {
    incomePence, expensesPence, profitPence,
    lossPence: Math.max(0, expensesPence - incomePence),
    incomeTax, otherIncomeTaxPence: otherIncomeTax.totalPence,
    businessIncomeTaxPence, class4Pence, mainClass4Pence, upperClass4Pence,
    businessTaxPence, takeHomePence: incomePence - expensesPence - businessTaxPence,
    monthlyTakeHomePence: Math.round((incomePence - expensesPence - businessTaxPence) / 12),
    monthlySetAsidePence: Math.ceil(businessTaxPence / 12),
    region: input.region, taxYear: rules.taxYear, ruleSetVersion: rules.version, sourceReview: rules.sourceReview,
  };
}
