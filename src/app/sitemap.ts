import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { tools } from "@/content/tools";
import { guides } from "@/content/guides";
export default function sitemap():MetadataRoute.Sitemap {return ["", "/tools", "/guides", "/pricing", "/about", "/methodology", ...tools.map(t=>`/tools/${t.slug}`), ...guides.map(g=>`/guides/${g.slug}`)].map(path=>({url:new URL(path,SITE_URL).toString()}));}
