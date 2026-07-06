import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick a stray parent lockfile.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
