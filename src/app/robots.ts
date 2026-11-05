import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { publicIndexing } from '@/lib/seo';
export default function robots():MetadataRoute.Robots {
 if(!publicIndexing())return {rules:{userAgent:'*',disallow:'/'}};
 return {rules:{userAgent:'*',allow:'/',disallow:['/account','/api/','/auth/','/sign-in','/reset-password','/bookkeeping','/projects']},sitemap:new URL('/sitemap.xml',SITE_URL).toString()};
}
