import type { Metadata } from 'next';
import { SITE_URL } from './config';
export function publicIndexing() { return process.env.NODE_ENV==='production' && process.env.VERCEL_ENV!=='preview' && SITE_URL.startsWith('https://'); }
export function pageMetadata(title:string,description:string,path:string):Metadata {
 const url=new URL(path,SITE_URL).toString();
 return {title,description,alternates:{canonical:url},openGraph:{title,description,url,siteName:'My Business Checker',locale:'en_GB',type:'website'},twitter:{card:'summary',title,description}};
}
export function structuredJson(data:unknown) { return JSON.stringify(data).replace(/</g,'\\u003c'); }
