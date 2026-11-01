import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "My Business Checker", short_name: "Business Checker",
    description: "Clear UK business tools for tax, VAT and take-home pay.",
    start_url: "/tools", scope: "/", display: "standalone", lang: "en-GB",
    background_color: "#fafbf6", theme_color: "#193c32",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
