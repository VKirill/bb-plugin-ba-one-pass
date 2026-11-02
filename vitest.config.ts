import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Only this plugin's tests: .bb/ holds chat scratch (cloned third-party repos).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["**/node_modules/**", ".bb/**", "dist/**"],
  },
});
