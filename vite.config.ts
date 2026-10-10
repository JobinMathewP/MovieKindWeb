import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_API_URL"] as const;

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const env = { ...fileEnv, ...process.env };

  if (mode === "production") {
    for (const key of required) {
      if (!env[key]?.trim()) {
        throw new Error(`Missing ${key}. Set it in the Render environment before the build.`);
      }
    }
    const apiUrl = env.VITE_API_URL.trim();
    if (!apiUrl.startsWith("https://")) {
      throw new Error("VITE_API_URL must use https");
    }
  }

  return {
    plugins: [react()],
    build: {
      sourcemap: false,
      assetsDir: "assets",
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "https://moviekind.onrender.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          timeout: 180_000,
          proxyTimeout: 180_000,
        },
      },
    },
  };
});
