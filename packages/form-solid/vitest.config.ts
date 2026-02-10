import solidjs from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solidjs()],
  test: {
    include: ["./test/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"],
    server: {
      deps: {
        inline: [/solid-js/, /@effectify\/solid-effect-atom/]
      }
    }
  }
})
