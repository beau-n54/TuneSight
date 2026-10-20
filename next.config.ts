import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/dashboard/vehicles/*/analysis": ["./BMW-XDFs-master/**/*.xdf", "./BMW-XDFs-master/N54/**/*.bin"],
    "/dashboard/vehicles/*/calibration": ["./BMW-XDFs-master/**/*.xdf", "./BMW-XDFs-master/N54/**/*.bin"],
    "/api/calibration-workshop/upload": ["./BMW-XDFs-master/**/*.xdf", "./BMW-XDFs-master/N54/**/*.bin"],
  },
};

export default nextConfig;
