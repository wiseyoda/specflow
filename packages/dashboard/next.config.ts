import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark chokidar and fsevents as external (Node.js native modules)
  // This is needed because Turbopack has issues with fsevents
  serverExternalPackages: ['chokidar', 'fsevents'],

  // Transpile the shared package from the monorepo
  transpilePackages: ['@specflow/shared'],
};

export default nextConfig;
