import Link from "next/link";
import { notFound } from "next/navigation";
import { guides } from "@/content/guides";
export function generateStaticParams() { return guides.map(g => ({ slug: g.slug })); }
export async function generateMetadata({ params }: { params: Promise<{slug: string}> }) { const {slug}=await params; const guide=guides.find(g=>g.slug===slug); return {title: guide?.title || "Guide not found"}; }
export default async function Guide({ params }: { params: Promise<{slug: string}> }) {
 const {slug}=await params; const g=guides.find(g=>g.slug===slug); if(!g) notFound();
 return <article className="wrap narrow section"><Link href="/guides" className="text-link">← All guides</Link><p className="eyebrow">Business guide · Draft for review</p><h1>{g.title}</h1><p className="lead">{g.summary}</p>{g.paragraphs.map(p=><p key={p}>{p}</p>)}<div className="notice"><strong>{g.source.startsWith('https://www.gov.uk/')?'Check the official guidance':'Explore the source guidance'}</strong><p>{g.source.startsWith('https://www.gov.uk/')?'This introductory guide is not a complete statement of the rules. Confirm current requirements with HMRC.':'Read the source alongside the assumptions shown in this app. Planning yields are distinct from taxable profit and a mortgage offer.'}</p><a href={g.source} rel="noopener noreferrer">{g.source.startsWith('https://www.gov.uk/')?'Read the GOV.UK source →':'Read the source guide →'}</a></div><Link className="button" href={`/tools/${g.tool}`}>View the related tool →</Link></article>;
}
