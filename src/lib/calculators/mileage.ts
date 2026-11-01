export type MileageTaxYear = "2025/26" | "2026/27";
export type MileageRules = Readonly<{
  version: string; taxYear: MileageTaxYear; effectiveFrom: string;
  firstBandMiles: number; firstBandPence: number; additionalPence: number;
  sourceUrl: string; sourceReview: "provided-hmrc-extract";
}>;
// Historical rates are preserved. Both sets match the HMRC extract supplied
// on 1 November 2026 (guidance updated 21 May 2026); live retrieval is not claimed.
export const mileageRuleSets: Readonly<Record<MileageTaxYear, MileageRules>> = Object.freeze({
  "2025/26": Object.freeze({version:"draft-1",taxYear:"2025/26",effectiveFrom:"2025-04-06",firstBandMiles:10000,firstBandPence:45,additionalPence:25,sourceUrl:"https://www.gov.uk/government/publications/rates-and-allowances-travel-mileage-and-fuel-allowances/travel-mileage-and-fuel-rates-and-allowances",sourceReview:"provided-hmrc-extract"}),
  "2026/27": Object.freeze({version:"draft-1",taxYear:"2026/27",effectiveFrom:"2026-04-06",firstBandMiles:10000,firstBandPence:55,additionalPence:25,sourceUrl:"https://www.gov.uk/government/publications/rates-and-allowances-travel-mileage-and-fuel-allowances/travel-mileage-and-fuel-rates-and-allowances",sourceReview:"provided-hmrc-extract"}),
});
export function calculateMileage(miles: number, rules: MileageRules) {
  if (!Number.isFinite(miles) || miles < 0 || miles > 1000000) throw new Error("Enter business miles between 0 and 1,000,000.");
  const firstBandMiles = Math.min(miles, rules.firstBandMiles);
  const additionalMiles = Math.max(0, miles-rules.firstBandMiles);
  return {firstBandMiles, additionalMiles, allowancePence: Math.round(firstBandMiles*rules.firstBandPence + additionalMiles*rules.additionalPence), taxYear: rules.taxYear, ruleSetVersion: rules.version};
}
