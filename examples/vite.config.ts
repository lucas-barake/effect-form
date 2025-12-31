import react from "@vitejs/plugin-react"
import * as path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@lucas-barake/effect-form-react": path.resolve(__dirname, "../packages/form-react/src"),
      "@lucas-barake/effect-form": path.resolve(__dirname, "../packages/form/src")
    }
  }
})
