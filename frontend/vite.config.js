import { defineConfig } from "vite";
export default defineConfig({
  base: "/app/",
  server: {
    proxy: {
      "/directory": "http://127.0.0.1:3000",
      "/requests": "http://127.0.0.1:3000",
      "/notifications": "http://127.0.0.1:3000",
    },
  },
});
