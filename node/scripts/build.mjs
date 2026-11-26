import { build } from "esbuild";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

await Promise.all([
  build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    outfile: "dist/index.mjs",
    sourcemap: true,
  }),
  build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: "dist/index.cjs",
    sourcemap: true,
  }),
]);

execSync("npx tsc --emitDeclarationOnly", { stdio: "inherit" });
console.log("[smarthivesms] Built dist/index.mjs, dist/index.cjs, and dist/index.d.ts");
