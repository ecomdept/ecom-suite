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
  ...(forwardedOrigins.length > 0
    ? {
        allowedDevOrigins: forwardedOrigins,
        experimental: {
          serverActions: {
            allowedOrigins: forwardedOrigins,
          },
        },
      }
    : {}),
};

export default nextConfig;
