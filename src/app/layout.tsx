import { publicIndexing } from '@/lib/seo';
import { UsageTracker } from '@/components/usage-tracker';
import { AppearanceLoader } from '@/components/appearance-settings';
import { SiteHeader } from "@/components/site-header";
import { AppInstall } from "@/components/app-install";
import type { Viewport, Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_URL } from "@/lib/config";
export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };
export const metadata: Metadata = {
  robots:{index:publicIndexing(),follow:publicIndexing()},
  verification:process.env.GOOGLE_SITE_VERIFICATION?{google:process.env.GOOGLE_SITE_VERIFICATION}:undefined,
  applicationName: "My Business Checker",
  appleWebApp: { capable: true, title: "Business Checker", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  metadataBase: new URL(SITE_URL), title: { default: "My Business Checker · Understand your business", template: "%s | My Business Checker" },
  description: "Clear UK business tools and guides. Free UK calculators for tax, salary and pensions. Save, compare and download with Advanced for £1.99 per month.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body><AppearanceLoader/><UsageTracker/><a className="skip-link" href="#main">Skip to content</a><SiteHeader/><main id="main">{children}</main><footer><div className="footer-top"><Link href="/" className="brand">MY BUSINESS CHECKER.</Link><p>Clearer numbers. Better decisions.</p></div><AppInstall/><div className="footer-links">{["about", "sole-traders", "landlords", "projects", "methodology", "learn", "privacy", "disclaimer", "contact", "account"].map(page => <Link key={page} href={`/${page}`}>{page[0].toUpperCase()+page.slice(1).replaceAll("-"," ")}</Link>)}</div><p className="fine">Information and estimates only. Not personalised tax or financial advice. Calculator previews include assumptions, limitations and source references. Check the methodology before relying on an estimate.</p></footer></body></html>;
}
