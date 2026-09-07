import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/dashboard/vehicles/*/calibration": ["./BMW-XDFs-master/N54/**/*.xdf", "./BMW-XDFs-master/N54/**/*.bin"],
    "/api/calibration-workshop/upload": ["./BMW-XDFs-master/N54/**/*.xdf", "./BMW-XDFs-master/N54/**/*.bin"],
  },
};

export default nextConfig;
