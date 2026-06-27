export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: "https://neon-game-ten.vercel.app/sitemap.xml",
  };
}
