import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const previewSource = fs.readFileSync(
  path.join(root, "lib/approved-style-previews.ts"),
  "utf8",
);
const middlewareSource = fs.readFileSync(
  path.join(root, "middleware.ts"),
  "utf8",
);

const previewPaths = [
  ...previewSource.matchAll(/["'](\/templates\/[^"']+)["']/g),
].map((match) => match[1]);
const requiredCarouselPreviewPaths = [
  "/templates/character-emotion-story-v1/approved-preview.jpg",
  "/templates/clear-magazine-carousel-v1/approved-preview.jpg",
  "/templates/moody-lifestyle-quiz-v1/approved-preview.jpg",
];

if (previewPaths.length === 0) {
  throw new Error("No approved style preview assets were found.");
}

for (const previewPath of previewPaths) {
  if (previewPath.includes("/references/")) {
    throw new Error(
      `Style reference must not be exposed as approved output: ${previewPath}`,
    );
  }

}

for (const previewPath of requiredCarouselPreviewPaths) {
  if (!previewPaths.includes(previewPath)) {
    throw new Error(`Required carousel preview is not mapped: ${previewPath}`);
  }

  const absolutePath = path.join(root, "public", previewPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Approved style preview asset is missing: ${previewPath}`);
  }
}

const requiredMiddlewareChecks = [
  "isApprovedStylePreviewAsset",
  "const isPublicPublishedAsset = isApprovedStylePreviewAsset(pathname)",
  "isPublicMachineRoute || isPublicPublishedAsset",
];

for (const requiredCheck of requiredMiddlewareChecks) {
  if (!middlewareSource.includes(requiredCheck)) {
    throw new Error(
      `Middleware does not preserve the approved preview access boundary: ${requiredCheck}`,
    );
  }
}

if (!previewSource.includes("APPROVED_STYLE_PREVIEW_ASSETS.has(pathname)")) {
  throw new Error("Approved preview access must use an exact path allowlist.");
}

console.log(
  `Verified ${requiredCarouselPreviewPaths.length} carousel preview assets and exact access boundary for ${previewPaths.length} approved paths.`,
);
