import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Don't advertise the framework in response headers. */
  poweredByHeader: false,
};

export default nextConfig;
