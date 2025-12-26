import * as path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["./test/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@lucas-barake/effect-form/test": path.join(__dirname, "test"),
      "@lucas-barake/effect-form": path.join(__dirname, "src")
    }
  }
})
