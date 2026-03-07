import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/widget",
    emptyOutDir: true,
    manifest: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: "/src/widget/index.html",
      output: {
        entryFileNames: "widget.js",
        chunkFileNames: "widget.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "widget.css";
          }

          return "assets/[name][extname]";
        },
      },
    },
  },
});
