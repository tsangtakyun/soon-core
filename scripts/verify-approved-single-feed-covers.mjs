import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(join(root, "data/approved-single-feed-cover-manifest.json"), "utf8"),
);

for (const cover of manifest.covers) {
  if (!cover.asset.startsWith("/templates/") || cover.asset.includes("..")) {
    throw new Error(`${cover.style_code}: unsafe asset path ${cover.asset}`);
  }

  const bytes = await readFile(join(root, `public${cover.asset}`));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== cover.sha256) {
    throw new Error(`${cover.style_code}: SHA-256 mismatch`);
  }

  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== cover.width || metadata.height !== cover.height) {
    throw new Error(
      `${cover.style_code}: expected ${cover.width}x${cover.height}, got ${metadata.width}x${metadata.height}`,
    );
  }
}

console.log(`Verified ${manifest.covers.length} approved single-feed cover.`);
