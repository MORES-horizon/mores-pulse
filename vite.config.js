import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: set `base` to "/<repo-name>/" when deploying to GitHub Pages
// under a project site (https://<user>.github.io/<repo-name>/).
// If you are using a custom domain or a user site, set base: "/"
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/mores-pulse/",
});
