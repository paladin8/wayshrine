import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";

const socialImage = "images/wayshrine-social.jpg";
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig(({ mode }) => {
  const publicUrl = loadEnv(mode, process.cwd(), "VITE_SITE_URL").VITE_SITE_URL?.trim();
  const siteUrl = publicUrl ? new URL(publicUrl) : undefined;
  if (siteUrl) {
    if (!["https:", "http:"].includes(siteUrl.protocol) || siteUrl.search || siteUrl.hash || siteUrl.username || siteUrl.password) {
      throw new Error("VITE_SITE_URL must be the public HTTP(S) site URL without credentials, a query, or a fragment");
    }
    if (!siteUrl.pathname.endsWith("/")) siteUrl.pathname += "/";
  }

  const imageUrl = siteUrl ? new URL(socialImage, siteUrl).href : `./${socialImage}`;
  return {
    // Keep assets relative so the web and desktop builds can load from any base.
    base: "./",
    define: {
      "import.meta.env.WAYSHRINE_SOCIAL_IMAGE": JSON.stringify(imageUrl.replaceAll("&", "&amp;")),
      // Shown in the corner of the title screen, so bug reports can name the build.
      "import.meta.env.WAYSHRINE_VERSION": JSON.stringify(version),
    },
    plugins: siteUrl ? [{
      name: "wayshrine-canonical-url",
      apply: "build",
      transformIndexHtml: () => [
        { tag: "link", attrs: { rel: "canonical", href: siteUrl.href }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:url", content: siteUrl.href }, injectTo: "head" },
      ],
    }] : [],
  };
});
