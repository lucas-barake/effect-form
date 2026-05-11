import babel from "@rollup/plugin-babel"
import nodeResolve from "@rollup/plugin-node-resolve"

export default {
  input: {
    index: "src/index.ts",
    FormSolid: "src/FormSolid.tsx"
  },
  output: {
    dir: "dist",
    entryFileNames: "[name].js",
    format: "es"
  },
  external: [
    "@effect/atom-solid",
    "@lucas-barake/effect-form",
    "@lucas-barake/effect-form/Path",
    "effect/Layer",
    "effect/Option",
    "effect/unstable/reactivity/Atom",
    "solid-js"
  ],
  plugins: [
    nodeResolve({
      extensions: [".js", ".ts", ".tsx"]
    }),
    babel({
      babelHelpers: "bundled",
      exclude: ["node_modules/**", "**/*.test.tsx"],
      extensions: [".js", ".ts", ".tsx"],
      presets: ["solid", "@babel/preset-typescript"]
    })
  ]
}
