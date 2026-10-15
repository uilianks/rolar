// Per-icon imports ("lucide-react-native/icons/<name>") are typed with a wildcard, so a wrong name
// passes the typecheck and only breaks the bundler. Check every name against the installed package.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

it("imports only icons that exist", () => {
  const icons = path.resolve("node_modules/lucide-react-native/dist/esm/icons");
  const missing = files(path.resolve("src")).flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(/lucide-react-native\/icons\/([a-z0-9-]+)/g)]
      .map((m) => m[1])
      .filter((name) => !existsSync(path.join(icons, `${name}.mjs`)))
      .map((name) => `${path.relative(process.cwd(), f)}: ${name}`),
  );
  expect(missing).toEqual([]);
});
