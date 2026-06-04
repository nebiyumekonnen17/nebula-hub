import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/nebula-hub/",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/adzuna-api": {
        target: "https://api.adzuna.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/adzuna-api/, ""),
      },
    },
  },
});
