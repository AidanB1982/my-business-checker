'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './ui-icon';
import type { WorkspaceFocus } from '@/content/learning-paths';
import { tools } from '@/content/tools';
const tool = (slug: string) => { const item = tools.find(t => t.slug === slug)!; return { label: item.name, href: `/tools/${slug}` }; };
const sections: { title: string; icon: IconName; description: string; links: { label: string; href: string }[] }[] = [
 { title: 'Sole traders', icon: 'wallet', description: 'Income, expenses, tax and your monthly workings.', links: [{ label: 'Sole trader overview', href: '/sole-traders' }, ...['sole-trader-working-sheet','self-employed-tax-calculator','vat-threshold-checker','business-mileage-calculator','mtd-checker'].map(tool), { label: 'Business bookkeeping · Advanced', href: '/bookkeeping' }] },
 { title: 'Landlords', icon: 'file', description: 'Rent, property costs, mortgages and improvements.', links: [{ label: 'Landlord overview', href: '/landlords' }, ...['landlord-rent-reconciliation','property-maintenance-reserve','rental-yield-mortgage-planner','mtd-checker'].map(tool), { label: 'Property bookkeeping · Advanced', href: '/bookkeeping' }, { label: 'Plan property improvements', href: '/projects' }] },
 { title: 'Projects', icon: 'grid', description: 'Plans, subprojects, deadlines, budgets and progress.', links: [{ label: 'Projects, tasks & timelines', href: '/projects' }, { label: 'Construction assets & depreciation · Advanced', href: '/bookkeeping' }] },
 { title: 'Bookkeeping', icon: 'book', description: 'Purchases, income, invoices and clear accounts.', links: [{ label: 'Open bookkeeping · Advanced', href: '/bookkeeping' }, { label: 'What Advanced includes', href: '/pricing' } ] },
 { title: 'Calculators', icon: 'calculator', description: 'All your tools for salary, pensions, tax and planning.', links: tools.map(t => ({ label: t.name, href: `/tools/${t.slug}` })) },
 { title: 'Guides', icon: 'shield', description: 'Plain English reading and the assumptions behind your figures.', links: [{ label: 'Guided learning paths', href: '/learn' }, { label: 'Browse all guides', href: '/guides' }, { label: 'How the calculations work', href: '/methodology' }] },
];
export function WorkspaceSections({focus=null}:{focus?:WorkspaceFocus|null}) {
 const [selected, setSelected] = useState<string | null>(null);
 return <section className="workspace-sections-hub" aria-labelledby="workspace-sections-heading"><div className="workspace-section-head"><div><h2 id="workspace-sections-heading">What would you like to work on?</h2><p>Choose a section to see its tools and next steps.</p></div></div><div className="workspace-section-tiles">{[...sections].sort((a,b)=>Number(b.title===(focus==='sole-traders'?'Sole traders':focus==='landlords'?'Landlords':focus==='personal'?'Calculators':''))-Number(a.title===(focus==='sole-traders'?'Sole traders':focus==='landlords'?'Landlords':focus==='personal'?'Calculators':''))).map(section => <div className="workspace-section-tile" key={section.title}><button type="button" aria-expanded={selected === section.title} aria-controls={`section-${section.title.toLowerCase()}`} onClick={() => setSelected(selected === section.title ? null : section.title)}><Icon name={section.icon} size={28}/><span><strong>{section.title}</strong><span>{section.description}</span></span><Icon name="arrow" size={18}/></button><div id={`section-${section.title.toLowerCase()}`} hidden={selected !== section.title} className="workspace-section-links"><ul>{section.links.map(link => <li key={link.href}><Link href={link.href}>{link.label}<span aria-hidden="true"> →</span></Link></li>)}</ul></div></div>)}</div></section>;
}
