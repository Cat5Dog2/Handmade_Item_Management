import path from "node:path";
import { defineConfig } from "vite";

const envDir = path.resolve(__dirname, "../..");

export default defineConfig({
  envDir,
  resolve: {
    alias: {
      "@handmade/shared": path.resolve(envDir, "packages/shared/src/index.ts")
    }
  },
  test: {
    environment: "node",
    globals: true
  }
});
