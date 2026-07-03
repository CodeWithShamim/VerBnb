/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Rewrite barrel imports to per-module paths so only the components
    // actually used land in each route's bundle.
    optimizePackageImports: ["recharts", "framer-motion", "@react-three/drei"],
  },
};
export default nextConfig;
