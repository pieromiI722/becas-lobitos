import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// base: "./" → rutas relativas, funciona en GitHub Pages tanto en
// usuario.github.io como en usuario.github.io/nombre-del-repo/
export default defineConfig({
  base: "./",
  plugins: [tailwindcss()],
});
