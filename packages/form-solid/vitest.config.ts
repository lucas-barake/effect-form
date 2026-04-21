import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solid()],
  test: {
    include: ["./test/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"]
  }
})
