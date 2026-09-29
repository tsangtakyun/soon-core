"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Canvas,
  FabricImage,
  FabricObject,
  Group,
  Rect,
  Textbox,
} from "fabric";
import { templatePageRoles } from "@/lib/template-contract";

const LEGACY_PAGE_ROLES = [
  { code: "cover", label: "01 Cover", hint: "封面 Hook" },
  { code: "longform", label: "02 Longform", hint: "長文內容" },
  { code: "split", label: "03 Split", hint: "左右分割" },
  { code: "comparison", label: "04 Comparison", hint: "對比資訊" },
  { code: "feature", label: "05 Feature", hint: "重點特色" },
  { code: "end", label: "06 End", hint: "總結／CTA" },
] as const;

type PageRole = string;
type PageDesign = {
  canvasJson?: Record<string, unknown>;
  canvasWidth?: number;
  canvasHeight?: number;
  coordinateWidth?: number;
  coordinateHeight?: number;
  updatedAt?: string;
};
type MasterPayload = {
  draft: {
    id: string;
    targetVersion: number;
    status: string;
    pageDesigns: Partial<Record<PageRole, PageDesign>>;
    changeSummary: string;
    updatedAt: string;
  };
  style: { code: string; name: string };
  template: { code: string; name: string; description: string; format: string };
  baseVersion: {
    number: number;
    rendererCode: string;
    contentHash: string;
    contract: Record<string, unknown>;
  } | null;
};

function humaniseRole(role: string) {
  return role.split("_").map((word) => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
}

type EditableObject = FabricObject & {
  data?: {
    binding?: string;
    fallback?: string;
    id?: string;
    required?: boolean;
    role?: string;
  };
};

const DISPLAY_WIDTH = 432;
const DISPLAY_HEIGHT = 540;
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1350;

const MASTER_STATE_STYLES = {
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 24,
  },
  badge: {
    color: "#a78bfa",
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: "0.16em",
  },
  button: {
    background: "#7c3aed",
    border: 0,
    borderRadius: 9,
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    padding: "11px 18px",
  },
  card: {
    background: "#16131b",
    border: "1px solid #332742",
    borderRadius: 18,
    boxShadow: "0 28px 80px rgba(0,0,0,.38)",
    maxWidth: 460,
    padding: "38px 34px",
    textAlign: "center",
    width: "calc(100% - 32px)",
  },
  heading: { color: "#f6f3f8", fontSize: 25, margin: "16px 0 10px" },
  icon: {
    alignItems: "center",
    background: "#281c39",
    border: "1px solid #65449a",
    borderRadius: 16,
    color: "#c4b5fd",
    display: "inline-flex",
    fontSize: 24,
    fontWeight: 900,
    height: 54,
    justifyContent: "center",
    marginTop: 22,
    width: 54,
  },
  link: {
    background: "#211e25",
    border: "1px solid #37323d",
    borderRadius: 9,
    color: "#ddd",
    fontSize: 12,
    fontWeight: 750,
    padding: "10px 17px",
    textDecoration: "none",
  },
  message: { color: "#aaa3af", fontSize: 13, lineHeight: 1.65, margin: 0 },
  page: {
    alignItems: "center",
    background: "#0b0b0d",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: 20,
  },
} satisfies Record<string, CSSProperties>;

function MasterEditorState({
  loading,
  message,
  onRetry,
}: {
  loading?: boolean;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <main aria-live="polite" style={MASTER_STATE_STYLES.page}>
      <section style={MASTER_STATE_STYLES.card}>
        <small style={MASTER_STATE_STYLES.badge}>SOON CORE · 文件母版</small>
        <div aria-hidden="true" style={MASTER_STATE_STYLES.icon}>
          {loading ? "…" : "!"}
        </div>
        <h1 style={MASTER_STATE_STYLES.heading}>
          {loading ? "正在準備母版" : "無法開啟母版"}
        </h1>
        <p style={MASTER_STATE_STYLES.message}>{message}</p>
        <div style={MASTER_STATE_STYLES.actions}>
          {onRetry ? (
            <button
              onClick={onRetry}
              style={MASTER_STATE_STYLES.button}
              type="button"
            >
              重新載入
            </button>
          ) : null}
          <Link href="/content-directions" style={MASTER_STATE_STYLES.link}>
            返回內容風格
          </Link>
        </div>
      </section>
    </main>
  );
}

function placeholderFor(role: PageRole) {
  const copy: Record<
    PageRole,
    { eyebrow: string; title: string; body: string }
  > = {
    cover: {
      eyebrow: "CATEGORY · BRAND",
      title: "{{headline}}",
      body: "{{subheadline}}",
    },
    longform: {
      eyebrow: "02 · CONTEXT",
      title: "{{headline}}",
      body: "{{body}}",
    },
    split: {
      eyebrow: "03 · TWO SIDES",
      title: "{{headline}}",
      body: "{{left_body}}\n\n{{right_body}}",
    },
    comparison: {
      eyebrow: "04 · COMPARE",
      title: "{{headline}}",
      body: "{{option_a}}\nVS\n{{option_b}}",
    },
    feature: {
      eyebrow: "05 · FEATURE",
      title: "{{headline}}",
      body: "{{body}}",
    },
    end: { eyebrow: "06 · SUMMARY", title: "{{headline}}", body: "{{cta}}" },
  };
  return copy[role] || {
    eyebrow: role.replaceAll("_", " ").toUpperCase(),
    title: "{{headline}}",
    body: "{{body}}",
  };
}

function attachData<T extends EditableObject>(object: T, role: string) {
  object.set({ originX: "left", originY: "top" });
  object.data = { id: crypto.randomUUID(), role };
  return object;
}

function createBrandLogoSlot(role: PageRole) {
  const isEndPage = role === "end";
  const width = isEndPage ? 132 : role === "cover" ? 108 : 92;
  const height = isEndPage ? 34 : role === "cover" ? 28 : 24;
  const background = new Rect({
    fill: "rgba(255,255,255,0.88)",
    height,
    left: 0,
    rx: 5,
    ry: 5,
    stroke: "#171717",
    strokeDashArray: [4, 3],
    strokeWidth: 1,
    top: 0,
    width,
  });
  const label = new Textbox("{{brand_logo}}", {
    fill: "#171717",
    fontFamily: "Arial, sans-serif",
    fontSize: isEndPage ? 12 : 10,
    fontWeight: 700,
    left: 6,
    lineHeight: 1,
    textAlign: "center",
    top: isEndPage ? 9 : role === "cover" ? 7 : 6,
    width: width - 12,
  });
  const slot = attachData(
    new Group([background, label], {
      left: isEndPage ? (DISPLAY_WIDTH - width) / 2 : 30,
      lockScalingFlip: true,
      top: isEndPage ? 470 : role === "cover" ? 492 : 500,
    }) as EditableObject,
    "brand_logo",
  );
  slot.data = {
    ...slot.data,
    binding: "workspace.logo_url",
    fallback: "template_defaults",
    required: true,
  };
  return slot;
}

function ensureBrandLogoSlot(canvas: Canvas, role: PageRole) {
  const exists = canvas
    .getObjects()
    .some((object) => (object as EditableObject).data?.role === "brand_logo");
  if (exists) return false;
  canvas.add(createBrandLogoSlot(role));
  return true;
}

type StarterStyle =
  | "product_focus"
  | "ranking_review"
  | "editorial_office_flash"
  | "moody_lifestyle_quiz"
  | "classical_culture_remix"
  | "quiet_research_editorial"
  | "character_emotion_story"
  | "immersive_folklore_ritual"
  | "single_photo_news_card"
  | "default";

function starterStyleFor(styleCode: string): StarterStyle {
  if (styleCode.includes("product_focus")) return "product_focus";
  if (styleCode.includes("ranking_review")) return "ranking_review";
  if (styleCode.includes("editorial_office_flash"))
    return "editorial_office_flash";
  if (styleCode.includes("moody_lifestyle_quiz")) return "moody_lifestyle_quiz";
  if (styleCode.includes("classical_culture_remix"))
    return "classical_culture_remix";
  if (styleCode.includes("quiet_research_editorial"))
    return "quiet_research_editorial";
  if (styleCode.includes("character_emotion_story"))
    return "character_emotion_story";
  if (styleCode.includes("immersive_folklore_ritual"))
    return "immersive_folklore_ritual";
  if (styleCode.includes("single_photo_news_card"))
    return "single_photo_news_card";
  return "default";
}

function referenceName(style: StarterStyle) {
  if (style === "product_focus") return "產品主角 · 米白產品舞台";
  if (style === "ranking_review") return "排行榜評測 · 大圖＋白底評語";
  if (style === "editorial_office_flash")
    return "冷調閃光編輯風 · PAZZO 辦公室攝影";
  if (style === "moody_lifestyle_quiz")
    return "暮色生活測驗風 · 暖灰照片與長文卡";
  if (style === "classical_culture_remix")
    return "古典文化拼貼 · 名畫二創與文化解說";
  if (style === "quiet_research_editorial")
    return "沉靜研究敘事 · 低飽和影像與知識長文";
  if (style === "character_emotion_story")
    return "角色情緒短劇 · 一句一幕情緒推進";
  if (style === "immersive_folklore_ritual")
    return "都市傳說體驗誌 · 第十三層電梯";
  if (style === "single_photo_news_card")
    return "圖像即時話題卡 · Tommy 批准 v2.1";
  return "SOON 基本版面";
}

const MOODY_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  cover: "/templates/moody-lifestyle-quiz-v1/01-cover.jpg",
  longform: "/templates/moody-lifestyle-quiz-v1/03-profile-short.jpg",
  split: "/templates/moody-lifestyle-quiz-v1/02-quiz.jpg",
  comparison: "/templates/moody-lifestyle-quiz-v1/05-profile-team.jpg",
  feature: "/templates/moody-lifestyle-quiz-v1/07-profile-deep.jpg",
  end: "/templates/moody-lifestyle-quiz-v1/09-cta.jpg",
};

const PRODUCT_FOCUS_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  cover: "/templates/product-focus-v2/01-cover.jpg",
  longform: "/templates/product-focus-v2/08-longform.jpg",
  split: "/templates/product-focus-v2/05-photo-collage.jpg",
  comparison: "/templates/product-focus-v2/06-principles.jpg",
  feature: "/templates/product-focus-v2/04-feature-closeup.jpg",
  end: "/templates/product-focus-v2/09-end.jpg",
};

const RANKING_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  cover: "/templates/ranking-review-v1/01-cover.jpg",
  longform: "/templates/ranking-review-v1/02-rank-1.jpg",
  split: "/templates/ranking-review-v1/03-rank-2.jpg",
  comparison: "/templates/ranking-review-v1/04-rank-3.jpg",
  feature: "/templates/ranking-review-v1/05-rank-4.jpg",
  end: "/templates/ranking-review-v1/06-rank-5.jpg",
};

const EDITORIAL_OFFICE_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  cover: "/templates/editorial-office-flash-v1/01-cover.jpg",
  longform: "/templates/editorial-office-flash-v1/02-research-highlight.jpg",
  split: "/templates/editorial-office-flash-v1/03-key-finding.jpg",
  comparison: "/templates/editorial-office-flash-v1/04-engagement-cta.jpg",
  feature: "/templates/editorial-office-flash-v1/05-photo-caption.jpg",
  end: "/templates/editorial-office-flash-v1/06-lookbook-grid.jpg",
};

const CLASSICAL_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  cover: "/templates/classical-culture-remix-v1/01-cover.jpg",
  longform: "/templates/classical-culture-remix-v1/02-editorial.jpg",
  split: "/templates/classical-culture-remix-v1/03-editorial.jpg",
  comparison: "/templates/classical-culture-remix-v1/03-editorial.jpg",
  feature: "/templates/classical-culture-remix-v1/04-visual-interlude.jpg",
  end: "/templates/classical-culture-remix-v1/04-visual-interlude.jpg",
};

const QUIET_RESEARCH_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  cover: "/templates/quiet-research-editorial-v1/01-cover.jpg",
  longform: "/templates/quiet-research-editorial-v1/02-full-image-body.jpg",
  split: "/templates/quiet-research-editorial-v1/03-evidence-card.jpg",
  comparison: "/templates/quiet-research-editorial-v1/05-list.jpg",
  feature: "/templates/quiet-research-editorial-v1/07-conclusion.jpg",
  end: "/templates/quiet-research-editorial-v1/08-cta.jpg",
};

const CHARACTER_EMOTION_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  cover: "/templates/character-emotion-story-v1/01-cover.jpg",
  longform: "/templates/character-emotion-story-v1/02-escalation.jpg",
  split: "/templates/character-emotion-story-v1/03-dilemma.jpg",
  comparison: "/templates/character-emotion-story-v1/04-contrast.jpg",
  feature: "/templates/character-emotion-story-v1/05-emotional-turn.jpg",
  end: "/templates/character-emotion-story-v1/08-resolution.jpg",
};

const IMMERSIVE_FOLKLORE_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  pov_hook: "/templates/immersive-folklore-ritual-v2/previews/page-01.png",
  rule_setup: "/templates/immersive-folklore-ritual-v2/previews/page-02.png",
  ritual_sequence: "/templates/immersive-folklore-ritual-v2/previews/page-03.png",
  threshold_crossing: "/templates/immersive-folklore-ritual-v2/previews/page-04.png",
  sensory_escalation: "/templates/immersive-folklore-ritual-v2/previews/page-05.png",
  encounter: "/templates/immersive-folklore-ritual-v2/previews/page-06.png",
  reveal: "/templates/immersive-folklore-ritual-v2/previews/page-07.png",
  fiction_close: "/templates/immersive-folklore-ritual-v2/previews/page-08.png",
};

const SINGLE_PHOTO_NEWS_REFERENCE_IMAGES: Partial<Record<PageRole, string>> = {
  single: "/templates/single-photo-news-card-v3/approved-preview.png",
};

function referenceImagesFor(style: StarterStyle) {
  if (style === "product_focus") return PRODUCT_FOCUS_REFERENCE_IMAGES;
  if (style === "ranking_review") return RANKING_REFERENCE_IMAGES;
  if (style === "editorial_office_flash")
    return EDITORIAL_OFFICE_REFERENCE_IMAGES;
  if (style === "moody_lifestyle_quiz") return MOODY_REFERENCE_IMAGES;
  if (style === "classical_culture_remix") return CLASSICAL_REFERENCE_IMAGES;
  if (style === "quiet_research_editorial")
    return QUIET_RESEARCH_REFERENCE_IMAGES;
  if (style === "character_emotion_story")
    return CHARACTER_EMOTION_REFERENCE_IMAGES;
  if (style === "immersive_folklore_ritual")
    return IMMERSIVE_FOLKLORE_REFERENCE_IMAGES;
  if (style === "single_photo_news_card")
    return SINGLE_PHOTO_NEWS_REFERENCE_IMAGES;
  return null;
}

async function addSinglePhotoNewsCardStarter(canvas: Canvas) {
  canvas.clear();
  canvas.backgroundColor = "#000000";
  const panelHeight = DISPLAY_HEIGHT / 2;
  const sourceWidth = 1122;
  const sourceHeight = 1402;
  const imageScale = DISPLAY_WIDTH / sourceWidth;
  const cropHeight = panelHeight / imageScale;
  const cropOverflow = sourceHeight - cropHeight;

  const addImage = async (
    src: string,
    role: "primary_image" | "secondary_image",
    binding: string,
    top: number,
    focalY: number,
  ) => {
    const image = (await FabricImage.fromURL(src, {
      crossOrigin: "anonymous",
    })) as EditableObject;
    image.set({
      cropX: 0,
      cropY: cropOverflow * focalY,
      height: cropHeight,
      left: 0,
      originX: "left",
      originY: "top",
      scaleX: imageScale,
      scaleY: imageScale,
      top,
      width: sourceWidth,
    });
    image.data = { id: crypto.randomUUID(), role, binding, required: true };
    canvas.add(image);
  };

  const addBoundText = (
    text: string,
    role: string,
    binding: string | undefined,
    options: ConstructorParameters<typeof Textbox>[1],
  ) => {
    const object = attachData(new Textbox(text, options) as EditableObject, role);
    object.data = { ...object.data, binding, required: true };
    canvas.add(object);
    return object;
  };

  await addImage(
    "/templates/single-photo-news-card-v3/01-fat-bear-editorial.png",
    "primary_image",
    "content.asset.primary",
    0,
    0.08,
  );
  await addImage(
    "/templates/single-photo-news-card-v3/02-fat-bear-salmon-editorial.png",
    "secondary_image",
    "content.asset.secondary",
    panelHeight,
    0.54,
  );

  [
    { top: 160, height: 110, opacity: 0.14 },
    { top: 200, height: 70, opacity: 0.2 },
    { top: 430, height: 110, opacity: 0.16 },
    { top: 470, height: 70, opacity: 0.22 },
  ].forEach(({ top, height, opacity }, index) => {
    const shade = attachData(new Rect({
      fill: `rgba(0,0,0,${opacity})`,
      height,
      left: 0,
      selectable: false,
      top,
      width: DISPLAY_WIDTH,
    }) as EditableObject, `shade_${index + 1}`);
    canvas.add(shade);
  });

  canvas.add(attachData(new Rect({
    fill: "#FFFFFF",
    height: 4,
    left: 0,
    selectable: false,
    top: panelHeight - 2,
    width: DISPLAY_WIDTH,
  }) as EditableObject, "panel_divider"));

  canvas.add(attachData(new Rect({ fill: "#111111", height: 18, left: 11, top: 10, width: 66 }) as EditableObject, "publisher_mark_background"));
  addBoundText("SOON 今日焦點", "brand_logo", "workspace.logo_url", {
    fill: "#FFFFFF", fontFamily: "Arial", fontSize: 7.2, fontWeight: 900,
    left: 16, lineHeight: 1, top: 15, width: 56,
  });
  canvas.add(attachData(new Rect({ fill: "#DCFF00", height: 18, left: 355, top: 10, width: 66 }) as EditableObject, "metric_background"));
  addBoundText("9月29日・冠軍日", "metric", "content.metric", {
    fill: "#000000", fontFamily: "Arial", fontSize: 7.2, fontWeight: 900,
    left: 359, lineHeight: 1, textAlign: "center", top: 15, width: 58,
  });

  const headlineBase = {
    fill: "#FFFFFF",
    fontFamily: "Arial",
    fontSize: 27.2,
    fontWeight: 900,
    lineHeight: 0.98,
    stroke: "#000000",
    strokeWidth: 3.6,
    paintFirst: "stroke" as const,
    textAlign: "center" as const,
    width: 390,
  };
  addBoundText("胖熊週決賽日\n全球網民選出年度冠軍", "primary_headline", "content.headline", {
    ...headlineBase, left: 21, top: 205,
  });
  addBoundText("夏秋不停進食\n為冬眠儲備脂肪", "secondary_headline", "content.secondary_headline", {
    ...headlineBase, left: 21, top: 443,
  });
  addBoundText("誰最成功把自己養胖？", "conclusion", "content.conclusion", {
    fill: "#FF4A3D", fontFamily: "Arial", fontSize: 15.6, fontWeight: 900,
    left: 14, lineHeight: 1.05, paintFirst: "stroke", stroke: "#FFFFFF",
    strokeWidth: 2.4, textAlign: "center", top: 510, width: 404,
  });
  addBoundText("AI 生成示意圖", "image_credit", undefined, {
    fill: "rgba(255,255,255,.82)", fontFamily: "Arial", fontSize: 4.8,
    left: 338, lineHeight: 1, textAlign: "right", top: 532, width: 42,
  });
  addBoundText("資料：美國國家公園管理局", "source", "content.source", {
    fill: "rgba(255,255,255,.82)", fontFamily: "Arial", fontSize: 4.8,
    left: 379, lineHeight: 1, textAlign: "right", top: 532, width: 50,
  });

  canvas.requestRenderAll();
}

function referenceOpacityFor(styleCode: string) {
  return referenceImagesFor(starterStyleFor(styleCode)) ? 0.52 : 0.26;
}

async function createReferenceGuide(styleCode: string, role: PageRole) {
  const style = starterStyleFor(styleCode);
  const referenceImages = referenceImagesFor(style);
  const referenceUrl = referenceImages?.[role];
  if (referenceUrl) {
    const reference = (await FabricImage.fromURL(
      referenceUrl,
    )) as EditableObject;
    const referenceScale = Math.max(
      DISPLAY_WIDTH / (reference.width || 1),
      DISPLAY_HEIGHT / (reference.height || 1),
    );
    reference.set({
      evented: false,
      excludeFromExport: true,
      left: 0,
      opacity: referenceOpacityFor(styleCode),
      originX: "left",
      originY: "top",
      scaleX: referenceScale,
      scaleY: referenceScale,
      selectable: false,
      top: 0,
    });
    reference.data = {
      id: `reference-${style}-${role}`,
      role: "reference_underlay",
    };
    return reference;
  }
  const objects: FabricObject[] = [];
  const addRect = (options: ConstructorParameters<typeof Rect>[0]) =>
    objects.push(new Rect(options));
  const addLabel = (
    text: string,
    options: ConstructorParameters<typeof Textbox>[1],
  ) => objects.push(new Textbox(text, options));

  if (style === "ranking_review") {
    if (role === "cover") {
      addRect({ fill: "#262321", height: 540, left: 0, top: 0, width: 432 });
      addRect({ fill: "#5a5049", height: 350, left: 0, top: 0, width: 432 });
      addRect({ fill: "#050505", height: 58, left: 22, top: 356, width: 388 });
      addRect({ fill: "#050505", height: 30, left: 22, top: 420, width: 330 });
    } else {
      addRect({ fill: "#ddd8d1", height: 303, left: 0, top: 0, width: 432 });
      addRect({ fill: "#fbfaf7", height: 237, left: 0, top: 303, width: 432 });
      addRect({ fill: "#161616", height: 152, left: 26, top: 342, width: 2 });
      if (role === "comparison") {
        addRect({
          fill: "#ece8e2",
          height: 122,
          left: 52,
          top: 343,
          width: 150,
        });
        addRect({
          fill: "#ece8e2",
          height: 122,
          left: 230,
          top: 343,
          width: 150,
        });
      }
    }
  } else if (style === "editorial_office_flash") {
    addRect({ fill: "#e8e9e5", height: 540, left: 0, top: 0, width: 432 });
    addRect({
      fill: "#f7f7f3",
      height: role === "end" ? 492 : 420,
      left: 0,
      top: 0,
      width: 432,
    });
    addRect({
      fill: "#205ed4",
      height: role === "cover" ? 188 : 96,
      left: 0,
      top: role === "cover" ? 352 : 444,
      width: 432,
    });
    if (role === "cover") {
      addRect({ fill: "#d0d3d0", height: 300, left: 54, top: 36, width: 324 });
    } else if (role === "end") {
      [0, 1, 2, 3, 4, 5].forEach((index) =>
        addRect({
          fill: "#dadbd7",
          height: 126,
          left: 42 + (index % 3) * 120,
          top: 92 + Math.floor(index / 3) * 150,
          width: 100,
        }),
      );
    } else {
      addRect({
        fill: "#d4d5d2",
        height: 330,
        left: role === "split" ? 170 : 94,
        top: 66,
        width: role === "split" ? 224 : 244,
      });
      addRect({
        fill: "rgba(204,226,255,.88)",
        height: 48,
        left: 28,
        top: role === "feature" ? 338 : 370,
        width: 376,
      });
    }
  } else if (style === "product_focus") {
    addRect({ fill: "#f7f3ed", height: 540, left: 0, top: 0, width: 432 });
    addRect({
      fill: "#ead8d4",
      height: role === "cover" ? 248 : 214,
      left: role === "split" ? 198 : 74,
      rx: 70,
      ry: 70,
      top: role === "cover" ? 210 : 188,
      width: role === "split" ? 210 : 322,
    });
    addRect({
      fill: "#fffdfa",
      height: role === "cover" ? 224 : 190,
      left: role === "split" ? 218 : 94,
      rx: 10,
      ry: 10,
      stroke: "#c9a9a5",
      strokeWidth: 2,
      top: role === "cover" ? 222 : 200,
      width: role === "split" ? 170 : 282,
    });
    addRect({ fill: "#bc8f88", height: 5, left: 30, top: 108, width: 54 });
  } else {
    addRect({ fill: "#ebe7df", height: 540, left: 0, top: 0, width: 432 });
    addRect({ fill: "#d9d3ca", height: 260, left: 55, top: 150, width: 322 });
  }

  addLabel(referenceName(style), {
    fill: style === "editorial_office_flash" ? "#1557d6" : "#7d6d68",
    fontFamily: "Arial, sans-serif",
    fontSize: 10,
    fontWeight: 700,
    left: 14,
    top: 12,
    width: 350,
  });
  addLabel("REFERENCE GUIDE · 只供對照，不會輸出", {
    fill: "#7b7480",
    fontFamily: "Arial, sans-serif",
    fontSize: 8,
    fontWeight: 700,
    left: 214,
    textAlign: "right",
    top: 518,
    width: 204,
  });

  const guide = attachData(
    new Group(objects, {
      evented: false,
      excludeFromExport: true,
      left: 0,
      opacity: 0.26,
      selectable: false,
      top: 0,
    }) as EditableObject,
    "reference_underlay",
  );
  guide.data = { id: `reference-${style}-${role}`, role: "reference_underlay" };
  return guide;
}

async function ensureReferenceGuide(
  canvas: Canvas,
  styleCode: string,
  role: PageRole,
) {
  const existing = canvas
    .getObjects()
    .filter(
      (object) =>
        (object as EditableObject).data?.role === "reference_underlay",
    );
  existing.forEach((object) => canvas.remove(object));
  const guide = await createReferenceGuide(styleCode, role);
  canvas.add(guide);
  canvas.sendObjectToBack(guide);
  return guide;
}

async function addStarterObjects(
  canvas: Canvas,
  role: PageRole,
  styleCode: string,
  pageIndex = 0,
  pageCount = 6,
) {
  const copy = placeholderFor(role);
  const style = starterStyleFor(styleCode);
  if (style === "single_photo_news_card" && role === "single") {
    await addSinglePhotoNewsCardStarter(canvas);
    return;
  }
  canvas.clear();
  canvas.backgroundColor =
    style === "ranking_review" && role === "cover"
      ? "#262321"
      : style === "editorial_office_flash"
        ? "#E8E9E5"
        : style === "product_focus"
          ? "#F7F3ED"
          : style === "moody_lifestyle_quiz"
            ? "#4A413B"
            : "#F4F0E8";
  const reference = await createReferenceGuide(styleCode, role);

  const isRankingCover = style === "ranking_review" && role === "cover";
  const isRankingBody = style === "ranking_review" && role !== "cover";
  const isEditorial = style === "editorial_office_flash";
  const isProduct = style === "product_focus";
  const isMoody = style === "moody_lifestyle_quiz";
  const isClassical = style === "classical_culture_remix";
  const isQuietResearch = style === "quiet_research_editorial";

  const accent = attachData(
    new Rect({
      fill: isMoody
        ? "#E8E1D8"
        : isClassical
          ? "#F3E9D8"
          : isQuietResearch
            ? "#D7C3A6"
            : isEditorial
              ? "#1557D6"
              : isProduct
                ? "#B7837B"
                : role === "comparison"
                  ? "#E24B35"
                  : "#3159C6",
      height: isRankingBody ? 2 : role === "cover" ? 12 : 8,
      left: 30,
      rx: 4,
      ry: 4,
      top: isRankingBody ? 332 : 30,
      width: role === "cover" ? 150 : 92,
    }) as EditableObject,
    "accent",
  );
  const eyebrow = attachData(
    new Textbox(copy.eyebrow, {
      fill:
        isMoody || isClassical || isQuietResearch
          ? "#FFFFFF"
          : isRankingCover
            ? "#F3C83E"
            : isEditorial
              ? "#1557D6"
              : isProduct
                ? "#8F625C"
                : "#3159C6",
      fontFamily: "Arial, sans-serif",
      fontSize: 13,
      fontWeight: 700,
      left: 30,
      letterSpacing: 60,
      top: isRankingBody ? 326 : 58,
      width: 360,
    }) as EditableObject,
    "eyebrow",
  );
  const title = attachData(
    new Textbox(copy.title, {
      fill:
        isMoody || isClassical || isQuietResearch
          ? "#FFFFFF"
          : isRankingCover
            ? "#FFFFFF"
            : "#171717",
      fontFamily:
        isMoody || isClassical || isQuietResearch
          ? "Georgia, serif"
          : "Arial, sans-serif",
      fontSize:
        isMoody || isClassical || isQuietResearch
          ? role === "cover"
            ? 32
            : 31
          : role === "cover"
            ? 46
            : 38,
      fontWeight: 800,
      left: isRankingCover ? 24 : 30,
      lineHeight: 1.02,
      splitByGrapheme: true,
      top: isMoody
        ? role === "cover"
          ? 360
          : role === "end"
            ? 222
            : 84
        : isRankingCover
          ? 362
          : isRankingBody
            ? 344
            : isEditorial && role !== "cover"
              ? 376
              : role === "cover"
                ? 270
                : 115,
      width: isRankingCover ? 382 : 370,
    }) as EditableObject,
    "headline",
  );
  const body = attachData(
    new Textbox(copy.body, {
      fill:
        isMoody || isClassical || isQuietResearch
          ? "#FFFFFF"
          : isRankingCover
            ? "#FFFFFF"
            : isEditorial && role === "cover"
              ? "#FFFFFF"
              : "#303030",
      fontFamily:
        isMoody || isClassical || isQuietResearch
          ? "Georgia, serif"
          : "Arial, sans-serif",
      fontSize:
        isMoody || isClassical || isQuietResearch
          ? role === "split"
            ? 15
            : 17
          : role === "comparison"
            ? 25
            : isRankingBody
              ? 17
              : 20,
      fontWeight: 400,
      left: isRankingBody ? 48 : 30,
      lineHeight: 1.35,
      splitByGrapheme: true,
      textAlign:
        isMoody && role !== "cover"
          ? "center"
          : role === "comparison"
            ? "center"
            : "left",
      top: isMoody
        ? role === "cover"
          ? 424
          : role === "end"
            ? 300
            : role === "split"
              ? 236
              : 210
        : isRankingCover
          ? 448
          : isRankingBody
            ? 405
            : isEditorial && role !== "cover"
              ? 438
              : role === "cover"
                ? 405
                : 245,
      width: isMoody && role !== "cover" ? 344 : isRankingBody ? 338 : 370,
    }) as EditableObject,
    "body",
  );
  const page = attachData(
    new Textbox(`${pageIndex + 1}/${pageCount}`, {
      fill:
        isMoody ||
        isClassical ||
        isQuietResearch ||
        isRankingCover ||
        (isEditorial && role === "cover")
          ? "#FFFFFF"
          : "#646464",
      fontFamily: "Arial, sans-serif",
      fontSize: 11,
      left: 362,
      top: 508,
      width: 42,
    }) as EditableObject,
    "page_number",
  );

  canvas.add(
    reference,
    accent,
    eyebrow,
    title,
    body,
    page,
    createBrandLogoSlot(role),
  );
  canvas.sendObjectToBack(reference);
  canvas.renderAll();
}

function objectType(object: FabricObject | null) {
  if (!object) return "";
  if (object instanceof Textbox) return "文字";
  if (object instanceof FabricImage) return "圖片";
  return "形狀";
}

export function TemplateMasterEditor({
  draftId,
  styleCode,
}: {
  draftId: string;
  styleCode: string;
}) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const loadingCanvasRef = useRef(false);
  const restoringHistoryRef = useRef(false);
  const historyRef = useRef<Partial<Record<PageRole, string[]>>>({});
  const savedSnapshotRef = useRef<Partial<Record<PageRole, string>>>({});
  const roleRef = useRef<PageRole>("cover");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [master, setMaster] = useState<MasterPayload | null>(null);
  const [role, setRole] = useState<PageRole>("cover");
  const [selected, setSelected] = useState<EditableObject | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [historyDepth, setHistoryDepth] = useState(0);
  const [referenceVisible, setReferenceVisible] = useState(true);
  const [, redrawInspector] = useState(0);

  const pageRoles = useMemo(() => {
    const declared = templatePageRoles(master?.baseVersion?.contract);
    if (!declared.length) return LEGACY_PAGE_ROLES.map((item) => ({ ...item }));
    return declared.map((item) => ({
      code: item.role,
      label: `${item.position} ${humaniseRole(item.role)}`,
      hint: item.purpose || humaniseRole(item.role),
    }));
  }, [master?.baseVersion?.contract]);

  const completed = useMemo(
    () => pageRoles.filter(({ code }) => master?.draft.pageDesigns?.[code]).length,
    [master, pageRoles],
  );

  function serialiseHistory(canvas: Canvas) {
    const underlays = canvas
      .getObjects()
      .filter(
        (object) =>
          (object as EditableObject).data?.role === "reference_underlay",
      );
    underlays.forEach((object) => {
      object.excludeFromExport = false;
    });
    const snapshot = JSON.stringify(
      canvas.toObject(["data", "excludeFromExport"]),
    );
    underlays.forEach((object) => {
      object.excludeFromExport = true;
    });
    return snapshot;
  }

  const recordHistory = useCallback((canvas: Canvas) => {
    if (loadingCanvasRef.current || restoringHistoryRef.current) return;
    const currentRole = roleRef.current;
    const snapshot = serialiseHistory(canvas);
    const stack = historyRef.current[currentRole] ?? [];
    if (stack.at(-1) === snapshot) return;
    const next = [...stack, snapshot].slice(-50);
    historyRef.current[currentRole] = next;
    setHistoryDepth(next.length);
    setDirty(snapshot !== savedSnapshotRef.current[currentRole]);
  }, []);

  const undoCanvas = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const currentRole = roleRef.current;
    const stack = historyRef.current[currentRole] ?? [];
    if (stack.length <= 1 || restoringHistoryRef.current) return;
    stack.pop();
    const previous = stack.at(-1);
    if (!previous) return;
    restoringHistoryRef.current = true;
    setSelected(null);
    try {
      await canvas.loadFromJSON(JSON.parse(previous));
      canvas.getObjects().forEach((object) => {
        if ((object as EditableObject).data?.role === "reference_underlay")
          object.excludeFromExport = true;
      });
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      historyRef.current[currentRole] = stack;
      setHistoryDepth(stack.length);
      setDirty(previous !== savedSnapshotRef.current[currentRole]);
      setMessage("已復原上一步。");
    } finally {
      restoringHistoryRef.current = false;
    }
  }, []);

  const loadMaster = useCallback(async () => {
    setLoading(true);
    setMessage("");
    if (!draftId) {
      setMessage("缺少 Template draft ID，請由內容風格頁重新開啟。");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/content-directions/template-drafts/${encodeURIComponent(draftId)}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMaster(null);
        setMessage(payload.error || "未能載入標準母版，請稍後再試。");
        return;
      }
      setMaster(payload);
    } catch {
      setMaster(null);
      setMessage("暫時未能連接 SOON Core，請檢查網絡後重新載入。");
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    void loadMaster();
  }, [loadMaster]);

  useEffect(() => {
    if (pageRoles.length && !pageRoles.some((item) => item.code === role)) {
      setRole(pageRoles[0].code);
    }
  }, [pageRoles, role]);

  useEffect(() => {
    if (!canvasElementRef.current || fabricRef.current) return;
    const canvas = new Canvas(canvasElementRef.current, {
      backgroundColor: "#F4F0E8",
      height: DISPLAY_HEIGHT,
      preserveObjectStacking: true,
      selection: true,
      width: DISPLAY_WIDTH,
    });
    fabricRef.current = canvas;
    const select = () => {
      setSelected(
        (canvas.getActiveObject() as EditableObject | undefined) || null,
      );
      redrawInspector((value) => value + 1);
    };
    const changed = () => {
      recordHistory(canvas);
      redrawInspector((value) => value + 1);
    };
    canvas.on("selection:created", select);
    canvas.on("selection:updated", select);
    canvas.on("selection:cleared", () => setSelected(null));
    canvas.on("object:modified", changed);
    canvas.on("object:added", changed);
    canvas.on("object:removed", changed);
    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [loading, recordHistory]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !master || !pageRoles.some((item) => item.code === role)) return;
    let cancelled = false;
    void (async () => {
      loadingCanvasRef.current = true;
      roleRef.current = role;
      setSelected(null);
      const saved = master.draft.pageDesigns?.[role]?.canvasJson;
      const publishedDesigns = master.baseVersion?.contract?.master_designs as
        Partial<Record<PageRole, PageDesign>> | undefined;
      const published = publishedDesigns?.[role]?.canvasJson;
      const existingDesign = saved ?? published;
      const brandBindings = master.baseVersion?.contract?.brand_bindings;
      const requiresBrandLogo = Boolean(
        brandBindings && typeof brandBindings === "object" && !Array.isArray(brandBindings)
          && (brandBindings as Record<string, unknown>).logo,
      );
      let needsSave = false;
      let savedSnapshot = "";
      if (existingDesign) {
        await canvas.loadFromJSON(existingDesign);
        if (cancelled) return;
        await ensureReferenceGuide(canvas, master.style.code, role);
        if (cancelled) return;
        savedSnapshot = serialiseHistory(canvas);
        needsSave = requiresBrandLogo ? ensureBrandLogoSlot(canvas, role) : false;
        canvas.renderAll();
      } else {
        await addStarterObjects(canvas, role, master.style.code, pageRoles.findIndex((item) => item.code === role), pageRoles.length);
        if (cancelled) return;
        needsSave = true;
      }
      setReferenceVisible(true);
      loadingCanvasRef.current = false;
      const initialSnapshot = serialiseHistory(canvas);
      historyRef.current[role] = [initialSnapshot];
      savedSnapshotRef.current[role] = savedSnapshot;
      setHistoryDepth(1);
      setDirty(needsSave);
      if (needsSave && existingDesign)
        setMessage(
          `${pageRoles.find((item) => item.code === role)?.label} 已補上品牌 Logo 位置，請儲存此頁。`,
        );
    })();
    return () => {
      cancelled = true;
    };
  }, [master, pageRoles, role]);

  function toggleReferenceGuide() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const nextVisible = !referenceVisible;
    canvas.getObjects().forEach((object) => {
      if ((object as EditableObject).data?.role === "reference_underlay") {
        object.set({
          opacity: nextVisible
            ? referenceOpacityFor(master?.style.code || "")
            : 0,
        });
      }
    });
    canvas.requestRenderAll();
    setReferenceVisible(nextVisible);
  }

  function chooseRole(next: PageRole) {
    if (next === role) return;
    if (dirty && !window.confirm("目前標準頁有未儲存修改，仍然切換頁面？"))
      return;
    setRole(next);
    setMessage("");
  }

  function addText() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const object = attachData(
      new Textbox("{{new_text}}", {
        fill: "#171717",
        fontFamily: "Arial, sans-serif",
        fontSize: 30,
        fontWeight: 700,
        left: 76,
        splitByGrapheme: true,
        top: 190,
        width: 280,
      }) as EditableObject,
      "custom_text",
    );
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.renderAll();
    setSelected(object);
  }

  function addBox() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const object = attachData(
      new Rect({
        fill: "#3159C6",
        height: 92,
        left: 91,
        opacity: 0.9,
        rx: 10,
        ry: 10,
        top: 205,
        width: 250,
      }) as EditableObject,
      "highlight_box",
    );
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.renderAll();
    setSelected(object);
  }

  async function addImageFile(file: File) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/content-directions/upload", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url)
        throw new Error(payload.error || "未能上載圖片");
      const image = (await FabricImage.fromURL(payload.url, {
        crossOrigin: "anonymous",
      })) as EditableObject;
      const scale = Math.min(
        330 / (image.width || 1),
        330 / (image.height || 1),
      );
      image.set({ left: 51, top: 100, scaleX: scale, scaleY: scale });
      attachData(image, "image");
      canvas.add(image);
      canvas.setActiveObject(image);
      canvas.renderAll();
      setSelected(image);
      setMessage("圖片已加入畫布。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "未能加入圖片");
    } finally {
      setUploading(false);
    }
  }

  function updateSelected(values: Record<string, unknown>) {
    const canvas = fabricRef.current;
    if (!canvas || !selected) return;
    selected.set(values);
    if (selected instanceof Textbox) selected.initDimensions();
    selected.setCoords();
    canvas.requestRenderAll();
    recordHistory(canvas);
    redrawInspector((value) => value + 1);
  }

  function removeSelected() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    const objects =
      activeObjects.length > 0 ? activeObjects : selected ? [selected] : [];
    if (objects.length === 0) return;
    if (
      objects.some(
        (object) => (object as EditableObject).data?.role === "brand_logo",
      )
    ) {
      setMessage("每張標準頁均須保留品牌標誌位置；你可以移動或縮放該標誌。");
      return;
    }
    loadingCanvasRef.current = true;
    canvas.remove(...objects);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    loadingCanvasRef.current = false;
    setSelected(null);
    recordHistory(canvas);
    setMessage(
      objects.length > 1 ? `已刪除 ${objects.length} 個元素。` : "已刪除元素。",
    );
  }

  function moveSelectedLayer(direction: "forward" | "backward") {
    const canvas = fabricRef.current;
    if (!canvas || !selected) return;
    if (direction === "forward") canvas.bringObjectForward(selected);
    else canvas.sendObjectBackwards(selected);
    canvas.requestRenderAll();
    recordHistory(canvas);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isFormField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);
      const active = fabricRef.current?.getActiveObject();
      const isEditingCanvasText = active instanceof Textbox && active.isEditing;
      if (isFormField || isEditingCanvasText) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        void undoCanvas();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!active) return;
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoCanvas, selected]);

  async function savePage() {
    const canvas = fabricRef.current;
    if (!canvas || !master || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const canvasJson = canvas.toObject(["data"]) as Record<string, unknown>;
      const response = await fetch(
        `/api/content-directions/template-drafts/${encodeURIComponent(master.draft.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pageRole: role,
            canvasJson,
            canvasWidth: OUTPUT_WIDTH,
            canvasHeight: OUTPUT_HEIGHT,
            coordinateWidth: DISPLAY_WIDTH,
            coordinateHeight: DISPLAY_HEIGHT,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "未能儲存標準頁");
      setMaster((current) =>
        current
          ? {
              ...current,
              draft: {
                ...current.draft,
                status: payload.draft.status,
                pageDesigns: payload.draft.page_designs,
                updatedAt: payload.draft.updated_at,
              },
            }
          : current,
      );
      setDirty(false);
      const snapshot = serialiseHistory(canvas);
      savedSnapshotRef.current[role] = snapshot;
      setMessage(
        `${pageRoles.find((item) => item.code === role)?.label} 已儲存到 v${master.draft.targetVersion} 草稿。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "未能儲存標準頁");
    } finally {
      setSaving(false);
    }
  }

  function downloadPng() {
    const canvas = fabricRef.current;
    if (!canvas || !master) return;

    const activeObject = canvas.getActiveObject();
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    const dataUrl = canvas.toDataURL({
      enableRetinaScaling: false,
      format: "png",
      multiplier: OUTPUT_WIDTH / DISPLAY_WIDTH,
      quality: 1,
    });
    if (activeObject) canvas.setActiveObject(activeObject);
    canvas.requestRenderAll();

    const link = document.createElement("a");
    link.download = `${master.style.code}-${role}-v${master.draft.targetVersion}.png`;
    link.href = dataUrl;
    link.click();
    setMessage(
      `${pageRoles.find((item) => item.code === role)?.label} 已輸出 ${OUTPUT_WIDTH} × ${OUTPUT_HEIGHT} PNG。`,
    );
  }

  if (loading)
    return (
      <MasterEditorState loading message="正在載入 Style、版本及標準頁…" />
    );
  if (!master)
    return (
      <MasterEditorState
        message={message || "找不到母版草稿。"}
        onRetry={draftId ? () => void loadMaster() : undefined}
      />
    );

  const selectedFill =
    typeof selected?.fill === "string" ? selected.fill : "#171717";
  const selectedOpacity = Math.round((selected?.opacity ?? 1) * 100);
  const currentPage = pageRoles.find((item) => item.code === role) || pageRoles[0];

  return (
    <main className="master-editor">
      <header className="master-topbar">
        <div>
          <Link href="/content-directions">← 返回內容風格</Link>
          <small>SOON CORE · 文件母版</small>
          <h1>
            {master.style.name} <span>v{master.draft.targetVersion}</span>
          </h1>
        </div>
        <div className="master-progress">
          <strong>{completed}/{pageRoles.length}</strong>
          <span>標準頁已完成</span>
          <i>
            {dirty
              ? "有未儲存修改"
              : master.draft.status === "review"
                ? "草稿可供審閱"
                : "草稿"}
          </i>
        </div>
      </header>

      {message ? <div className="master-notice">{message}</div> : null}

      <div className="master-workspace">
        <aside className="master-pages">
          <small>頁面用途</small>
          {pageRoles.map((page) => (
            <button
              className={page.code === role ? "active" : ""}
              key={page.code}
              onClick={() => chooseRole(page.code)}
              type="button"
            >
              <span>{page.label}</span>
              <small>{page.hint}</small>
              <b>{master.draft.pageDesigns?.[page.code] ? "✓" : "—"}</b>
            </button>
          ))}
        </aside>

        <section className="master-stage">
          <div className="master-toolbar">
            <div>
              <button onClick={addText} type="button">
                ＋ 文字
              </button>
              <button onClick={addBox} type="button">
                ＋ 色塊
              </button>
              <button
                disabled={uploading}
                onClick={() => imageInputRef.current?.click()}
                type="button"
              >
                {uploading ? "上載中…" : "＋ 圖片"}
              </button>
              <input
                ref={imageInputRef}
                hidden
                accept="image/png,image/jpeg,image/webp"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void addImageFile(file);
                  event.target.value = "";
                }}
              />
            </div>
            <div>
              <button onClick={downloadPng} type="button">
                下載 PNG
              </button>
              <button
                className="reference"
                onClick={toggleReferenceGuide}
                type="button"
              >
                {referenceVisible ? "隱藏參考" : "顯示參考"}
              </button>
              <button
                disabled={historyDepth <= 1}
                onClick={() => void undoCanvas()}
                type="button"
              >
                復原 ⌘Z
              </button>
              <button
                disabled={!selected}
                onClick={() => moveSelectedLayer("forward")}
                type="button"
              >
                上一層
              </button>
              <button
                disabled={!selected}
                onClick={() => moveSelectedLayer("backward")}
                type="button"
              >
                下一層
              </button>
              <button
                className="danger"
                disabled={!selected}
                onClick={removeSelected}
                type="button"
              >
                刪除
              </button>
            </div>
          </div>
          <div className="master-canvas-wrap">
            <div className="master-reference-note">
              <b>{referenceName(starterStyleFor(master.style.code))}</b>
              <span>參考層只供對照，不會儲存或輸出</span>
            </div>
            <div className="master-canvas-label">
              <b>{currentPage.label}</b>
              <span>1080 × 1350 · 4:5</span>
            </div>
            <div className="master-canvas-shell">
              <canvas ref={canvasElementRef} />
            </div>
            <p>拖曳移動；拉動控制點縮放及旋轉；雙擊文字直接修改。</p>
          </div>
        </section>

        <aside className="master-inspector">
          <small>屬性設定</small>
          {selected ? (
            <>
              <h2>{objectType(selected)}</h2>
              <label>
                用途
                <input
                  disabled={selected.data?.role === "brand_logo"}
                  value={selected.data?.role || ""}
                  onChange={(event) => {
                    selected.data = {
                      ...(selected.data || {}),
                      role: event.target.value,
                    };
                    setDirty(true);
                    redrawInspector((value) => value + 1);
                  }}
                />
              </label>
              {selected.data?.role === "brand_logo" ? (
                <p className="logo-binding-note">
                  輸出時會自動使用工作區標誌；如未有標誌，則使用母版預設圖片。
                </p>
              ) : null}
              {selected instanceof Textbox ? (
                <>
                  <label>
                    文字
                    <textarea
                      rows={5}
                      value={selected.text || ""}
                      onChange={(event) =>
                        updateSelected({ text: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    字體
                    <select
                      value={String(selected.fontFamily || "Arial, sans-serif")}
                      onChange={(event) =>
                        updateSelected({ fontFamily: event.target.value })
                      }
                    >
                      <option value="Arial, sans-serif">系統黑體</option>
                      <option value="Georgia, serif">明體／Serif</option>
                      <option value="SweiGothicCJKtc-Regular">獅尾黑體</option>
                      <option value="GenSenRounded2">圓體</option>
                    </select>
                  </label>
                  <div className="inspector-grid">
                    <label>
                      字號
                      <input
                        min="8"
                        max="120"
                        type="number"
                        value={Math.round(Number(selected.fontSize || 24))}
                        onChange={(event) =>
                          updateSelected({
                            fontSize: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      字重
                      <select
                        value={String(selected.fontWeight || 400)}
                        onChange={(event) =>
                          updateSelected({
                            fontWeight: Number(event.target.value),
                          })
                        }
                      >
                        <option value="400">標準</option>
                        <option value="600">半粗體</option>
                        <option value="700">粗體</option>
                        <option value="800">特粗體</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    對齊
                    <select
                      value={String(selected.textAlign || "left")}
                      onChange={(event) =>
                        updateSelected({ textAlign: event.target.value })
                      }
                    >
                      <option value="left">左</option>
                      <option value="center">中</option>
                      <option value="right">右</option>
                    </select>
                  </label>
                </>
              ) : null}
              {!(selected instanceof FabricImage) ? (
                <label>
                  顏色
                  <div className="color-control">
                    <input
                      type="color"
                      value={selectedFill}
                      onChange={(event) =>
                        updateSelected({ fill: event.target.value })
                      }
                    />
                    <input
                      value={selectedFill}
                      onChange={(event) =>
                        updateSelected({ fill: event.target.value })
                      }
                    />
                  </div>
                </label>
              ) : null}
              <label>
                透明度 <b>{selectedOpacity}%</b>
                <input
                  min="10"
                  max="100"
                  type="range"
                  value={selectedOpacity}
                  onChange={(event) =>
                    updateSelected({
                      opacity: Number(event.target.value) / 100,
                    })
                  }
                />
              </label>
            </>
          ) : (
            <div className="inspector-empty">
              <b>選擇畫布元素</b>
              <p>點擊文字、圖片或色塊後，可在這裡調整內容與樣式。</p>
            </div>
          )}
          <div className="master-save">
            <button
              disabled={saving || !dirty}
              onClick={() => void savePage()}
              type="button"
            >
              {saving ? "正在儲存…" : `儲存 ${currentPage.label}`}
            </button>
            <p>
              儲存只更新 v{master.draft.targetVersion} 草稿，不會覆蓋已發布 v
              {master.baseVersion?.number || 1}。
            </p>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .master-editor {
          min-height: 100vh;
          background: #0b0b0d;
          color: #f6f3f8;
          padding: 24px 28px 40px;
        }
        .master-topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          max-width: 1500px;
          margin: 0 auto 18px;
        }
        .master-topbar a {
          display: block;
          margin-bottom: 18px;
          color: #a78bfa;
          font-size: 12px;
          text-decoration: none;
        }
        .master-topbar small,
        .master-pages > small,
        .master-inspector > small {
          color: #a78bfa;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.16em;
        }
        .master-topbar h1 {
          margin: 6px 0 0;
          font-size: 28px;
        }
        .master-topbar h1 span {
          color: #a78bfa;
        }
        .master-progress {
          display: grid;
          grid-template-columns: auto auto;
          gap: 2px 10px;
          align-items: center;
          border: 1px solid #332742;
          border-radius: 12px;
          background: #16131b;
          padding: 12px 16px;
        }
        .master-progress strong {
          grid-row: span 2;
          font-size: 25px;
        }
        .master-progress span {
          color: #aaa;
          font-size: 10px;
        }
        .master-progress i {
          color: #c4b5fd;
          font-size: 9px;
          font-style: normal;
        }
        .master-notice {
          max-width: 1500px;
          margin: 0 auto 14px;
          border: 1px solid #4c3764;
          border-radius: 10px;
          background: #21182b;
          padding: 10px 14px;
          color: #ddd0ee;
          font-size: 11px;
        }
        .master-workspace {
          display: grid;
          grid-template-columns: 190px minmax(520px, 1fr) 270px;
          max-width: 1500px;
          min-height: 720px;
          margin: auto;
          border: 1px solid #27242b;
          border-radius: 16px;
          background: #121115;
          overflow: hidden;
        }
        .master-pages {
          display: grid;
          align-content: start;
          gap: 8px;
          border-right: 1px solid #29252e;
          padding: 18px 12px;
        }
        .master-pages > small {
          margin: 0 8px 6px;
        }
        .master-pages button {
          position: relative;
          display: grid;
          gap: 4px;
          border: 1px solid #2d2931;
          border-radius: 10px;
          background: #19171c;
          color: #ddd;
          padding: 12px 30px 12px 12px;
          text-align: left;
        }
        .master-pages button.active {
          border-color: #8b5cf6;
          background: #281c39;
        }
        .master-pages button span {
          font-size: 11px;
          font-weight: 800;
        }
        .master-pages button small {
          color: #777;
          font-size: 9px;
        }
        .master-pages button b {
          position: absolute;
          right: 11px;
          top: 50%;
          color: #a78bfa;
          transform: translateY(-50%);
        }
        .master-stage {
          min-width: 0;
          background: #17151a;
        }
        .master-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid #2b2830;
          background: #111014;
          padding: 10px 14px;
        }
        .master-toolbar > div {
          display: flex;
          gap: 6px;
        }
        .master-toolbar button {
          border: 1px solid #37323d;
          border-radius: 7px;
          background: #211e25;
          color: #ddd;
          padding: 8px 10px;
          font-size: 9px;
        }
        .master-toolbar button:disabled {
          opacity: 0.35;
        }
        .master-toolbar .reference {
          border-color: #65449a;
          color: #c4b5fd;
        }
        .master-toolbar .danger {
          color: #fda4af;
        }
        .master-canvas-wrap {
          display: grid;
          place-items: center;
          padding: 16px 20px 20px;
        }
        .master-reference-note {
          display: flex;
          justify-content: space-between;
          width: 432px;
          margin: 0 0 8px;
          border: 1px solid #40364f;
          border-radius: 7px;
          background: #201a29;
          padding: 7px 9px;
          color: #928a99;
          font-size: 8px;
        }
        .master-reference-note b {
          color: #c4b5fd;
        }
        .master-canvas-label {
          display: flex;
          justify-content: space-between;
          width: 432px;
          margin-bottom: 8px;
          color: #8f8994;
          font-size: 9px;
        }
        .master-canvas-label b {
          color: #d8d3dc;
        }
        .master-canvas-shell {
          box-shadow: 0 22px 55px rgba(0, 0, 0, 0.45);
          line-height: 0;
        }
        .master-canvas-wrap > p {
          margin: 12px 0 0;
          color: #777;
          font-size: 9px;
        }
        .master-inspector {
          position: relative;
          border-left: 1px solid #29252e;
          background: #131217;
          padding: 18px 16px;
        }
        .master-inspector h2 {
          margin: 9px 0 18px;
          font-size: 18px;
        }
        .master-inspector label {
          display: grid;
          gap: 6px;
          margin-bottom: 13px;
          color: #999;
          font-size: 9px;
        }
        .master-inspector label > b {
          color: #ddd;
        }
        .master-inspector input,
        .master-inspector textarea,
        .master-inspector select {
          width: 100%;
          border: 1px solid #34303a;
          border-radius: 7px;
          background: #1c1920;
          color: #eee;
          padding: 8px;
          font: inherit;
          outline: none;
        }
        .master-inspector input:disabled {
          color: #a78bfa;
          opacity: 0.8;
        }
        .master-inspector textarea {
          font-size: 11px;
          resize: vertical;
        }
        .master-inspector input:focus,
        .master-inspector textarea:focus,
        .master-inspector select:focus {
          border-color: #8b5cf6;
        }
        .logo-binding-note {
          margin: -4px 0 13px;
          border: 1px solid #312842;
          border-radius: 7px;
          background: #1d1726;
          padding: 8px;
          color: #a78bfa;
          font-size: 8px;
          line-height: 1.45;
        }
        .inspector-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .color-control {
          display: grid;
          grid-template-columns: 38px 1fr;
          gap: 7px;
        }
        .color-control input[type="color"] {
          height: 34px;
          padding: 3px;
        }
        .inspector-empty {
          margin-top: 18px;
          border: 1px dashed #35313a;
          border-radius: 10px;
          padding: 18px;
          color: #777;
        }
        .inspector-empty b {
          color: #bbb;
          font-size: 11px;
        }
        .inspector-empty p {
          font-size: 9px;
          line-height: 1.5;
        }
        .master-save {
          position: absolute;
          right: 16px;
          bottom: 16px;
          left: 16px;
        }
        .master-save button {
          width: 100%;
          border: 0;
          border-radius: 9px;
          background: #7c3aed;
          color: #fff;
          padding: 11px;
          font-size: 10px;
          font-weight: 850;
        }
        .master-save button:disabled {
          background: #302b35;
          color: #777;
        }
        .master-save p {
          margin: 8px 2px 0;
          color: #6f6974;
          font-size: 8px;
          line-height: 1.45;
        }
        .master-state {
          min-height: 70vh;
          display: grid;
          place-content: center;
          gap: 12px;
          background: #0b0b0d;
          color: #ddd;
          text-align: center;
        }
        .master-state a {
          color: #a78bfa;
        }
        @media (max-width: 1100px) {
          .master-workspace {
            grid-template-columns: 160px minmax(480px, 1fr);
          }
          .master-inspector {
            grid-column: 1/-1;
            min-height: 310px;
            border-top: 1px solid #29252e;
            border-left: 0;
          }
          .master-save {
            position: static;
            margin-top: 20px;
          }
        }
        @media (max-width: 760px) {
          .master-editor {
            padding: 16px;
          }
          .master-topbar {
            align-items: flex-start;
            flex-direction: column;
          }
          .master-workspace {
            display: block;
          }
          .master-pages {
            grid-template-columns: repeat(2, 1fr);
            border-right: 0;
          }
          .master-stage {
            overflow: auto;
          }
          .master-inspector {
            min-height: 360px;
          }
        }
      `}</style>
    </main>
  );
}
