import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import sharp from "sharp";

const MIME_BY_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

export function expectedMime(assetPath) {
  return MIME_BY_EXTENSION[extname(assetPath).toLowerCase()] ?? null;
}

export async function decodeImage(input, assetPath) {
  const mime = expectedMime(assetPath);
  if (!mime) throw new Error(`unsupported image extension: ${assetPath}`);
  const buffer = Buffer.isBuffer(input) ? input : await readFile(input);
  if (mime === "image/svg+xml") {
    const text = buffer.toString("utf8");
    if (!/<svg(?:\s|>)/i.test(text)) throw new Error(`invalid SVG: ${assetPath}`);
    return { mime, width: null, height: null, bytes: buffer.length };
  }
  const image = await sharp(buffer, { failOn: "error" }).metadata();
  if (!image.width || !image.height) throw new Error(`zero-sized image: ${assetPath}`);
  const decodedMime = image.format === "jpeg" ? "image/jpeg" : `image/${image.format}`;
  if (decodedMime !== mime) {
    throw new Error(`content is ${decodedMime}, expected ${mime}: ${assetPath}`);
  }
  return { mime, width: image.width, height: image.height, bytes: buffer.length };
}

export async function loadManifest(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.styles) || manifest.styles.length !== 12) {
    throw new Error(`expected exactly 12 published carousel styles, got ${manifest.styles?.length ?? 0}`);
  }
  const codes = new Set(manifest.styles.map((style) => style.code));
  if (codes.size !== manifest.styles.length) throw new Error("duplicate style code in asset manifest");
  return manifest;
}
