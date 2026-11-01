export const tools = [
  { slug: "self-employed-tax-calculator", name: "Self-employed tax", category: "Tax", description: "Understand your profit, tax and take-home pay.", guide: "self-employed-tax", status: "Preview" },
  { slug: "vat-threshold-checker", name: "VAT threshold", category: "VAT", description: "Check your rolling turnover and registration position.", guide: "vat-registration", status: "In development" },
  { slug: "mtd-checker", name: "Making Tax Digital", category: "Planning", description: "Understand which MTD requirements may apply to you.", guide: "making-tax-digital", status: "In development" },
  { slug: "salary-dividend-calculator", name: "Salary vs dividends", category: "Tax", description: "Explore how you take money from your limited company.", guide: "salary-and-dividends", status: "In development" },
  { slug: "business-mileage-calculator", name: "Business mileage", category: "Expenses", description: "Estimate an allowance for qualifying business journeys.", guide: "business-mileage", status: "Preview" },
] as const;
export const categories = ["Tax", "VAT", "Expenses", "Planning", "Property"] as const;
