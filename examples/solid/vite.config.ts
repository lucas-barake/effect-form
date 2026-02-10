import solid from "vite-plugin-solid"
import * as path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      "@lucas-barake/effect-form-solid": path.resolve(__dirname, "../../packages/form-solid/src"),
      "@lucas-barake/effect-form": path.resolve(__dirname, "../../packages/form/src")
    }
  }
})
