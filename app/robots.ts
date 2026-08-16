import type { MetadataRoute } from "next";

/**
 * The whole app is private. Nothing here should be indexed — not the
 * staff side, and certainly not the sub portal, which contains prices.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
