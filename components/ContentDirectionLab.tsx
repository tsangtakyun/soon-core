"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TemplateCanvasPreview } from "@/components/TemplateCanvasPreview";
import { approvedStylePreview } from "@/lib/approved-style-previews";
import { videoStyleCover } from "@/lib/video-style-covers";

type PublishedStyle = {
  styleId: string;
  code: string;
  format: string;
  name: string;
  description: string;
  version: {
    number: number;
    ref: string;
    publishedAt: string;
    rules: Record<string, unknown>;
  };
  evidence: { confirmedReferenceCount: number };
  templates?: Array<{
    templateId: string;
    version: {
      number: number;
      rendererCode: string;
      contract: Record<string, unknown>;
    };
  }>;
};
type PageDesign = {
  canvasJson?: Record<string, unknown>;
  canvasWidth?: number;
  canvasHeight?: number;
  coordinateWidth?: number;
  coordinateHeight?: number;
};
type PageRole = { role: string; purpose?: string; position?: string };
type MasterDraft = {
  id: string;
  style_id: string;
  target_version: number;
  status: string;
  page_designs: Record<string, PageDesign>;
  updated_at: string;
};
type PublishedReference = {
  id: string;
  style_id: string;
  style_version_id: string | null;
  source_url: string | null;
  source_account: string | null;
  evidence_summary: string;
  extracted_patterns: Record<string, unknown>;
};
type InternalSpecification = {
  code: string;
  name: string;
  description: string;
  format?: "human_short_video" | "ai_short_video";
  styleId: string;
  versionId: string;
  version: number;
  status: "draft" | "review";
  specificationType: "new_direction" | "existing_direction_supplement";
  creatorEligible: boolean;
  contentStudioEnabled: boolean;
  generationEnabled: boolean;
  templateBindingAllowed?: boolean;
  activeBindingCount?: number;
  playableReferenceCount?: number;
  rules: Record<string, unknown>;
};
type RestorationSegment = {
  order?: number;
  start_seconds?: number;
  end_seconds?: number;
  visual_description_zh?: string;
  speech_or_narration_zh?: string | null;
  speech_source?: string;
  on_screen_text_zh?: string | null;
  notes?: string | null;
  verification?: { visual?: string; audio?: string; translation?: string };
};
type VideoReferenceRestoration = {
  id: string;
  styleCode: string;
  styleName: string;
  styleVersionId: string;
  version: number;
  status: string;
  sourceUrl: string;
  referenceKey: string;
  format: "human" | "ai";
  selection: "full_representative" | "fragment_supplement";
  role: string;
  sourceFilename: string;
  durationSeconds: number;
  coverageSeconds: number;
  coveragePercent: number;
  audioTranscriptStatus: string;
  visualStatus: string;
  rightsState: string;
  timeline: RestorationSegment[];
  unverified: string[];
};
type ReconstructionShot = {
  shot_id?: string;
  source_time?: { start_seconds?: number; end_seconds?: number };
  test_duration_seconds?: number;
  prompt_zh?: string;
  composition?: string;
  camera_motion?: string;
  action?: string;
  expression?: string;
  dialogue_or_narration_placeholder_zh?: string;
  audio_post?: string;
  transition_out?: string;
  acceptance_checks?: string[];
};
type AiReconstructionPromptSet = {
  id: string;
  styleCode: string;
  styleName: string;
  styleVersionId: string;
  version: number;
  status: string;
  referenceKey: string;
  displayName: string;
  promptStatus: string;
  sourceDurationSeconds: number;
  shotCount: number;
  shots: ReconstructionShot[];
  unverified: string[];
};
type RegistryFormat =
  | "instagram_carousel"
  | "instagram_single_feed"
  | "human_short_video"
  | "ai_short_video";
const registryFormats: Array<{
  id: RegistryFormat;
  label: string;
  note: string;
}> = [
  {
    id: "instagram_carousel",
    label: "輪播貼文",
    note: "多頁敘事與逐頁版面規格",
  },
  {
    id: "instagram_single_feed",
    label: "單張貼文",
    note: "單一主視覺與訊息層級",
  },
  {
    id: "human_short_video",
    label: "真人短片",
    note: "真人拍攝、旁白與時間軸規格",
  },
  {
    id: "ai_short_video",
    label: "AI 短片",
    note: "AI 畫面、旁白與生成鏡頭規格",
  },
];

const videoStyleFallbacks: Record<string, { icon: string; tone: string }> = {
  on_location_fact_sprint: { icon: "◎", tone: "teal" },
  two_person_misunderstanding_twist: { icon: "↯", tone: "rose" },
  situational_multi_dish_tasting: { icon: "◉", tone: "amber" },
  route_led_city_portrait: { icon: "⌁", tone: "blue" },
  faceless_sensory_food_discovery: { icon: "◌", tone: "earth" },
  problem_first_lifestyle_product: { icon: "＋", tone: "violet" },
  host_led_food_culture_tasting: { icon: "✦", tone: "red" },
  human_product_demo_conversion: { icon: "◇", tone: "lime" },
  seated_host_research_explainer: { icon: "¶", tone: "navy" },
  first_person_journey_diary: { icon: "↗", tone: "sky" },
  multi_stop_city_curation: { icon: "⋮", tone: "plum" },
  spectacle_first_experience_micro: { icon: "⚡", tone: "orange" },
  immersive_experience_reflection: { icon: "◐", tone: "indigo" },
  ai_artist_reflective_monologue: { icon: "✧", tone: "mauve" },
  ai_cinematic_founder_biography: { icon: "▰", tone: "sepia" },
  ai_absurd_twist_microdrama: { icon: "↻", tone: "coral" },
  ai_continuity_ensemble_skit: { icon: "◈", tone: "cyan" },
  ai_host_time_travel_tour: { icon: "⌛", tone: "gold" },
};

function VideoStyleCover({
  code,
  name,
  selected,
  onOpen,
}: {
  code: string;
  name: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const fallback = videoStyleFallbacks[code] ?? { icon: "▶", tone: "violet" };
  const cover = videoStyleCover(code);
  return (
    <button type="button" className={`video-style-cover ${selected ? "selected" : ""}`} onClick={onOpen} aria-label={`查看${name}風格內容`}>
      {cover.asset ? <img src={cover.asset} alt={`${name}代表封面`} loading="lazy" style={{ objectPosition: cover.objectPosition }} /> : (
        <span className={`video-cover-fallback ${fallback.tone}`}>
          <b aria-hidden="true">{fallback.icon}</b>
          <em>{name}</em>
          <small>封面待補</small>
        </span>
      )}
      <span className="video-cover-shade" />
      <span className="video-cover-open">點入查看</span>
    </button>
  );
}
export function ContentDirectionLab() {
  const [styles, setStyles] = useState<PublishedStyle[]>([]);
  const [masterDrafts, setMasterDrafts] = useState<MasterDraft[]>([]);
  const [publishedReferences, setPublishedReferences] = useState<PublishedReference[]>([]);
  const [internalSpecifications, setInternalSpecifications] = useState<InternalSpecification[]>([]);
  const [importingInternalSpecifications, setImportingInternalSpecifications] = useState(false);
  const [restorations, setRestorations] = useState<VideoReferenceRestoration[]>([]);
  const [reconstructionPromptSets, setReconstructionPromptSets] = useState<AiReconstructionPromptSet[]>([]);
  const [importingRestorations, setImportingRestorations] = useState(false);
  const [masterBusy, setMasterBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const loadSequence = useRef(0);
  const [registryFormat, setRegistryFormat] =
    useState<RegistryFormat>("instagram_carousel");
  const [selectedVideoStyleCode, setSelectedVideoStyleCode] = useState("");

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    const internalEndpoint = registryFormat === "human_short_video"
      ? "/api/content-directions/internal-human-video-specifications"
      : registryFormat === "ai_short_video"
        ? "/api/content-directions/internal-ai-video-specifications"
        : "";
    const restorationFormat = registryFormat === "human_short_video" ? "human" : registryFormat === "ai_short_video" ? "ai" : "";
    const [stylesResponse, internalResponse, restorationsResponse] = await Promise.all([
      fetch(
        `/api/content-directions/styles?format=${encodeURIComponent(registryFormat)}`,
        { cache: "no-store" },
      ),
      internalEndpoint
        ? fetch(internalEndpoint, { cache: "no-store" })
        : Promise.resolve(null),
      restorationFormat
        ? fetch(`/api/content-directions/internal-video-reference-restorations?format=${restorationFormat}`, { cache: "no-store" })
        : Promise.resolve(null),
    ]);
    const [stylesPayload, internalPayload, restorationsPayload] = await Promise.all([
      stylesResponse.json().catch(() => ({})),
      internalResponse?.json().catch(() => ({})) ?? Promise.resolve({}),
      restorationsResponse?.json().catch(() => ({})) ?? Promise.resolve({}),
    ]);
    if (sequence !== loadSequence.current) return;
    if (stylesResponse.ok) {
      const published = Array.isArray(stylesPayload.styles)
        ? stylesPayload.styles
        : [];
      setStyles(
        [...published].sort(
          (a, b) =>
            Date.parse(b.version?.publishedAt || "") -
            Date.parse(a.version?.publishedAt || ""),
        ),
      );
      setMasterDrafts(
        Array.isArray(stylesPayload.masterDrafts)
          ? stylesPayload.masterDrafts
          : [],
      );
      setPublishedReferences(Array.isArray(stylesPayload.publishedReferences) ? stylesPayload.publishedReferences : []);
    } else {
      setPublishedReferences([]);
      setMessage(stylesPayload.error || "未能載入已發布內容風格");
    }
    if (internalEndpoint && internalResponse?.ok) {
      setInternalSpecifications(Array.isArray(internalPayload.specifications) ? internalPayload.specifications : []);
    } else setInternalSpecifications([]);
    if (restorationsResponse?.ok) {
      setRestorations(Array.isArray(restorationsPayload.restorations) ? restorationsPayload.restorations : []);
      setReconstructionPromptSets(Array.isArray(restorationsPayload.promptSets) ? restorationsPayload.promptSets : []);
    } else {
      setRestorations([]);
      setReconstructionPromptSets([]);
    }
    setLoading(false);
  }, [registryFormat]);
  useEffect(() => {
    void load();
  }, [load]);
  const visibleStyles = useMemo(
    () => styles.filter((style) => style.format === registryFormat),
    [registryFormat, styles],
  );
  const selectedPublishedStyle = visibleStyles.find((style) => style.code === selectedVideoStyleCode) ?? null;
  const selectedInternalSpecification = internalSpecifications.find((specification) => specification.code === selectedVideoStyleCode) ?? null;
  const newInternalSpecifications = internalSpecifications.filter(
    (specification) => !visibleStyles.some((style) => style.code === specification.code),
  );
  const isVideoRegistry = registryFormat === "human_short_video" || registryFormat === "ai_short_video";
  const visibleStyleCount = visibleStyles.length + (isVideoRegistry ? newInternalSpecifications.length : 0);
  const selectedRestorations = restorations.filter((restoration) => restoration.styleCode === selectedVideoStyleCode);
  const selectedPromptSets = reconstructionPromptSets.filter((promptSet) => promptSet.styleCode === selectedVideoStyleCode);
  const selectedPublishedReferences = selectedPublishedStyle
    ? publishedReferences.filter((reference) => reference.style_id === selectedPublishedStyle.styleId)
    : [];
  const selectedPublishedPreview = selectedPublishedStyle?.version.rules.preview &&
    typeof selectedPublishedStyle.version.rules.preview === "object" &&
    !Array.isArray(selectedPublishedStyle.version.rules.preview)
      ? selectedPublishedStyle.version.rules.preview as { video?: unknown }
      : null;
  const selectedPublishedVideo = typeof selectedPublishedPreview?.video === "string" ? selectedPublishedPreview.video : "";
  async function editMaster(style: PublishedStyle) {
    setMasterBusy(style.code);
    setMessage("");
    const response = await fetch(
      `/api/content-directions/styles/${encodeURIComponent(style.code)}/master-draft`,
      { method: "POST" },
    );
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.editUrl) window.location.href = payload.editUrl;
    else setMessage(payload.error || "未能開啟標準母版編輯器");
    setMasterBusy("");
  }

  async function publishMaster(draft: MasterDraft) {
    setMasterBusy(draft.id);
    setMessage("");
    const response = await fetch(
      `/api/content-directions/template-drafts/${encodeURIComponent(draft.id)}/publish`,
      { method: "POST" },
    );
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage(`Template v${payload.templateVersion} 已發布。`);
      await load();
    } else setMessage(payload.error || "未能發布標準母版");
    setMasterBusy("");
  }

  async function importInternalVideoSpecifications() {
    setImportingInternalSpecifications(true);
    setMessage("");
    const isAiVideo = registryFormat === "ai_short_video";
    const endpoint = isAiVideo
      ? "/api/content-directions/internal-ai-video-specifications"
      : "/api/content-directions/internal-human-video-specifications";
    const response = await fetch(endpoint, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage(`${isAiVideo ? "AI" : "真人"}短片規格已存入 Core 內部審閱層；Creator／Content Studio／生成流程仍未啟用。`);
      await load();
    } else setMessage(payload.error || `未能匯入${isAiVideo ? "AI" : "真人"}短片規格`);
    setImportingInternalSpecifications(false);
  }

  async function importVideoReferenceRestorations() {
    setImportingRestorations(true);
    setMessage("");
    const response = await fetch("/api/content-directions/internal-video-reference-restorations", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage(`原片還原稿已存入 Core：新增 ${payload.insertedCount ?? 0} 項、更新 ${payload.updatedCount ?? 0} 項；重建 Prompt 新增 ${payload.promptSetInsertedCount ?? 0} 組、更新 ${payload.promptSetUpdatedCount ?? 0} 組；音訊人工逐句核實仍為 0。`);
      await load();
    } else setMessage(payload.error || "未能匯入原片還原稿");
    setImportingRestorations(false);
  }

  return (
    <section className="lab">
      <header>
        <div>
          <small>SOON 內容風格</small>
          <h1>選擇內容風格</h1>
          <p>以卡片瀏覽內容風格與參考資料；最近更新的項目會優先顯示。</p>
        </div>
      </header>
      {message ? <div className="notice">{message}</div> : null}
      <section className="published-styles">
        <div className="published-head">
          <div>
            <small>{isVideoRegistry ? "內容風格" : "已發布風格目錄"}</small>
            <h2>{isVideoRegistry ? `${registryFormat === "ai_short_video" ? "AI" : "真人"}內容風格` : "已發布內容風格"}</h2>
            <p>{isVideoRegistry ? "每款風格只顯示一次；點入卡片可查看參考、還原稿及目前接入狀態。" : "Content Studio 會按內容格式讀取相應風格池；新版不會覆蓋已建立項目的規格快照。"}</p>
          </div>
          <strong>{visibleStyleCount} 款</strong>
        </div>
        <div className="registry-format-tabs" aria-label="內容格式">
          {registryFormats.map((format) => (
            <button
              key={format.id}
              type="button"
              className={registryFormat === format.id ? "active" : ""}
              onClick={() => {
                setRegistryFormat(format.id);
                setSelectedVideoStyleCode("");
              }}
            >
              <b>{format.label}</b>
              <span>{format.note}</span>
            </button>
          ))}
        </div>
        {loading ? (
          <p className="empty">正在載入風格…</p>
        ) : visibleStyleCount ? (
          <div className="style-cards">
            {visibleStyles.map((style) => {
              const reviewSpecification = internalSpecifications.find((specification) => specification.code === style.code);
              const draft = masterDrafts.find(
                (item) => item.style_id === style.styleId,
              );
              const template = style.templates?.[0];
              const contract = template?.version.contract || {};
              const publishedDesigns =
                contract.master_designs &&
                typeof contract.master_designs === "object" &&
                !Array.isArray(contract.master_designs)
                  ? (contract.master_designs as Record<string, PageDesign>)
                  : null;
              const pageRoles =
                contract.structure &&
                typeof contract.structure === "object" &&
                !Array.isArray(contract.structure) &&
                Array.isArray((contract.structure as { page_roles?: unknown }).page_roles)
                  ? ((contract.structure as { page_roles: PageRole[] }).page_roles)
                  : [];
              const pageCount = draft
                ? Object.keys(draft.page_designs || {}).length
                : 0;
              const supportsVisualMaster =
                style.format === "instagram_carousel" ||
                style.format === "instagram_single_feed";
              const pageTarget =
                pageRoles.length ||
                (style.format === "instagram_single_feed" ? 1 : 6);
              const legacyImage =
                approvedStylePreview(style.code) ||
                (style.code === "first_person_journey_diary"
                  ? "/templates/first-person-journey-diary-v1/poster.jpg"
                  : null);
              return (
                <article key={style.styleId} className={`style-card ${selectedVideoStyleCode === style.code ? "selected-video-style" : ""}`}>
                  {supportsVisualMaster ? (
                    <TemplateCanvasPreview
                      draftDesigns={draft?.page_designs}
                      draftVersion={draft?.target_version}
                      legacyImage={legacyImage}
                      name={style.name}
                      pageRoles={pageRoles}
                      publishedDesigns={publishedDesigns}
                      publishedVersion={template?.version.number || null}
                    />
                  ) : (
                    <VideoStyleCover
                      code={style.code}
                      name={style.name}
                      selected={selectedVideoStyleCode === style.code}
                      onOpen={() => setSelectedVideoStyleCode(style.code)}
                    />
                  )}
                  <div className="style-copy">
                    <small>{style.format}</small>
                    <h3>{style.name}</h3>
                    <p>{style.description}</p>
                    <div>
                      <span>{style.version.ref}</span>
                      <b>{style.evidence.confirmedReferenceCount} references</b>
                    </div>
                    {supportsVisualMaster ? (
                      <div className="master-actions">
                        <button
                          type="button"
                          disabled={Boolean(masterBusy)}
                          onClick={() => void editMaster(style)}
                        >
                          {masterBusy === style.code
                            ? "開啟中…"
                            : draft
                              ? `繼續編輯 v${draft.target_version}（${pageCount}/${pageTarget}）`
                              : template
                                ? "編輯標準版本"
                                : "建立標準母版"}
                        </button>
                        {draft?.status === "review" ? (
                          <button
                            type="button"
                            className="publish"
                            disabled={Boolean(masterBusy)}
                            onClick={() => void publishMaster(draft)}
                          >
                            {masterBusy === draft.id
                              ? "發布中…"
                              : `發布 v${draft.target_version}`}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        {reviewSpecification ? <small className="review-supplement-status">另有規格增補 v{reviewSpecification.version}</small> : null}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            {isVideoRegistry ? newInternalSpecifications.map((specification) => (
              <article key={specification.versionId} className={`style-card ${selectedVideoStyleCode === specification.code ? "selected-video-style" : ""}`}>
                <VideoStyleCover
                  code={specification.code}
                  name={specification.name}
                  selected={selectedVideoStyleCode === specification.code}
                  onOpen={() => setSelectedVideoStyleCode(specification.code)}
                />
                <div className="style-copy">
                  <small>內容風格 · v{specification.version}</small>
                  <h3>{specification.name}</h3>
                  <p>{specification.description}</p>
                  <div>
                    <span>style:{specification.code}:v{specification.version}</span>
                    <b>點入查看</b>
                  </div>
                </div>
              </article>
            )) : null}
          </div>
        ) : (
          <p className="empty">未有已發布內容風格。</p>
        )}
      </section>
      {isVideoRegistry ? (
        <section className="published-styles internal-specifications">
          {!internalSpecifications.length ? (
            <div className="master-actions">
              <button type="button" disabled={importingInternalSpecifications} onClick={() => void importInternalVideoSpecifications()}>
                {importingInternalSpecifications ? "匯入中…" : `匯入已確認${registryFormat === "ai_short_video" ? "AI" : "真人"}短片規格`}
              </button>
            </div>
          ) : null}
          {selectedVideoStyleCode ? (
            <section className="selected-video-style-detail">
              <div>
                <small>已選風格</small>
                <h3>{selectedInternalSpecification?.name ?? selectedPublishedStyle?.name ?? selectedVideoStyleCode}</h3>
                <p>{selectedInternalSpecification?.description ?? selectedPublishedStyle?.description}</p>
              </div>
              <div className="selected-style-states">
                {selectedPublishedStyle ? <b>已發布 v{selectedPublishedStyle.version.number}</b> : <span>Core 內容風格</span>}
                {selectedInternalSpecification ? <b>規格 v{selectedInternalSpecification.version} · 審閱狀態</b> : null}
                {selectedInternalSpecification ? <span>尚未接入 Content Studio</span> : null}
              </div>
              {internalSpecifications.length ? (
                <div className="restoration-import-action">
                  <button type="button" disabled={importingRestorations} onClick={() => void importVideoReferenceRestorations()}>
                    {importingRestorations ? "同步中…" : restorations.length ? "重新同步原片還原稿" : "匯入原片還原稿"}
                  </button>
                </div>
              ) : null}
              {selectedPublishedVideo ? (
                <div className="selected-published-video">
                  <small>已發布參考影片 · 預設不播放</small>
                  <video
                    controls
                    preload="none"
                    poster={videoStyleCover(selectedVideoStyleCode).asset ?? undefined}
                    src={selectedPublishedVideo}
                    aria-label={`${selectedPublishedStyle?.name ?? selectedVideoStyleCode}已發布參考影片`}
                  />
                </div>
              ) : null}
              {selectedPublishedReferences.length ? (
                <div className="published-reference-list">
                  {selectedPublishedReferences.map((reference) => {
                    const url = reference.source_url ?? "";
                    const isDirectVideo = /\.(mp4|webm|mov)(?:\?|$)/i.test(url);
                    return (
                      <article key={reference.id}>
                        <small>已確認參考</small>
                        <b>{reference.source_account || "公開參考"}</b>
                        <p>{reference.evidence_summary || "已連結至此發布風格。"}</p>
                        {isDirectVideo && !selectedPublishedVideo ? <video controls preload="none" src={url} aria-label={`${selectedPublishedStyle?.name ?? selectedVideoStyleCode}參考影片`} /> : null}
                        {!isDirectVideo && /^https?:\/\//.test(url) ? <a href={url} target="_blank" rel="noreferrer">開啟原有參考連結</a> : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : (
            <p className="select-style-hint">點選上方內容風格卡，查看該風格的參考、原片稿與規格。</p>
          )}
          {selectedRestorations.length ? (
            <section className="restoration-library">
              <div className="restoration-heading">
                <div>
                  <small>原片還原稿</small>
                  <h3>時間軸與核實狀態</h3>
                  <p>完整代表片保留 0 秒至結尾；增補只保留指定片段。100% 時間軸覆蓋不代表對白或音訊已核實。</p>
                </div>
                <strong>{selectedRestorations.length} 項</strong>
              </div>
              <div className="artifact-separation" aria-label="內容類型分隔">
                <b>原片還原稿：已入庫</b>
                <span>風格規格：連結現有 review 版本</span>
                <span>示範劇本：獨立內容，未混入本稿</span>
                <span>重建實驗 Prompt：{registryFormat === "ai_short_video" ? (reconstructionPromptSets.length ? "已獨立入庫／未啟用" : "尚未入庫／未啟用") : "另於 AI 短片分頁／未啟用"}</span>
              </div>
              <div className="restoration-list">
                {selectedRestorations.map((restoration) => (
                  <details key={restoration.id} className="restoration-card">
                    <summary>
                      <span>
                        <b>{restoration.referenceKey}</b>
                        <small>{restoration.selection === "full_representative" ? "完整代表片" : "精選片段"}</small>
                      </span>
                      <span>{restoration.styleName} · v{restoration.version} {restoration.status}</span>
                      <strong>{restoration.coverageSeconds.toFixed(2)}s / {restoration.durationSeconds.toFixed(2)}s · {restoration.coveragePercent}%</strong>
                    </summary>
                    <div className="restoration-body">
                      <p className="source-file">{restoration.sourceFilename}</p>
                      <div className="status-grid">
                        <span><b>畫面</b>{restoration.visualStatus}</span>
                        <span><b>音訊</b>{restoration.audioTranscriptStatus}</span>
                        <span><b>權利</b>只供內部研究／未核實／不可重傳</span>
                      </div>
                      <div className="timeline-list">
                        {restoration.timeline.map((segment, index) => (
                          <article key={`${restoration.id}-${segment.order ?? index}`}>
                            <header>
                              <b>{Number(segment.start_seconds ?? 0).toFixed(2)}–{Number(segment.end_seconds ?? 0).toFixed(2)}s</b>
                              <span>畫面：{segment.verification?.visual ?? "待核實"}</span>
                              <span>音訊：{segment.verification?.audio ?? "待人工聆聽"}</span>
                              <span>翻譯：{segment.verification?.translation ?? "不適用／待核實"}</span>
                            </header>
                            <p><b>畫面：</b>{segment.visual_description_zh || "未提供"}</p>
                            <p><b>對白／旁白：</b>{segment.speech_or_narration_zh || "未提供；待人工聆聽"}</p>
                            {segment.on_screen_text_zh ? <p><b>畫面文字：</b>{segment.on_screen_text_zh}</p> : null}
                            {segment.notes ? <p><b>備註：</b>{segment.notes}</p> : null}
                          </article>
                        ))}
                      </div>
                      {restoration.unverified.length ? (
                        <div className="unverified"><b>尚未核實</b><ul>{restoration.unverified.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
          {registryFormat === "ai_short_video" && selectedPromptSets.length ? (
            <section className="restoration-library prompt-library">
              <div className="restoration-heading">
                <div>
                  <small>重建實驗 Prompt</small>
                  <h3>模型無關短鏡測試規格</h3>
                  <p>與原片還原稿、風格規格及示範劇本分開保存；目前未生成、未呼叫 API、未使用 credits。</p>
                </div>
                <strong>{selectedPromptSets.reduce((sum, item) => sum + item.shotCount, 0)} 鏡／{selectedPromptSets.length} 組</strong>
              </div>
              <div className="restoration-list">
                {selectedPromptSets.map((promptSet) => (
                  <details key={promptSet.id} className="restoration-card">
                    <summary>
                      <span><b>{promptSet.referenceKey}</b><small>重建 Prompt</small></span>
                      <span>{promptSet.displayName} · v{promptSet.version} {promptSet.status}</span>
                      <strong>{promptSet.shotCount} 個短鏡</strong>
                    </summary>
                    <div className="restoration-body">
                      <div className="status-grid">
                        <span><b>狀態</b>{promptSet.promptStatus}</span>
                        <span><b>執行</b>生成 0／API 0／credits 0</span>
                        <span><b>音訊</b>人工逐句核實 0</span>
                      </div>
                      <div className="timeline-list">
                        {promptSet.shots.map((shot, index) => (
                          <article key={`${promptSet.id}-${shot.shot_id ?? index}`}>
                            <header>
                              <b>{shot.shot_id ?? `鏡頭 ${index + 1}`}</b>
                              <span>來源 {Number(shot.source_time?.start_seconds ?? 0).toFixed(2)}–{Number(shot.source_time?.end_seconds ?? 0).toFixed(2)}s</span>
                              <span>測試片長 {Number(shot.test_duration_seconds ?? 0).toFixed(2)}s</span>
                            </header>
                            <p><b>Prompt：</b>{shot.prompt_zh}</p>
                            <p><b>構圖／運鏡：</b>{shot.composition}；{shot.camera_motion}</p>
                            <p><b>動作／表情：</b>{shot.action}；{shot.expression}</p>
                            <p><b>對白 placeholder：</b>{shot.dialogue_or_narration_placeholder_zh}</p>
                            <p><b>聲音後期：</b>{shot.audio_post}</p>
                            {shot.acceptance_checks?.length ? <p><b>QA：</b>{shot.acceptance_checks.join("；")}</p> : null}
                          </article>
                        ))}
                      </div>
                      {promptSet.unverified.length ? <div className="unverified"><b>尚未核實</b><ul>{promptSet.unverified.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
      <style jsx>{`
        .lab {
          padding: 40px;
          color: #f5f5f5;
        }
        .lab > header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: end;
          margin-bottom: 24px;
        }
        .lab small {
          color: #a78bfa;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }
        .lab h1 {
          margin: 7px 0;
          font-size: 36px;
        }
        .lab header p {
          margin: 0;
          color: #888;
        }
        .summary {
          display: grid;
          min-width: 120px;
          border: 1px solid #302747;
          border-radius: 14px;
          background: #17131f;
          padding: 15px;
          text-align: center;
        }
        .summary strong {
          font-size: 26px;
        }
        .summary span {
          color: #888;
          font-size: 10px;
        }
        .notice {
          margin-bottom: 16px;
          border: 1px solid #3a3152;
          border-radius: 10px;
          background: #1b1724;
          padding: 11px;
          color: #c4b5fd;
          font-size: 12px;
        }
        .quick {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
          margin-bottom: 18px;
          border: 1px solid #553c78;
          border-radius: 16px;
          background: linear-gradient(120deg, #1d142a, #15131b);
          padding: 19px 22px;
        }
        .quick h2 {
          margin: 5px 0;
        }
        .quick p {
          margin: 0;
          color: #8c8495;
          font-size: 11px;
        }
        .quick-actions {
          display: flex;
          gap: 9px;
          align-items: end;
        }
        .quick-actions label {
          min-width: 190px;
          margin: 0;
        }
        .quick-actions label span {
          color: #aaa;
        }
        .quick-upload {
          display: block !important;
          min-width: 150px !important;
          border: 1px solid #55416f;
          border-radius: 9px;
          background: #251b32;
          color: #d8b4fe !important;
          padding: 10px 12px;
          text-align: center;
          cursor: pointer;
        }
        .quick-upload input {
          display: none;
        }
        .quick-actions button {
          min-width: 132px;
          border: 0;
          border-radius: 9px;
          background: #7c3aed;
          color: white;
          padding: 11px 13px;
          font-weight: 800;
        }
        .quick-actions button:disabled {
          opacity: 0.45;
        }
        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(370px, 0.85fr);
          gap: 18px;
        }
        .layout > form,
        .layout > aside {
          border: 1px solid #262626;
          border-radius: 16px;
          background: #141414;
          padding: 22px;
        }
        .form-head,
        .index-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 18px;
        }
        .lab h2 {
          margin: 4px 0;
          font-size: 20px;
        }
        .form-head button {
          border: 0;
          background: transparent;
          color: #aaa;
        }
        .fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .fields.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .fields.four {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .lab label {
          display: grid;
          gap: 6px;
          margin-bottom: 12px;
          color: #aaa;
          font-size: 11px;
        }
        .lab input,
        .lab textarea,
        .lab select {
          width: 100%;
          border: 1px solid #303030;
          border-radius: 9px;
          background: #1c1c1c;
          color: #f5f5f5;
          padding: 10px;
          outline: none;
        }
        .lab input:focus,
        .lab textarea:focus,
        .lab select:focus {
          border-color: #7c3aed;
        }
        fieldset {
          margin: 18px 0;
          border: 1px solid #292929;
          border-radius: 12px;
          padding: 16px;
        }
        legend {
          padding: 0 8px;
          color: #a78bfa;
          font-size: 11px;
          font-weight: 800;
        }
        .core {
          border-color: #49356a;
          background: #181320;
        }
        .shot {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 12px;
          align-items: center;
          margin: 4px 0 18px;
        }
        .shot > div {
          position: relative;
          height: 120px;
          border: 1px dashed #3b3b3b;
          border-radius: 10px;
          background: #191919;
          overflow: hidden;
          display: grid;
          place-items: center;
          color: #666;
          font-size: 10px;
        }
        .shot img,
        .thumb img {
          object-fit: cover;
        }
        .upload {
          display: block !important;
          width: max-content !important;
          margin: 0 !important;
          border: 1px solid #3a3152;
          border-radius: 9px;
          background: #20192c;
          color: #c4b5fd !important;
          padding: 10px 13px;
          cursor: pointer;
        }
        .upload input {
          display: none;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
        }
        .save {
          width: 100%;
          border: 0;
          border-radius: 10px;
          background: #7c3aed;
          color: #fff;
          padding: 13px;
          font-weight: 800;
        }
        .save:disabled {
          opacity: 0.55;
        }
        .index-head input {
          max-width: 205px;
        }
        .filters {
          display: flex;
          gap: 7px;
          margin-bottom: 13px;
        }
        .filters button {
          border: 1px solid #303030;
          border-radius: 999px;
          background: #1a1a1a;
          color: #888;
          padding: 7px 11px;
          font-size: 10px;
        }
        .filters .active {
          border-color: #7c3aed;
          background: #271b3a;
          color: #c4b5fd;
        }
        .cards {
          display: grid;
          gap: 9px;
          max-height: 1350px;
          overflow: auto;
        }
        .card {
          display: flex;
          width: 100%;
          gap: 12px;
          border: 1px solid #292929;
          border-radius: 12px;
          background: #1a1a1a;
          color: #fff;
          padding: 12px;
          text-align: left;
        }
        .card:hover {
          border-color: #5b3b91;
        }
        .thumb {
          position: relative;
          flex: 0 0 90px;
          height: 112px;
          border-radius: 8px;
          overflow: hidden;
        }
        .card-body {
          min-width: 0;
          display: grid;
          gap: 6px;
        }
        .meta {
          display: flex;
          gap: 7px;
          align-items: center;
        }
        .meta em {
          border-radius: 999px;
          background: #242424;
          color: #aaa;
          padding: 4px 7px;
          font-size: 8px;
          font-style: normal;
        }
        .meta .moment {
          background: #3b1d28;
          color: #fda4af;
        }
        .meta i {
          color: #666;
          font-size: 9px;
          font-style: normal;
        }
        .card strong {
          font-size: 14px;
        }
        .card b {
          color: #aaa;
          font-size: 10px;
        }
        .card small {
          color: #f59e0b;
          letter-spacing: 0;
        }
        .card p {
          margin: 0;
          color: #858585;
          font-size: 10px;
          line-height: 1.45;
        }
        .empty {
          color: #777;
          font-size: 12px;
        }
        @media (max-width: 1150px) {
          .quick {
            align-items: stretch;
            flex-direction: column;
          }
          .quick-actions {
            align-items: stretch;
          }
          .quick-actions label {
            flex: 1;
          }
          .layout {
            grid-template-columns: 1fr;
          }
          .metrics {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 720px) {
          .lab {
            padding: 22px;
          }
          .lab > header {
            align-items: flex-start;
            flex-direction: column;
          }
          .quick-actions {
            flex-direction: column;
          }
          .quick-actions label,
          .quick-upload,
          .quick-actions button {
            width: 100%;
            min-width: 0 !important;
          }
          .fields,
          .fields.three,
          .fields.four {
            grid-template-columns: 1fr;
          }
          .metrics {
            grid-template-columns: repeat(2, 1fr);
          }
          .index-head {
            align-items: stretch;
            flex-direction: column;
          }
          .index-head input {
            max-width: none;
          }
        }
      `}</style>
      <style jsx>{`
        .published-styles {
          margin-bottom: 18px;
          border: 1px solid #302747;
          border-radius: 16px;
          background: #141217;
          padding: 20px;
        }
        .published-head {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: end;
          margin-bottom: 15px;
        }
        .published-head h2 {
          margin: 5px 0;
        }
        .published-head p {
          margin: 0;
          color: #888;
          font-size: 11px;
        }
        .published-head > strong {
          color: #c4b5fd;
          font-size: 12px;
        }
        .registry-format-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 220px));
          gap: 8px;
          margin-bottom: 15px;
        }
        .registry-format-tabs button {
          display: grid;
          gap: 3px;
          border: 1px solid #343039;
          border-radius: 10px;
          background: #1a181d;
          color: #aaa;
          padding: 10px 12px;
          text-align: left;
          cursor: pointer;
        }
        .registry-format-tabs button.active {
          border-color: #8b5cf6;
          background: #2a1b3d;
          color: #f3e8ff;
        }
        .registry-format-tabs b {
          font-size: 11px;
        }
        .registry-format-tabs span {
          font-size: 8px;
          opacity: 0.72;
        }
        .style-cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 11px;
        }
        .style-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #302b37;
          border-radius: 13px;
          background: #1a181d;
        }
        .style-card.selected-video-style {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.35);
        }
        .video-style-cover {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          border: 0;
          background: #111;
          color: white;
          padding: 0;
          cursor: pointer;
        }
        .video-style-cover.selected {
          outline: 2px solid #a78bfa;
          outline-offset: -2px;
        }
        .video-style-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .video-cover-fallback {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          gap: 9px;
          padding: 24px;
          background:
            radial-gradient(circle at 72% 18%, rgba(255,255,255,.28), transparent 22%),
            linear-gradient(145deg, #183047, #101217 58%, #291a36);
          text-align: center;
        }
        .video-cover-fallback.rose, .video-cover-fallback.coral, .video-cover-fallback.red { background: radial-gradient(circle at 70% 18%, #fb7185, transparent 25%), linear-gradient(145deg, #4c1522, #111 66%); }
        .video-cover-fallback.amber, .video-cover-fallback.orange, .video-cover-fallback.gold, .video-cover-fallback.sepia { background: radial-gradient(circle at 72% 18%, #f59e0b, transparent 25%), linear-gradient(145deg, #473015, #111 66%); }
        .video-cover-fallback.teal, .video-cover-fallback.cyan, .video-cover-fallback.lime { background: radial-gradient(circle at 72% 18%, #2dd4bf, transparent 25%), linear-gradient(145deg, #103c3b, #111 66%); }
        .video-cover-fallback.violet, .video-cover-fallback.plum, .video-cover-fallback.mauve, .video-cover-fallback.indigo { background: radial-gradient(circle at 72% 18%, #a78bfa, transparent 25%), linear-gradient(145deg, #31205d, #111 66%); }
        .video-cover-fallback b {
          color: white;
          font-size: 56px;
          line-height: 1;
          text-shadow: 0 8px 30px rgba(0,0,0,.35);
        }
        .video-cover-fallback em {
          max-width: 190px;
          color: #fff;
          font-size: 14px;
          font-style: normal;
          font-weight: 850;
          line-height: 1.35;
        }
        .video-cover-fallback small {
          color: rgba(255,255,255,.68);
          letter-spacing: .08em;
        }
        .video-cover-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,.08), transparent 55%, rgba(0,0,0,.58));
          pointer-events: none;
        }
        .video-cover-status,
        .video-cover-open,
        .video-cover-rights {
          position: absolute;
          z-index: 2;
          top: 10px;
          border-radius: 999px;
          background: rgba(12,12,14,.82);
          padding: 5px 8px;
          font-size: 8px;
          font-weight: 850;
          backdrop-filter: blur(7px);
        }
        .video-cover-status { left: 10px; color: #ddd; }
        .video-cover-status.published { color: #bbf7d0; }
        .video-cover-status.review { color: #e9d5ff; }
        .video-cover-open { top: auto; right: 10px; bottom: 10px; color: white; }
        .video-cover-rights {
          top: auto;
          bottom: 10px;
          left: 10px;
          max-width: calc(100% - 92px);
          color: #ddd;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        :global(.template-actual-preview) {
          position: relative;
          background: #0d0c0f;
        }
        :global(.template-preview-stage) {
          position: relative;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          background: #0d0c0f;
        }
        :global(.template-preview-stage .canvas-container),
        :global(.template-preview-stage canvas) {
          width: 100% !important;
          height: 100% !important;
        }
        :global(.template-preview-stage img) {
          object-fit: cover;
        }
        :global(.template-preview-badges) {
          position: absolute;
          z-index: 4;
          top: 10px;
          left: 10px;
          display: flex;
          gap: 5px;
        }
        :global(.template-preview-badges button) {
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 999px;
          background: rgba(10, 10, 12, 0.78);
          color: #bbb;
          padding: 5px 8px;
          font-size: 8px;
          font-weight: 850;
          backdrop-filter: blur(8px);
        }
        :global(.template-preview-badges button.active) {
          border-color: #bbf7d0;
          background: rgba(20, 83, 45, 0.9);
          color: #dcfce7;
        }
        :global(.template-preview-badges button.active.draft) {
          border-color: #d8b4fe;
          background: rgba(74, 29, 108, 0.92);
          color: #f3e8ff;
        }
        :global(.template-preview-status) {
          position: absolute;
          z-index: 4;
          right: 9px;
          top: 10px;
          border-radius: 999px;
          background: rgba(10, 10, 12, 0.82);
          color: #ddd;
          padding: 5px 8px;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.06em;
          backdrop-filter: blur(8px);
        }
        :global(.template-preview-status.published) {
          color: #bbf7d0;
        }
        :global(.template-preview-status.draft) {
          color: #e9d5ff;
        }
        :global(.template-preview-empty) {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          gap: 6px;
          padding: 24px;
          background: repeating-linear-gradient(
            135deg,
            #17151a,
            #17151a 12px,
            #1c1920 12px,
            #1c1920 24px
          );
          color: #aaa;
          text-align: center;
        }
        :global(.template-preview-empty b) {
          color: #ddd;
          font-size: 13px;
        }
        :global(.template-preview-empty span) {
          max-width: 180px;
          font-size: 9px;
          line-height: 1.45;
        }
        .placeholder-preview {
          display: grid;
          aspect-ratio: 4 / 5;
          place-content: center;
          gap: 8px;
          padding: 24px;
          background:
            linear-gradient(145deg, rgba(82, 40, 120, 0.3), transparent 58%),
            repeating-linear-gradient(135deg, #15131a, #15131a 13px, #1b1720 13px, #1b1720 26px);
          color: #aaa;
          text-align: center;
        }
        .placeholder-preview span {
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .placeholder-preview strong {
          color: #f3e8ff;
          font-size: 17px;
        }
        .placeholder-preview small {
          color: #86efac;
          font-size: 10px;
          font-weight: 800;
        }
        :global(.template-preview-pages) {
          position: absolute;
          z-index: 5;
          right: 0;
          bottom: 12px;
          left: 0;
          display: flex;
          justify-content: center;
          gap: 5px;
          pointer-events: none;
        }
        :global(.template-preview-pages button) {
          width: 17px;
          height: 17px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 999px;
          background: rgba(10, 10, 12, 0.72);
          color: #aaa;
          padding: 0;
          font-size: 7px;
          font-weight: 800;
          pointer-events: auto;
        }
        :global(.template-preview-pages button.active) {
          border-color: white;
          background: white;
          color: #111;
        }
        .style-copy {
          padding: 13px;
        }
        .style-copy h3 {
          margin: 6px 0;
          font-size: 14px;
        }
        .style-copy p {
          min-height: 44px;
          margin: 0;
          color: #8d8991;
          font-size: 10px;
          line-height: 1.45;
        }
        .style-copy > div {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 11px;
          color: #777;
          font-size: 8px;
        }
        .style-copy > div b {
          color: #a78bfa;
        }
        .master-actions {
          display: grid !important;
          grid-template-columns: 1fr auto;
          gap: 7px !important;
          margin-top: 12px !important;
        }
        .master-actions button {
          border: 1px solid #57406f;
          border-radius: 8px;
          background: #2a1b3d;
          color: #e9d5ff;
          padding: 8px;
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
        }
        .master-actions .publish {
          border-color: #166534;
          background: #153a25;
          color: #bbf7d0;
        }
        .master-actions button:disabled {
          opacity: 0.45;
          cursor: wait;
        }
        .restoration-import-action {
          display: flex;
          justify-content: flex-end;
          margin: -4px 0 14px;
        }
        .restoration-import-action button {
          border: 1px solid #57406f;
          border-radius: 8px;
          background: #2a1b3d;
          color: #e9d5ff;
          padding: 8px 12px;
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
        }
        .restoration-import-action button:disabled {
          opacity: 0.5;
        }
        .select-style-hint {
          margin: 16px 0 0;
          border: 1px dashed #3a3152;
          border-radius: 10px;
          padding: 16px;
          color: #8d8991;
          font-size: 11px;
          text-align: center;
        }
        .selected-video-style-detail {
          display: grid;
          gap: 12px;
          margin-top: 18px;
          border: 1px solid #4c3768;
          border-radius: 12px;
          background: #18131f;
          padding: 16px;
        }
        .selected-video-style-detail h3 { margin: 5px 0; }
        .selected-video-style-detail p { margin: 0; color: #999; font-size: 10px; line-height: 1.5; }
        .selected-style-states { display: flex; flex-wrap: wrap; gap: 7px; }
        .selected-style-states > * {
          border-radius: 999px;
          background: #29212f;
          color: #aaa;
          padding: 6px 9px;
          font-size: 9px;
        }
        .selected-style-states b { color: #d8b4fe; }
        .selected-published-video {
          display: grid;
          gap: 7px;
          max-width: 360px;
        }
        .selected-published-video video {
          width: 100%;
          max-height: 520px;
          border-radius: 9px;
          background: #0b0b0c;
        }
        .published-reference-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .published-reference-list article {
          display: grid;
          gap: 6px;
          min-width: 0;
          border: 1px solid #302b37;
          border-radius: 9px;
          background: #1b181e;
          padding: 10px;
        }
        .published-reference-list b { color: #ddd; font-size: 10px; }
        .published-reference-list video { width: 100%; max-height: 260px; background: #0b0b0c; }
        .published-reference-list a { color: #c4b5fd; font-size: 9px; }
        .restoration-library {
          margin-top: 18px;
          border-top: 1px solid #302747;
          padding-top: 18px;
        }
        .restoration-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: end;
        }
        .restoration-heading h3 {
          margin: 5px 0;
          font-size: 18px;
        }
        .restoration-heading p {
          margin: 0;
          color: #999;
          font-size: 11px;
        }
        .restoration-heading > strong {
          color: #c4b5fd;
          font-size: 12px;
        }
        .artifact-separation {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin: 13px 0;
        }
        .artifact-separation > * {
          border: 1px solid #343039;
          border-radius: 999px;
          background: #1a181d;
          color: #aaa;
          padding: 6px 9px;
          font-size: 9px;
        }
        .artifact-separation b {
          border-color: #4c1d95;
          color: #d8b4fe;
        }
        .restoration-list {
          display: grid;
          gap: 8px;
        }
        .restoration-card {
          border: 1px solid #302b37;
          border-radius: 10px;
          background: #17151a;
          overflow: hidden;
        }
        .restoration-card summary {
          display: grid;
          grid-template-columns: minmax(150px, .65fr) 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          color: #aaa;
          font-size: 10px;
          cursor: pointer;
        }
        .restoration-card summary > span:first-child {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .restoration-card summary b,
        .restoration-card summary strong {
          color: #f3e8ff;
        }
        .restoration-card summary small {
          border-radius: 999px;
          background: #2a1b3d;
          padding: 4px 7px;
          color: #c4b5fd;
          letter-spacing: 0;
        }
        .restoration-body {
          border-top: 1px solid #302b37;
          padding: 14px;
        }
        .source-file {
          margin: 0 0 10px;
          color: #8d8991;
          font-size: 9px;
          overflow-wrap: anywhere;
        }
        .status-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }
        .status-grid span {
          display: grid;
          gap: 4px;
          border: 1px solid #302b37;
          border-radius: 8px;
          padding: 9px;
          color: #8d8991;
          font-size: 9px;
          overflow-wrap: anywhere;
        }
        .status-grid b { color: #d8b4fe; }
        .timeline-list { display: grid; gap: 7px; }
        .timeline-list article {
          border-left: 2px solid #6d28d9;
          background: #1c1920;
          padding: 10px 11px;
        }
        .timeline-list header {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 10px;
          margin-bottom: 7px;
          color: #858087;
          font-size: 8px;
        }
        .timeline-list header b { color: #e9d5ff; font-size: 10px; }
        .timeline-list p {
          margin: 4px 0;
          color: #aaa;
          font-size: 10px;
          line-height: 1.5;
        }
        .timeline-list p b { color: #ddd; }
        .unverified {
          margin-top: 11px;
          border: 1px solid #713f12;
          border-radius: 8px;
          background: #21180e;
          padding: 10px;
          color: #fbbf24;
          font-size: 10px;
        }
        .unverified ul { margin: 6px 0 0; padding-left: 17px; }
        .unverified li { margin: 3px 0; color: #d6b985; }
        .no-template {
          display: block;
          margin-top: 10px;
          color: #6f6a73 !important;
          letter-spacing: 0 !important;
        }
        .single-post-status {
          display: block;
          margin-top: 12px;
          color: #bbf7d0 !important;
          letter-spacing: 0.02em !important;
        }
        .review-supplement-status {
          display: block;
          margin-top: 6px;
          color: #d8b4fe !important;
          letter-spacing: 0 !important;
        }
        .layout {
          grid-template-columns: 1fr;
        }
        .layout > aside {
          order: -1;
        }
        .cards {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          max-height: none;
        }
        .card {
          flex-direction: column;
          min-width: 0;
          padding: 0;
          overflow: hidden;
        }
        .thumb {
          width: 100%;
          height: auto;
          aspect-ratio: 1 / 1;
          flex-basis: auto;
          border-radius: 0;
        }
        .card-body {
          padding: 13px;
        }
        @media (max-width: 1180px) {
          .cards {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 1180px) {
          .style-cards {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 850px) {
          .cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 850px) {
          .style-cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .restoration-card summary,
          .status-grid,
          .published-reference-list {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .cards {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .style-cards {
            grid-template-columns: 1fr;
          }
          .published-head {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  );
}
