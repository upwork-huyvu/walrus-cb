import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Monorepo nhiều lockfile → cố định root về app này (tránh cảnh báo inferred root).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
