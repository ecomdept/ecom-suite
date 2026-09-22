import type { NextConfig } from "next";

const forwardedOrigins = (
  process.env.NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => {
    try {
      return new URL(
        origin.includes("://") ? origin : `https://${origin}`,
      ).host;
    } catch {
      return "";
    }
  })
  .filter(Boolean);

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      ...(forwardedOrigins.length > 0 ? { allowedOrigins: forwardedOrigins } : {}),
    },
  },
  ...(forwardedOrigins.length > 0
    ? {
        allowedDevOrigins: forwardedOrigins,
      }
    : {}),
};

export default nextConfig;
