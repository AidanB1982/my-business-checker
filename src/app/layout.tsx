import { AppInstall } from "@/components/app-install";
import type { Viewport, Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_URL } from "@/lib/config";
export const viewport: Viewport = { themeColor: "#193c32" };
export const metadata: Metadata = {
  applicationName: "My Business Checker",
  appleWebApp: { capable: true, title: "Business Checker", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  metadataBase: new URL(SITE_URL), title: { default: "My Business Checker — Understand your business", template: "%s | My Business Checker" },
  description: "Clear UK business tools and guides. Free core calculators, with advanced planning features planned at £1.99 per month.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><Link href="/" className="brand"><span className="brand-icon" aria-hidden="true">✓</span><span>MY BUSINESS<br/>CHECKER<span className="brand-dot">.</span></span></Link><nav aria-label="Main navigation"><Link href="/tools">Tools</Link><Link href="/guides">Guides</Link><Link href="/pricing">Pricing</Link><Link href="/about">About</Link></nav><Link className="button small" href="/tools">Check my numbers <span aria-hidden="true">→</span></Link></header><main id="main">{children}</main><footer><div className="footer-top"><Link href="/" className="brand">MY BUSINESS CHECKER.</Link><p>Clearer numbers. Better decisions.</p></div><AppInstall/><div className="footer-links">{["methodology", "privacy", "disclaimer", "contact", "account"].map(page => <Link key={page} href={`/${page}`}>{page[0].toUpperCase()+page.slice(1)}</Link>)}</div><p className="fine">Information and estimates only. Not personalised tax or financial advice. This is a development preview; tools marked in development are not available yet.</p></footer></body></html>;
}
