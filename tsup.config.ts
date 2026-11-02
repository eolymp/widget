import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts", protocol: "src/protocol.ts" },
    format: "esm",
    dts: true,
    target: "es2020",
  },
  {
    entry: { "widget-sdk": "src/global.ts" },
    format: "iife",
    minify: true,
    target: "es2020",
    outExtension: () => ({ js: ".js" }),
  },
]);
