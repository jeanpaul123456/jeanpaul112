import { defineConfig } from "vite";
export default defineConfig({
  base: "/app/",
  server: {
    proxy: {
      "/auth": "http://127.0.0.1:3000",
      "/ai": "http://127.0.0.1:3000",
      "/directory": "http://127.0.0.1:3000",
      "/requests": "http://127.0.0.1:3000",
      "/notifications": "http://127.0.0.1:3000",
    },
  },
});
