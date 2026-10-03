import { join } from "node:path";
import { decodeImage, expectedMime, loadManifest } from "./template-asset-validation.mjs";

const baseUrl = (process.argv[2] || process.env.TEMPLATE_ASSET_BASE_URL || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(baseUrl)) {
  throw new Error("usage: npm run verify:deployed-template-assets -- https://example.com");
}

const manifest = await loadManifest(join(process.cwd(), "data/published-carousel-asset-manifest.json"));
let assetCount = 0;
for (const style of manifest.styles) {
  for (const asset of style.assets) {
    const response = await fetch(`${baseUrl}${asset}`, { redirect: "manual" });
    if (response.status !== 200) {
      throw new Error(`${style.code}: ${asset} returned HTTP ${response.status}`);
    }
    const expected = expectedMime(asset);
    const actual = response.headers.get("content-type")?.split(";", 1)[0].toLowerCase();
    if (actual !== expected) {
      throw new Error(`${style.code}: ${asset} returned ${actual || "no content-type"}, expected ${expected}`);
    }
    const body = Buffer.from(await response.arrayBuffer());
    await decodeImage(body, asset);
    assetCount += 1;
  }
  console.log(`PASS ${style.code} (${style.assets.length} assets)`);
}
console.log(`Verified ${assetCount} deployed assets across ${manifest.styles.length} published carousel styles at ${baseUrl}.`);
