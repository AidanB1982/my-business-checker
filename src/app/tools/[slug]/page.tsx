import Link from "next/link";
import { notFound } from "next/navigation";
import { tools } from "@/content/tools";
import { SelfEmployedCalculator } from "@/components/self-employed-calculator";
import { MileageCalculator } from "@/components/mileage-calculator";
export function generateStaticParams() { return tools.map(t=>({slug:t.slug})); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {const {slug}=await params;return {title:tools.find(t=>t.slug===slug)?.name||"Tool not found"};}
export default async function Tool({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params; const t=tools.find(t=>t.slug===slug);if(!t) notFound();
 return <div className="wrap section"><Link className="text-link" href="/tools">← All tools</Link><p className="eyebrow">{t.category} · {t.status}</p><h1>{t.name}.</h1><p className="lead">{t.description}</p>{slug==="self-employed-tax-calculator"?<SelfEmployedCalculator/>:slug==="business-mileage-calculator"?<><div className="notice">Development preview for 2025/26 only. This draft rule set needs official source review before release. Vehicle eligibility and the choice of expenses method affect whether you can use it.</div><MileageCalculator/></>:<div className="notice"><h2>A reliable answer takes careful checking.</h2><p>This calculator is in development. We are preparing versioned rules and calculation tests before enabling estimates.</p><p>No financial information is collected on this page.</p></div>}<div className="section-heading section"><Link className="text-link" href={`/guides/${t.guide}`}>Understand how this works →</Link><Link className="text-link" href="/methodology">Methodology and sources →</Link></div><h2>What should I check next?</h2><div className="guide-grid">{tools.filter(other=>other.slug!==slug).slice(0,2).map(other=><Link className="guide-card" key={other.slug} href={`/tools/${other.slug}`}><h3>{other.name} →</h3><p>{other.description}</p></Link>)}</div></div>;
}
