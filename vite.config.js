import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vite";

const publicFiles = [
  "index.html",
  "events.html",
  "team.html",
  "awards.html",
  "styles.css",
  "preview.css",
  "awards.css",
  "script.js",
];

function copyPublicSite() {
  return {
    name: "copy-public-site",
    async closeBundle() {
      const output = resolve("dist/client");
      await mkdir(output, { recursive: true });
      await Promise.all(publicFiles.map((file) => cp(resolve(file), resolve(output, file))));
      await cp(resolve("assets"), resolve(output, "assets"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [sites(), copyPublicSite()],
  build: {
    lib: {
      entry: resolve("site-worker.js"),
      formats: ["es"],
      fileName: () => "server/index.js",
    },
  },
});
