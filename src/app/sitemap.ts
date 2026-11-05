import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { tools } from '@/content/tools';
import { guides } from '@/content/guides';
import { learningLessons } from '@/content/learning';
import { learningPaths } from '@/content/learning-paths';
import { topics } from '@/content/topics';
export default function sitemap():MetadataRoute.Sitemap {return ['', '/tools','/guides','/learn','/pricing','/about','/methodology','/sole-traders','/landlords',...tools.map(t=>`/tools/${t.slug}`),...guides.map(g=>`/guides/${g.slug}`),...learningLessons.map(l=>`/learn/${l.slug}`),...learningPaths.map(p=>`/learn/paths/${p.slug}`),...topics.map(t=>`/topics/${t.slug}`)].map(path=>({url:new URL(path,SITE_URL).toString()}));}
