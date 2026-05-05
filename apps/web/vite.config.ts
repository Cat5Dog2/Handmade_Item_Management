import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const envDir = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET ??
    env.VITE_API_PROXY_TARGET ??
    "http://localhost:8080";

  return {
    envDir,
    plugins: [react()],
    resolve: {
      alias: {
        "@handmade/shared": path.resolve(envDir, "packages/shared/src/index.ts")
      }
    },
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("firebase")) {
              return "firebase";
            }

            if (id.includes("html5-qrcode") || id.includes("qrcode")) {
              return "qr";
            }

            if (
              id.includes("@tanstack/react-query") ||
              id.includes("@hookform/resolvers") ||
              id.includes("react-hook-form") ||
              id.includes("zod")
            ) {
              return "forms-query";
            }

            if (
              id.includes("react") ||
              id.includes("react-dom") ||
              id.includes("react-router-dom")
            ) {
              return "react";
            }

            return undefined;
          }
        }
      }
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts"
    }
  };
});
