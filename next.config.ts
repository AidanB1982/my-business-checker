import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{source:"/api/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"}]},{source:"/auth/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"}]},{source:"/sw.js",headers:[{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},{key:"Service-Worker-Allowed",value:"/"}]}];
  },
};
export default config;
