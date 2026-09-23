import type { NextConfig } from "next";

// Đưa mã commit vào bundle để màn Cài đặt nói được nó là bản nào. Khi máy còn
// giữ bản cũ trong cache, đây là cách duy nhất nhìn ra ngay mà không phải đoán.
const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_SHA: sha },
};

export default nextConfig;
