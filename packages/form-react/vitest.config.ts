import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["./test/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"]
  }
})
