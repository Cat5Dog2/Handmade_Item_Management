import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const envDir = path.resolve(__dirname, "../..");

const vendorChunks = [
  {
    includes: ["firebase"],
    name: "firebase"
  },
  {
    includes: ["html5-qrcode", "qrcode"],
    name: "qr"
  },
  {
    includes: [
      "@tanstack/react-query",
      "@hookform/resolvers",
      "react-hook-form",
      "zod"
    ],
    name: "forms-query"
  },
  {
    includes: ["react", "react-dom", "react-router-dom"],
    name: "react"
  }
] as const;

function getManualChunk(id: string) {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  return vendorChunks.find((chunk) =>
    chunk.includes.some((dependency) => id.includes(dependency))
  )?.name;
}

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
          manualChunks: getManualChunk
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
