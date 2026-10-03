import { access } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { decodeImage, loadManifest } from "./template-asset-validation.mjs";

const root = process.cwd();
const manifest = await loadManifest(join(root, "data/published-carousel-asset-manifest.json"));
let hasGit = true;
try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "ignore" });
} catch {
  hasGit = false;
}

let assetCount = 0;
for (const style of manifest.styles) {
  if (!Array.isArray(style.assets) || style.assets.length === 0) {
    throw new Error(`${style.code}: no assets declared`);
  }
  for (const asset of style.assets) {
    if (!asset.startsWith("/templates/") || asset.includes("..")) {
      throw new Error(`${style.code}: unsafe public asset path ${asset}`);
    }
    const relative = `public${asset}`;
    const absolute = join(root, relative);
    await access(absolute);
    if (hasGit) {
      try {
        execFileSync("git", ["ls-files", "--error-unmatch", "--", relative], { cwd: root, stdio: "ignore" });
      } catch {
        throw new Error(`${style.code}: asset exists but is not tracked by git: ${relative}`);
      }
    }
    await decodeImage(absolute, asset);
    assetCount += 1;
  }
}

console.log(`Verified ${assetCount} local assets across ${manifest.styles.length} published carousel styles.`);
