'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './ui-icon';
export function SiteHeader(){const path=usePathname();return <header className="site-header"><div className="header-inner"><Link href="/" className="brand" aria-label="My Business Checker home"><span className="brand-icon"><Icon name="chart" size={23}/></span><span>my business<span className="brand-second">checker<span className="brand-dot">.</span></span></span></Link><nav aria-label="Main navigation">{[['/tools','Tools'],['/guides','Guides'],['/pricing','Pricing'],['/about','About']].map(([href,label])=><Link key={href} href={href} aria-current={path===href||path.startsWith(`${href}/`)?'page':undefined}>{label}</Link>)}</nav><Link className={`header-account ${path.startsWith('/account')?'is-current':''}`} href="/account"><Icon name="user" size={18}/><span>My workspace</span><Icon name="arrow" size={16}/></Link></div></header>;}
