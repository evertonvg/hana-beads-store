import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // /trocas sends up to 4 photos of 5 MB (MAX_RETURN_PHOTO_BYTES) in one Server Action request.
    serverActions: { bodySizeLimit: "21mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Legal pages live in content/legal/*.mdx and are imported by the route files; no remark/rehype plugins.
const withMDX = createMDX({});

export default withMDX(nextConfig);
