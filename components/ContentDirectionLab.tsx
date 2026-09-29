"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TemplateCanvasPreview } from "@/components/TemplateCanvasPreview";
import { approvedStylePreview } from "@/lib/approved-style-previews";

type Direction = Record<string, any> & {
  id?: string;
  title: string;
  account: string;
  whySave: string;
  reusableTemplate: string;
};
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
type InternalSpecification = {
  code: string;
  name: string;
  description: string;
  styleId: string;
  versionId: string;
  version: number;
  status: "draft" | "review";
  specificationType: "new_direction" | "existing_direction_supplement";
  creatorEligible: false;
  contentStudioEnabled: false;
  generationEnabled: false;
  rules: Record<string, unknown>;
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
const today = () => new Date().toISOString().slice(0, 10);
const empty: Direction = {
  title: "",
  account: "",
  platform: "Threads",
  postUrl: "",
  imageUrl: "",
  capturedAt: today(),
  publishedAt: "",
  kind: "moment",
  eventName: "",
  eventDate: "",
  trendStage: "發布後",
  trendDependency: "高度",
  reusableWindow: "3 日",
  responseSpeed: "",
  hook: "",
  format: "",
  visualPattern: "",
  tone: "",
  cta: "",
  mechanism: "",
  whySave: "",
  reusableTemplate: "",
  industries: [],
  objectives: [],
  tags: [],
  risks: "",
  metrics: {},
  metricsCapturedAt: today(),
};
const split = (value: string) =>
  value
    .split(/[，,；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
const join = (value: unknown) => (Array.isArray(value) ? value.join("，") : "");

export function ContentDirectionLab() {
  const [items, setItems] = useState<Direction[]>([]);
  const [styles, setStyles] = useState<PublishedStyle[]>([]);
  const [masterDrafts, setMasterDrafts] = useState<MasterDraft[]>([]);
  const [internalSpecifications, setInternalSpecifications] = useState<InternalSpecification[]>([]);
  const [importingInternalSpecifications, setImportingInternalSpecifications] = useState(false);
  const [masterBusy, setMasterBusy] = useState("");
  const [draft, setDraft] = useState<Direction>(empty);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [message, setMessage] = useState("");
  const loadSequence = useRef(0);
  const [registryFormat, setRegistryFormat] =
    useState<RegistryFormat>("instagram_carousel");

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    const [directionsResponse, stylesResponse, internalResponse] = await Promise.all([
      fetch("/api/content-directions", { cache: "no-store" }),
      fetch(
        `/api/content-directions/styles?format=${encodeURIComponent(registryFormat)}`,
        { cache: "no-store" },
      ),
      registryFormat === "human_short_video"
        ? fetch("/api/content-directions/internal-human-video-specifications", { cache: "no-store" })
        : Promise.resolve(null),
    ]);
    const [directionsPayload, stylesPayload, internalPayload] = await Promise.all([
      directionsResponse.json().catch(() => ({})),
      stylesResponse.json().catch(() => ({})),
      internalResponse?.json().catch(() => ({})) ?? Promise.resolve({}),
    ]);
    if (sequence !== loadSequence.current) return;
    if (directionsResponse.ok) setItems(directionsPayload.directions || []);
    else setMessage(directionsPayload.error || "未能載入研究庫");
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
    } else setMessage(stylesPayload.error || "未能載入已發布內容風格");
    if (registryFormat === "human_short_video" && internalResponse?.ok) {
      setInternalSpecifications(Array.isArray(internalPayload.specifications) ? internalPayload.specifications : []);
    } else setInternalSpecifications([]);
    setLoading(false);
  }, [registryFormat]);
  useEffect(() => {
    void load();
  }, [load]);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (kind === "all" || item.kind === kind) &&
          JSON.stringify(item).toLowerCase().includes(query.toLowerCase()),
      ),
    [items, kind, query],
  );
  const visibleStyles = useMemo(
    () => styles.filter((style) => style.format === registryFormat),
    [registryFormat, styles],
  );
  const update = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const edit = (item: Direction) => {
    setDraft(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function upload(file: File) {
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
      if (response.ok) update("imageUrl", payload.url);
      else setMessage(payload.error || "未能上載截圖");
    } catch {
      setMessage("未能上載截圖，請檢查連線後再試。");
    } finally {
      setUploading(false);
    }
  }

  async function analyse() {
    if (!draft.imageUrl || !draft.account.trim()) {
      setMessage("請先上載截圖並輸入帳號或品牌名稱。");
      return;
    }
    setAnalysing(true);
    setMessage("");
    try {
      const response = await fetch("/api/content-directions/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageUrl: draft.imageUrl,
          account: draft.account,
          platform: draft.platform,
          capturedAt: draft.capturedAt,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setDraft((current) => ({
          ...current,
          ...payload.suggestion,
          imageUrl: current.imageUrl,
          account: current.account,
          capturedAt: current.capturedAt,
          metricsCapturedAt: current.capturedAt,
        }));
        setMessage("AI 初步拆解已完成；請核對及修改後再加入研究庫。");
      } else setMessage(payload.error || "AI 暫時未能分析截圖");
    } catch {
      setMessage("AI 分析連線中斷，請稍後再試。");
    } finally {
      setAnalysing(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/content-directions", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setDraft({ ...empty, capturedAt: today(), metricsCapturedAt: today() });
      setMessage(draft.id ? "研究已更新。" : "已加入內容方向研究室。");
      await load();
    } else setMessage(payload.error || "未能儲存研究");
    setSaving(false);
  }

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

  async function importInternalHumanVideoSpecifications() {
    setImportingInternalSpecifications(true);
    setMessage("");
    const response = await fetch("/api/content-directions/internal-human-video-specifications", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage("真人短片規格已存入 Core 內部審閱層；Creator／Content Studio 仍未啟用。");
      await load();
    } else setMessage(payload.error || "未能匯入真人短片規格");
    setImportingInternalSpecifications(false);
  }

  return (
    <section className="lab">
      <header>
        <div>
          <small>SOON 內容風格</small>
          <h1>選擇內容風格</h1>
          <p>以卡片瀏覽內容風格與參考資料；最近更新的項目會優先顯示。</p>
        </div>
        <div className="summary">
          <strong>{items.length}</strong>
          <span>個風格研究</span>
        </div>
      </header>
      {message ? <div className="notice">{message}</div> : null}
      <section className="published-styles">
        <div className="published-head">
          <div>
            <small>已發布風格目錄</small>
            <h2>已發布內容風格</h2>
            <p>
              Content Studio
              會按內容格式讀取相應風格池；新版不會覆蓋已建立項目的規格快照。
            </p>
          </div>
          <strong>{visibleStyles.length} 款</strong>
        </div>
        <div className="registry-format-tabs" aria-label="內容格式">
          {registryFormats.map((format) => (
            <button
              key={format.id}
              type="button"
              className={registryFormat === format.id ? "active" : ""}
              onClick={() => setRegistryFormat(format.id)}
            >
              <b>{format.label}</b>
              <span>{format.note}</span>
            </button>
          ))}
        </div>
        {loading ? (
          <p className="empty">正在載入風格…</p>
        ) : visibleStyles.length ? (
          <div className="style-cards">
            {visibleStyles.map((style) => {
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
                <article key={style.styleId} className="style-card">
                  <TemplateCanvasPreview
                    draftDesigns={draft?.page_designs}
                    draftVersion={draft?.target_version}
                    legacyImage={legacyImage}
                    name={style.name}
                    pageRoles={pageRoles}
                    publishedDesigns={publishedDesigns}
                    publishedVersion={template?.version.number || null}
                  />
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
                      <small className="single-post-status">
                        短片時間軸母版 · Script 與鏡頭規格可供 Creator 讀取
                      </small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty">未有已發布內容風格。</p>
        )}
      </section>
      {registryFormat === "human_short_video" ? (
        <section className="published-styles internal-specifications">
          <div className="published-head">
            <div>
              <small>Core 內部規格</small>
              <h2>真人短片規格審閱層</h2>
              <p>只供 SOON Core 閱讀及核對；未發布、沒有 Template binding，亦不會分發到 Creator／Content Studio。</p>
            </div>
            <strong>{internalSpecifications.length} 份</strong>
          </div>
          {internalSpecifications.length ? (
            <div className="style-cards">
              {internalSpecifications.map((specification) => (
                <article key={specification.versionId} className="style-card">
                  <div className="placeholder-preview">
                    <span>Core only</span>
                    <strong>{specification.specificationType === "new_direction" ? "新方向" : "既有方向增補"}</strong>
                    <small>Creator 未啟用</small>
                  </div>
                  <div className="style-copy">
                    <small>human_short_video · {specification.status}</small>
                    <h3>{specification.name}</h3>
                    <p>{specification.description}</p>
                    <div>
                      <span>style:{specification.code}:v{specification.version}</span>
                      <b>不可生成</b>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="master-actions">
              <button type="button" disabled={importingInternalSpecifications} onClick={() => void importInternalHumanVideoSpecifications()}>
                {importingInternalSpecifications ? "匯入中…" : "匯入已確認真人短片規格"}
              </button>
            </div>
          )}
        </section>
      ) : null}
      <div className="quick">
        <div>
          <small>快速收集</small>
          <h2>上載截圖及帳號，由 AI 建立初稿</h2>
          <p>先生成可編輯草稿；確認內容後才正式加入研究庫。</p>
        </div>
        <div className="quick-actions">
          <label>
            <span>帳號／品牌</span>
            <input
              value={draft.account}
              onChange={(e) => update("account", e.target.value)}
              placeholder="例如：@ikea_taiwan"
            />
          </label>
          <label className="quick-upload">
            {uploading ? "正在上載…" : draft.imageUrl ? "更換截圖" : "上載截圖"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading || analysing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            disabled={
              uploading || analysing || !draft.imageUrl || !draft.account.trim()
            }
            onClick={() => void analyse()}
          >
            {analysing ? "AI 正在拆解…" : "AI 建立草稿"}
          </button>
        </div>
      </div>
      <div className="layout">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="form-head">
            <div>
              <small>{draft.id ? "EDIT RESEARCH" : "DAILY CAPTURE"}</small>
              <h2>{draft.id ? "編輯方向研究" : "收藏今日好帖"}</h2>
            </div>
            {draft.id ? (
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...empty,
                    capturedAt: today(),
                    metricsCapturedAt: today(),
                  })
                }
              >
                新增另一篇
              </button>
            ) : null}
          </div>
          <div className="fields">
            <label>
              研究標題
              <input
                required
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="例如：用高價新品反轉推低價產品"
              />
            </label>
            <label>
              帳號／品牌
              <input
                required
                value={draft.account}
                onChange={(e) => update("account", e.target.value)}
                placeholder="例如：@ikea_taiwan"
              />
            </label>
          </div>
          <div className="fields three">
            <label>
              平台
              <select
                value={draft.platform}
                onChange={(e) => update("platform", e.target.value)}
              >
                <option>Threads</option>
                <option>Instagram</option>
                <option>TikTok</option>
                <option>YouTube</option>
                <option>Facebook</option>
                <option>LinkedIn</option>
                <option>其他</option>
              </select>
            </label>
            <label>
              類型
              <select
                value={draft.kind}
                onChange={(e) => update("kind", e.target.value)}
              >
                <option value="moment">時機營銷</option>
                <option value="evergreen">長青內容方向</option>
              </select>
            </label>
            <label>
              收藏日期
              <input
                type="date"
                value={draft.capturedAt || ""}
                onChange={(e) => update("capturedAt", e.target.value)}
              />
            </label>
          </div>
          <div className="fields">
            <label>
              原帖連結
              <input
                type="url"
                value={draft.postUrl || ""}
                onChange={(e) => update("postUrl", e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label>
              發布日期
              <input
                type="date"
                value={draft.publishedAt || ""}
                onChange={(e) => update("publishedAt", e.target.value)}
              />
            </label>
          </div>
          <div className="shot">
            <div>
              {draft.imageUrl ? (
                <Image
                  src={draft.imageUrl}
                  alt="收藏帖文截圖"
                  fill
                  sizes="(max-width: 900px) 100vw, 460px"
                />
              ) : (
                <span>未有截圖</span>
              )}
            </div>
            <label className="upload">
              {uploading ? "正在上載…" : "上載截圖"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {draft.kind === "moment" ? (
            <fieldset>
              <legend>事件背景</legend>
              <div className="fields">
                <label>
                  Event／熱話
                  <input
                    value={draft.eventName || ""}
                    onChange={(e) => update("eventName", e.target.value)}
                    placeholder="iPhone 18 Pro 發布"
                  />
                </label>
                <label>
                  Event Date
                  <input
                    type="date"
                    value={draft.eventDate || ""}
                    onChange={(e) => update("eventDate", e.target.value)}
                  />
                </label>
              </div>
              <div className="fields four">
                <label>
                  Trend Stage
                  <select
                    value={draft.trendStage || ""}
                    onChange={(e) => update("trendStage", e.target.value)}
                  >
                    <option>發布前</option>
                    <option>發布當日</option>
                    <option>發布後</option>
                    <option>預訂期</option>
                    <option>正式發售</option>
                    <option>熱度回落</option>
                  </select>
                </label>
                <label>
                  熱話依賴
                  <select
                    value={draft.trendDependency || ""}
                    onChange={(e) => update("trendDependency", e.target.value)}
                  >
                    <option>高度</option>
                    <option>中度</option>
                    <option>低度</option>
                  </select>
                </label>
                <label>
                  可重用窗口
                  <input
                    value={draft.reusableWindow || ""}
                    onChange={(e) => update("reusableWindow", e.target.value)}
                    placeholder="24 小時／3 日"
                  />
                </label>
                <label>
                  品牌反應速度
                  <input
                    value={draft.responseSpeed || ""}
                    onChange={(e) => update("responseSpeed", e.target.value)}
                    placeholder="發布後 5 小時"
                  />
                </label>
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend>內容拆解</legend>
            <div className="fields">
              <label>
                Hook
                <textarea
                  rows={3}
                  value={draft.hook || ""}
                  onChange={(e) => update("hook", e.target.value)}
                />
              </label>
              <label>
                格式
                <input
                  value={draft.format || ""}
                  onChange={(e) => update("format", e.target.value)}
                  placeholder="比較表／單圖／Carousel"
                />
              </label>
            </div>
            <div className="fields">
              <label>
                視覺結構
                <textarea
                  rows={3}
                  value={draft.visualPattern || ""}
                  onChange={(e) => update("visualPattern", e.target.value)}
                />
              </label>
              <label>
                語氣／CTA
                <textarea
                  rows={3}
                  value={[draft.tone, draft.cta].filter(Boolean).join("\n")}
                  onChange={(e) => {
                    const [tone, ...cta] = e.target.value.split("\n");
                    setDraft((current) => ({
                      ...current,
                      tone,
                      cta: cta.join("\n"),
                    }));
                  }}
                />
              </label>
            </div>
            <label>
              內容機制
              <textarea
                rows={4}
                value={draft.mechanism || ""}
                onChange={(e) => update("mechanism", e.target.value)}
                placeholder="如何令觀眾停留、產生共鳴、收藏或分享？"
              />
            </label>
          </fieldset>
          <fieldset className="core">
            <legend>SOON 判斷</legend>
            <label>
              為何值得收藏
              <textarea
                required
                rows={4}
                value={draft.whySave}
                onChange={(e) => update("whySave", e.target.value)}
              />
            </label>
            <label>
              可重用內容方向
              <textarea
                required
                rows={5}
                value={draft.reusableTemplate}
                onChange={(e) => update("reusableTemplate", e.target.value)}
                placeholder="抽象成可套用其他客戶的方向，而非直接抄原帖"
              />
            </label>
            <div className="fields three">
              <label>
                適用行業
                <input
                  value={join(draft.industries)}
                  onChange={(e) => update("industries", split(e.target.value))}
                />
              </label>
              <label>
                宣傳企劃目標
                <input
                  value={join(draft.objectives)}
                  onChange={(e) => update("objectives", split(e.target.value))}
                />
              </label>
              <label>
                標籤
                <input
                  value={join(draft.tags)}
                  onChange={(e) => update("tags", split(e.target.value))}
                />
              </label>
            </div>
            <label>
              風險提示
              <textarea
                rows={3}
                value={draft.risks || ""}
                onChange={(e) => update("risks", e.target.value)}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>表現快照</legend>
            <div className="metrics">
              {[
                ["likes", "Like"],
                ["comments", "Comment"],
                ["shares", "Share"],
                ["reposts", "Repost"],
                ["views", "View"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min="0"
                    value={draft.metrics?.[key] ?? ""}
                    onChange={(e) =>
                      update("metrics", {
                        ...(draft.metrics || {}),
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
              <label>
                截取日期
                <input
                  type="date"
                  value={draft.metricsCapturedAt || ""}
                  onChange={(e) => update("metricsCapturedAt", e.target.value)}
                />
              </label>
            </div>
          </fieldset>
          <button className="save" disabled={saving || uploading}>
            {saving ? "正在儲存…" : draft.id ? "儲存修改" : "加入研究庫"}
          </button>
        </form>
        <aside>
          <div className="index-head">
            <div>
              <small>內容方向索引</small>
              <h2>研究庫</h2>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋品牌、事件或打法"
            />
          </div>
          <div className="filters">
            <button
              type="button"
              className={kind === "all" ? "active" : ""}
              onClick={() => setKind("all")}
            >
              全部
            </button>
            <button
              type="button"
              className={kind === "moment" ? "active" : ""}
              onClick={() => setKind("moment")}
            >
              Moment
            </button>
            <button
              type="button"
              className={kind === "evergreen" ? "active" : ""}
              onClick={() => setKind("evergreen")}
            >
              Evergreen
            </button>
          </div>
          {loading ? (
            <p className="empty">正在載入…</p>
          ) : filtered.length ? (
            <div className="cards">
              {filtered.map((item) => (
                <button
                  type="button"
                  className="card"
                  key={item.id}
                  onClick={() => edit(item)}
                >
                  {item.imageUrl ? (
                    <span className="thumb">
                      <Image src={item.imageUrl} alt="" fill sizes="110px" />
                    </span>
                  ) : null}
                  <span className="card-body">
                    <span className="meta">
                      <em className={item.kind}>
                        {item.kind === "moment" ? "MOMENT" : "EVERGREEN"}
                      </em>
                      <i>{item.platform}</i>
                    </span>
                    <strong>{item.title}</strong>
                    <b>{item.account}</b>
                    {item.eventName ? (
                      <small>
                        {item.eventName} · {item.trendStage}
                      </small>
                    ) : null}
                    <p>{item.reusableTemplate}</p>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty">未有研究。由今日第一篇好帖開始。</p>
          )}
        </aside>
      </div>
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
