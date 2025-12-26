import * as path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["./test/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"]
  },
  resolve: {
    alias: {
      "@lucas-barake/effect-form-react/test": path.join(__dirname, "test"),
      "@lucas-barake/effect-form-react": path.join(__dirname, "src"),
      "@lucas-barake/effect-form": path.join(__dirname, "../form/src")
    }
  }
})
