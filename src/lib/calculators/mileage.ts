export type MileageRules = Readonly<{version: string; taxYear: string; firstBandMiles: number; firstBandPence: number; additionalPence: number}>;
// Draft reference snapshot. Publication requires source review; never silently replace an existing version.
export const mileageRules: MileageRules = Object.freeze({version: "draft-1", taxYear: "2025/26", firstBandMiles: 10000, firstBandPence: 45, additionalPence: 25});
export function calculateMileage(miles: number, rules: MileageRules) {
  if (!Number.isFinite(miles) || miles < 0 || miles > 1000000) throw new Error("Enter business miles between 0 and 1,000,000.");
  const firstBandMiles = Math.min(miles, rules.firstBandMiles);
  const additionalMiles = Math.max(0, miles-rules.firstBandMiles);
  return {firstBandMiles, additionalMiles, allowancePence: Math.round(firstBandMiles*rules.firstBandPence + additionalMiles*rules.additionalPence), taxYear: rules.taxYear, ruleSetVersion: rules.version};
}
