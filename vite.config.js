import { defineConfig } from "vite";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main:   resolve(import.meta.dirname, "index.html"),
        jurado: resolve(import.meta.dirname, "jurado/index.html"),
        admin:  resolve(import.meta.dirname, "admin/index.html"),
      },
    },
  },
});
