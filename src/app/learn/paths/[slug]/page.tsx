import Link from 'next/link';
import { notFound } from 'next/navigation';
import { learningPaths } from '@/content/learning-paths';
import { learningLessons } from '@/content/learning';
import { pageMetadata } from '@/lib/seo';
import { StructuredData } from '@/components/structured-data';
import { SITE_URL } from '@/lib/config';
export function generateStaticParams(){return learningPaths.map(p=>({slug:p.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const p=learningPaths.find(p=>p.slug===slug);return p?pageMetadata(p.title,p.summary,`/learn/paths/${slug}`):{title:'Path not found'};}
export default async function Path({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const path=learningPaths.find(p=>p.slug===slug);if(!path)notFound();return <div className="wrap section"><Link className="text-link" href="/learn">← All learning paths</Link><p className="eyebrow">Learn and apply</p><h1>{path.title}</h1><p className="lead">{path.summary}</p><ol className="learning-path-list">{path.lessons.map(slug=>{const l=learningLessons.find(l=>l.slug===slug)!;return <li key={slug}><Link className="guide-card" href={`/learn/${slug}`}><span className="tag">{l.advanced?'Advanced lesson':'Free lesson'} · {l.readMinutes} minutes</span><h2>{l.title}</h2><p>{l.summary}</p><span className="text-link">Read, try and check →</span></Link></li>;})}</ol><p>Use Advanced to save passed knowledge checks and resume your next lesson from your workspace.</p><StructuredData data={{'@context':'https://schema.org','@type':'ItemList',name:path.title,itemListElement:path.lessons.map((s,i)=>({'@type':'ListItem',position:i+1,url:new URL(`/learn/${s}`,SITE_URL).toString()}))}}/></div>;}
