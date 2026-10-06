/**
 * The approved cover shown for the current published style in SOON Core.
 *
 * This is deliberately separate from style references. References are source
 * material and must never be presented to Creator users as published output.
 */
export const APPROVED_STYLE_PREVIEWS: Readonly<Record<string, string>> = {
  character_emotion_story:
    "/templates/character-emotion-story-v1/approved-preview.jpg",
  classical_culture_remix:
    "/templates/classical-culture-remix-v1/approved-preview.jpg",
  clear_magazine_carousel:
    "/templates/clear-magazine-carousel-v1/approved-preview.jpg",
  documentary_image_story:
    "/templates/documentary-image-story-v1/approved-preview.png",
  editorial_office_flash:
    "/templates/editorial-office-flash-v1/approved-preview.jpg",
  first_person_journey_diary:
    "/templates/first-person-journey-diary-v1/poster.jpg",
  moody_lifestyle_quiz:
    "/templates/moody-lifestyle-quiz-v1/approved-preview.jpg",
  product_focus: "/templates/product-focus-v2/approved-preview.jpg",
  quiet_research_editorial:
    "/templates/quiet-research-editorial-v1/approved-preview.jpg",
  ranking_review: "/templates/ranking-review-v1/approved-preview.jpg",
  single_character_punchline:
    "/templates/single-character-punchline-v2/approved-preview.png",
  single_people_news_collage:
    "/templates/single-people-news-collage-v2/approved-preview.png",
  single_photo_news_card:
    "/templates/single-photo-news-card-v3/approved-preview.png",
};

const APPROVED_STYLE_PREVIEW_ASSETS = new Set(
  Object.values(APPROVED_STYLE_PREVIEWS),
);

export function approvedStylePreview(code: string) {
  return APPROVED_STYLE_PREVIEWS[code] ?? null;
}

export function isApprovedStylePreviewAsset(pathname: string) {
  return APPROVED_STYLE_PREVIEW_ASSETS.has(pathname);
}
