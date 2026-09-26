import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  base: process.env.PAGES_BASE || "/precastflow/",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  build: { outDir: "pages-dist" },
  define: { "process.env.NEXT_PUBLIC_STATIC_DEMO": JSON.stringify("true") },
});
