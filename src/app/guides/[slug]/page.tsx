import Link from "next/link";
import { notFound } from "next/navigation";
import { guides } from "@/content/guides";
export function generateStaticParams() { return guides.map(g => ({ slug: g.slug })); }
export async function generateMetadata({ params }: { params: Promise<{slug: string}> }) { const {slug}=await params; const guide=guides.find(g=>g.slug===slug); return {title: guide?.title || "Guide not found"}; }
export default async function Guide({ params }: { params: Promise<{slug: string}> }) {
 const {slug}=await params; const g=guides.find(g=>g.slug===slug); if(!g) notFound();
 return <article className="wrap narrow section"><Link href="/guides" className="text-link">← All guides</Link><p className="eyebrow">Business guide · Draft for review</p><h1>{g.title}</h1><p className="lead">{g.summary}</p>{g.paragraphs.map(p=><p key={p}>{p}</p>)}<div className="notice"><strong>Check the official guidance</strong><p>This introductory guide is not a complete statement of the rules. Confirm current requirements with HMRC.</p><a href={g.source} rel="noopener noreferrer">Read the GOV.UK source →</a></div><Link className="button" href={`/tools/${g.tool}`}>View the related tool →</Link></article>;
}
