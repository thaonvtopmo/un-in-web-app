import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mã phiên bản của bản đang chạy (Vercel đặt sẵn khi build), để máy đang mở bản cũ biết có bản mới
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
};

export default nextConfig;
