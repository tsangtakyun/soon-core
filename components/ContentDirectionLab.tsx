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
  speech_original?: string | null;
  speech_translation_zh_hant?: string | null;
  speech_raw_asr?: string | null;
  speech_asr_cleaned?: string | null;
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
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const fallback = videoStyleFallbacks[code] ?? { icon: "▶", tone: "violet" };
  const cover = videoStyleCover(code);
  return (
    <button type="button" className={`video-style-cover ${selected ? "selected" : ""}`} onClick={(event) => onOpen(event.currentTarget)} aria-label={`查看${name}風格內容`}>
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

const specificationLabels: Record<string, string> = {
  duration_seconds: "建議片長（秒）",
  target_seconds: "目標片長（秒）",
  min: "最短",
  ideal: "建議",
  max: "最長",
  beats: "敘事節奏",
  role: "段落作用",
  time: "時間",
  fields: "每站須交代",
  capture_required: "必拍畫面",
  capture_required_per_stop: "每站必拍畫面",
  capture_required_global: "全片必拍畫面",
  capture_required_per_stage: "每階段必拍畫面",
  capture_optional: "可選畫面",
  host: "主持方式",
  host_exits: "主持退出方式",
  narration: "旁白方式",
  sync_sound: "保留現場聲",
  sync_sound_priority: "優先保留現場聲",
  captions: "字幕規格",
  language: "文字語言",
  max_lines: "最多行數",
  position: "字幕位置",
  protect: "不可遮擋",
  editing: "剪接原則",
  missing_assets: "缺少素材時",
  cta_allowed: "可用行動呼籲",
  facts_require_source: "必須核實來源",
  factual_guardrails: "事實核實規則",
  unverified_source_claims_are_template_facts: "未核實原片說法可否當作模板事實",
  allowed_labels: "可用標記",
  source_and_checked_date_required: "是否需要來源及核實日期",
  output: "輸出格式",
  width: "寬度",
  height: "高度",
  aspect_ratio: "畫面比例",
  production_variants: "製作變體",
  production_notes: "製作備註",
  purpose: "用途",
  arc: "敘事流程",
  restriction: "限制",
  requirements: "必要資料",
  caption_cards: "字幕卡",
  one_complete_idea_each: "每張只講一個完整重點",
  host_to_camera_required: "是否必須主持對鏡",
  duration: "片長",
  rights: "權利限制",
  supporting_analysis: "輔助分析",
  script: "腳本規格",
  avoid: "禁止事項",
  voice: "主持語氣",
  delivery: "表達方式",
  must_include: "必須包括",
  narrative_logic: "敘事邏輯",
  visual: "畫面規格",
  music: "音樂",
  shot_mix: "鏡頭組合",
  first_frame: "首格畫面",
  average_shot_seconds: "平均鏡頭長度",
  human_review_required: "是否需要人工審閱",
  research: "資料核實",
  sources: "資料來源",
  checked: "已核實",
  pending: "待核實",
  source_errors: "原片錯誤",
  checked_at: "核實日期",
  style_distinction: "與其他風格的區分",
  source_completeness: "原片完整性",
  story_arc: "段落結構",
  suitable_for: "適合題材",
  not_suitable_for: "不適合題材",
  reference_id: "參考編號",
  facts_require_source_and_date: "必須附來源及核實日期",
};

const specificationValueLabels: Record<string, string> = {
  list_promise: "開場承諾會提供完整清單",
  selection_criteria: "交代選擇準則",
  repeating_stop_module: "逐站以相同結構介紹",
  comparison_recap: "比較及總結",
  cta: "行動呼籲",
  spectacle_first_frame: "首格先展示奇觀或結果",
  one_line_rule: "一句交代規則",
  continuous_core_action: "連續呈現核心動作",
  result_or_reaction: "展示結果或真實反應",
  wide_or_cta: "以全景或行動呼籲收結",
  counterintuitive_rule: "反常識規則",
  pre_experience_expectation: "體驗前預期",
  three_to_five_stages: "三至五個體驗階段",
  emotional_low_point: "情緒低點",
  concept_and_sources: "概念及資料來源",
  return_to_ordinary_space: "返回日常空間",
  personal_reflection: "個人反思",
  restrained_cta: "克制的行動呼籲",
  hook_selected_stops_and_close: "主持負責開場、精選站點及收結",
  entrance_and_reaction_optional: "主持可只在進場及反應時出鏡",
  interaction_reaction_and_reflection: "主持以互動、反應及反思推進",
  post_recorded_first_person_after_capture: "拍攝後補錄第一身旁白",
  optional_max_one_rule_and_one_verified_fact: "旁白可省略；最多加入一條規則及一項已核實資料",
  post_recorded_first_person_separating_feeling_venue_claim_and_external_fact: "後錄第一身旁白，清楚分開感受、場地說法及外部事實",
  zh_Hant_written: "書面繁體中文",
  "zh-Hant-written": "書面繁體中文",
  adaptive_middle_lower_safe_zone: "按畫面調整於中下方安全區",
  pending_manual_listening: "待人工逐句聆聽",
  name_location: "名稱及位置",
  distinctive_point: "獨特重點",
  visible_proof: "可見證據",
  bounded_verdict: "有限度評價",
  exterior_or_name: "外觀或名稱",
  environment_wide: "環境全景",
  hero_subject: "主體特寫",
  two_or_three_interactions: "兩至三個互動畫面",
  distinctive_proof: "獨特證據",
  host_reaction_or_pov: "主持反應或第一身視角",
  staff_process_with_permission: "經許可拍攝員工流程",
  relative_location_map: "相對位置地圖",
  category_card: "分類字卡",
  same_action_match_cut: "同一動作配對剪接",
  repeat_same_module_order: "各站沿用相同段落次序",
  "1-2.5s_information_shots": "每個資訊鏡頭約 1 至 2.5 秒",
  hold_process_for_visible_causality: "流程鏡頭保留至因果關係清楚可見",
  transition_by_name_entrance_or_sound: "用名稱、入口或聲音轉場",
  save_list: "收藏清單",
  choose_a_stop: "選擇其中一站",
  share_with_companion: "分享給同行者",
  next_theme: "預告下一個主題",
  door_bell: "門鈴聲",
  packaging: "包裝聲",
  printing: "打印聲",
  page_turn: "翻頁聲",
  craft_action: "製作動作聲",
  name: "名稱",
  address: "地址",
  open_status: "營業狀態",
  branch_count: "分店數目",
  customisation: "客製選項",
  origin: "來源或起源",
  material: "物料",
  price: "價錢",
  celebrity_visit: "名人到訪",
  superlatives: "最高級或絕對化說法",
  show_subject_in_first_frame: "首格即展示主體",
  stable_spectacle_wide: "穩定拍攝奇觀全景",
  action_start: "動作開始",
  continuous_core_take: "完整連續核心鏡頭",
  mechanism_detail: "運作細節",
  result_or_exit: "結果或離場",
  stable_360_reframe: "穩定的 360 度重新構圖",
  preserve_one_continuous_causal_take: "保留一段完整連續因果鏡頭",
  hold_before_and_after_result: "保留結果前後畫面",
  hard_or_action_cuts_only: "只用直接剪接或動作剪接",
  would_you_try: "邀請觀眾回應會否嘗試",
  save_place: "收藏地點",
  follow_next_experience: "追看下一次體驗",
  mechanism: "運作機制",
  location: "地點",
  restrictions: "限制",
  speed: "速度",
  height: "高度",
  records: "紀錄",
  preserve_real_stage_order: "保留真實體驗階段次序",
  stage_name_or_threshold: "階段名稱或門檻",
  body_equipment: "身體或裝備狀態",
  sensory_or_body_proof: "感官或身體證據",
  first_real_reaction: "第一個真實反應",
  venue_claim_source: "場地說法來源",
  venue_entry_or_rules: "場地入口或規則",
  guide_explanation: "導賞解說",
  heartbeat_or_device: "心跳或裝置聲",
  controls: "操作控制",
  friction: "摩擦聲",
  footsteps: "腳步聲",
  breath: "呼吸聲",
  silence: "靜默",
  shout: "叫喊聲",
  laugh: "笑聲",
  repeat_space_action_feeling: "依次呈現空間、動作及感受",
  natural_sound_before_and_after_low_point: "情緒低點前後保留自然聲",
  reduce_music_and_text_at_low_point: "情緒低點減少音樂及文字",
  separate_experience_from_analysis: "清楚分開親身體驗與分析",
  derive_reflection_from_seen_events: "反思須源自片中可見事件",
  missing_name: "缺少名稱",
  missing_proof: "缺少證據",
  under_four_required_types: "必拍類型不足四項",
  no_visit: "未有實地到訪",
  reshoot_or_licensed_official_asset: "補拍或使用已授權官方素材",
  remove_claim: "移除相關說法",
  shorten_or_remove_stop: "縮短或刪除該站",
  route_to_research_list: "改為研究清單",
  missing_full_action: "缺少完整動作",
  missing_reaction: "缺少反應",
  missing_number_source: "缺少數字來源",
  do_not_imply_completion: "不可暗示已完成體驗",
  close_on_result_or_wide: "以結果或全景收結",
  remove_number: "刪除數字",
  missing_complete_stage: "缺少完整階段",
  missing_first_reaction: "缺少第一個真實反應",
  missing_venue_source: "缺少場地資料來源",
  describe_only_observed_content: "只描述實際觀察到的內容",
  label_post_experience_reflection: "標示為體驗後反思",
  remove_origin_or_causal_claim: "移除起源或因果說法",
  privacy_restriction: "私隱限制",
  use_consented_empty_space_or_licensed_diagram: "只用已同意拍攝的空間或已授權圖解",
  question: "提出問題",
  place_or_name: "交代地點或名稱",
  one_change_or_origin: "一項變化或起源",
  two_to_four_visible_artefacts: "二至四項可見實物證據",
  current_state: "現況",
  callback_or_save: "回扣開場或收藏提示",
  entrance_name: "入口及名稱",
  address_or_location_evidence: "地址或位置證據",
  wide: "全景",
  three_details: "三個細節",
  host_visit_evidence_or_original_pov: "主持到訪證據或原創第一身視角",
  first_claim: "首個核心說法",
  year: "年份",
  founder: "創辦人",
  free_claim: "免費相關說法",
  opening_hours: "開放時間",
  travel_time: "交通時間",
  原片說法: "原片說法",
  待核實: "待核實",
};

const hiddenSpecificationKeys = new Set([
  "code",
  "display_name",
  "format",
  "intent",
  "schema_version",
  "core_distribution",
  "reference_classification",
  "preview",
]);

function readableSpecificationLabel(key: string) {
  return specificationLabels[key] ?? specificationValueLabels[key] ?? key.replaceAll("_", " ");
}

function readableSpecificationValue(value: string) {
  if (specificationValueLabels[value]) return specificationValueLabels[value];
  if (/^\d+(?:\.\d+)?-\d+(?:\.\d+)?s(?:_each)?$/.test(value)) {
    return value.replace("_each", "（每段）").replace("s", " 秒");
  }
  if (/^last_/.test(value)) return `最後 ${value.slice(5).replace("s", " 秒")}`;
  return value.replaceAll("_", " ");
}

function SpecificationValue({ value, path = [] }: { value: unknown; path?: string[] }) {
  if (value === null || value === undefined || value === "") return <span className="spec-empty">未提供</span>;
  if (typeof value === "boolean") return <span>{value ? "是" : "否"}</span>;
  if (typeof value === "number") {
    const isSeconds = path.some((key) => key === "duration_seconds" || key === "target_seconds");
    return <span>{value}{isSeconds ? " 秒" : ""}</span>;
  }
  if (typeof value === "string") return <span>{readableSpecificationValue(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="spec-empty">未提供</span>;
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return <ul className="spec-list">{value.map((item, index) => <li key={`${String(item)}-${index}`}>{readableSpecificationValue(String(item))}</li>)}</ul>;
    }
    return <div className="spec-sequence">{value.map((item, index) => <article key={index}><b>第 {index + 1} 段</b><SpecificationValue value={item} path={[...path, String(index)]} /></article>)}</div>;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => !hiddenSpecificationKeys.has(key));
  if (!entries.length) return <span className="spec-empty">未提供</span>;
  return (
    <dl className="spec-grid">
      {entries.map(([key, nestedValue]) => (
        <div key={key} className="spec-field">
          <dt>{readableSpecificationLabel(key)}</dt>
          <dd><SpecificationValue value={nestedValue} path={[...path, key]} /></dd>
        </div>
      ))}
    </dl>
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
  const videoDetailDialogRef = useRef<HTMLDialogElement>(null);
  const videoDetailCloseRef = useRef<HTMLButtonElement>(null);
  const lastVideoStyleTriggerRef = useRef<HTMLButtonElement | null>(null);

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
    // Initial and format-change loading is intentionally coordinated by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    const dialog = videoDetailDialogRef.current;
    if (!selectedVideoStyleCode || !dialog || dialog.open) return;
    dialog.showModal();
    videoDetailCloseRef.current?.focus();
  }, [selectedVideoStyleCode]);
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
  const selectedSpecificationRules = selectedInternalSpecification?.rules ?? selectedPublishedStyle?.version.rules ?? null;

  function openVideoStyle(code: string, trigger: HTMLButtonElement) {
    lastVideoStyleTriggerRef.current = trigger;
    setSelectedVideoStyleCode(code);
  }

  function closeVideoStyle() {
    if (videoDetailDialogRef.current?.open) videoDetailDialogRef.current.close();
    setSelectedVideoStyleCode("");
    window.requestAnimationFrame(() => lastVideoStyleTriggerRef.current?.focus());
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
      setMessage(`原片還原稿已存入 Core：新增 ${payload.insertedCount ?? 0} 項、更新 ${payload.updatedCount ?? 0} 項；正式片可用台詞／字幕 ${payload.publishedUsableSegmentCount ?? 0}/${payload.publishedTimelineSegmentCount ?? 0} 段，待人工音訊核實 ${payload.publishedPendingAudioVerificationCount ?? 0} 段，整段無法辨識 ${payload.publishedUnrecognizableSegmentCount ?? 0} 段，局部缺口 ${payload.publishedPartiallyRecoveredSegmentCount ?? 0} 段；音訊人工逐句核實仍為 0。`);
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
                      onOpen={(trigger) => openVideoStyle(style.code, trigger)}
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
                  onOpen={(trigger) => openVideoStyle(specification.code, trigger)}
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
      {isVideoRegistry && !internalSpecifications.length ? (
        <section className="published-styles internal-specifications">
          <div className="master-actions">
            <button type="button" disabled={importingInternalSpecifications} onClick={() => void importInternalVideoSpecifications()}>
              {importingInternalSpecifications ? "匯入中…" : `匯入已確認${registryFormat === "ai_short_video" ? "AI" : "真人"}短片規格`}
            </button>
          </div>
        </section>
      ) : null}
      {isVideoRegistry && selectedVideoStyleCode ? (
        <dialog
          ref={videoDetailDialogRef}
          className="video-detail-dialog"
          aria-labelledby="video-detail-title"
          onCancel={(event) => {
            event.preventDefault();
            closeVideoStyle();
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeVideoStyle();
          }}
        >
          <div className="video-detail-drawer">
            <header className="video-detail-header">
              <div>
                <small>{registryFormat === "ai_short_video" ? "AI 短片風格" : "真人短片風格"}</small>
                <h2 id="video-detail-title">{selectedInternalSpecification?.name ?? selectedPublishedStyle?.name ?? selectedVideoStyleCode}</h2>
                <p>{selectedInternalSpecification?.description ?? selectedPublishedStyle?.description}</p>
                <div className="selected-style-states">
                  {selectedPublishedStyle ? <b>已發布 v{selectedPublishedStyle.version.number}</b> : <span>Core 內容風格</span>}
                  {selectedInternalSpecification ? <b>規格 v{selectedInternalSpecification.version} · 審閱狀態</b> : null}
                  {selectedInternalSpecification ? <span>尚未接入 Content Studio</span> : null}
                </div>
              </div>
              <button ref={videoDetailCloseRef} type="button" className="video-detail-close" onClick={closeVideoStyle} aria-label="關閉風格詳情">返回內容風格</button>
            </header>

            <div className="video-detail-body">
              <section className="detail-artifact-section" aria-labelledby="restoration-title">
                <div className="detail-section-heading">
                  <div>
                    <small>原片還原稿</small>
                    <h3 id="restoration-title">時間軸、鏡頭與對白</h3>
                    <p>保留原片實際內容及核實狀態；100% 時間軸覆蓋不代表對白、音訊或外部事實已核實。</p>
                  </div>
                  <strong>{selectedRestorations.length} 項</strong>
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
                    <video controls preload="none" poster={videoStyleCover(selectedVideoStyleCode).asset ?? undefined} src={selectedPublishedVideo} aria-label={`${selectedPublishedStyle?.name ?? selectedVideoStyleCode}已發布參考影片`} />
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
                {selectedRestorations.length ? (
                  <div className="restoration-list">
                    {selectedRestorations.map((restoration) => (
                      <details key={restoration.id} className="restoration-card">
                        <summary>
                          <span><b>{restoration.referenceKey}</b><small>{restoration.selection === "full_representative" ? "完整代表片" : "精選片段"}</small></span>
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
                                <p><b>鏡頭描述：</b>{segment.visual_description_zh || "未提供"}</p>
                                <p><b>{segment.speech_original ? "繁體中文翻譯（待核對）：" : "對白／旁白："}</b>{segment.speech_or_narration_zh || "未提供；待人工聆聽"}</p>
                                {segment.speech_original ? <p><b>原文：</b>{segment.speech_original}</p> : null}
                                {segment.speech_raw_asr ? (
                                  <details className="raw-asr">
                                    <summary>查看原始 raw ASR（未核聽）</summary>
                                    <p>{segment.speech_raw_asr}</p>
                                  </details>
                                ) : null}
                                {segment.on_screen_text_zh ? <p><b>畫面文字：</b>{segment.on_screen_text_zh}</p> : null}
                                {segment.notes ? <p><b>備註：</b>{segment.notes}</p> : null}
                              </article>
                            ))}
                          </div>
                          {restoration.unverified.length ? <div className="unverified"><b>尚未核實</b><ul>{restoration.unverified.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : <p className="artifact-empty">此風格未有原片還原稿。</p>}
              </section>

              <section className="detail-artifact-section" aria-labelledby="specification-title">
                <div className="detail-section-heading">
                  <div>
                    <small>風格規格</small>
                    <h3 id="specification-title">製作與內容規格</h3>
                    <p>以繁體中文整理目前版本的敘事、拍攝、字幕、剪接及核實要求。</p>
                  </div>
                </div>
                {selectedSpecificationRules ? <SpecificationValue value={selectedSpecificationRules} /> : <p className="artifact-empty">此風格未有可顯示的規格內容。</p>}
              </section>

              <section className="detail-artifact-section" aria-labelledby="demo-script-title">
                <div className="detail-section-heading">
                  <div>
                    <small>示範劇本</small>
                    <h3 id="demo-script-title">未有示範劇本</h3>
                    <p>目前只有原片還原稿及風格規格，未建立獨立示範劇本。原片內容不會當作示範稿。</p>
                  </div>
                </div>
              </section>

              {registryFormat === "ai_short_video" && selectedPromptSets.length ? (
                <section className="detail-artifact-section prompt-library" aria-labelledby="prompt-title">
                  <div className="detail-section-heading">
                    <div>
                      <small>重建實驗 Prompt</small>
                      <h3 id="prompt-title">模型無關短鏡測試規格</h3>
                      <p>與原片還原稿、風格規格及示範劇本分開保存；目前未生成、未呼叫 API、未使用 credits。</p>
                    </div>
                    <strong>{selectedPromptSets.reduce((sum, item) => sum + item.shotCount, 0)} 鏡／{selectedPromptSets.length} 組</strong>
                  </div>
                  <div className="restoration-list">
                    {selectedPromptSets.map((promptSet) => (
                      <details key={promptSet.id} className="restoration-card">
                        <summary><span><b>{promptSet.referenceKey}</b><small>重建 Prompt</small></span><span>{promptSet.displayName} · v{promptSet.version} {promptSet.status}</span><strong>{promptSet.shotCount} 個短鏡</strong></summary>
                        <div className="restoration-body">
                          <div className="status-grid"><span><b>狀態</b>{promptSet.promptStatus}</span><span><b>執行</b>生成 0／API 0／credits 0</span><span><b>音訊</b>人工逐句核實 0</span></div>
                          <div className="timeline-list">
                            {promptSet.shots.map((shot, index) => (
                              <article key={`${promptSet.id}-${shot.shot_id ?? index}`}>
                                <header><b>{shot.shot_id ?? `鏡頭 ${index + 1}`}</b><span>來源 {Number(shot.source_time?.start_seconds ?? 0).toFixed(2)}–{Number(shot.source_time?.end_seconds ?? 0).toFixed(2)}s</span><span>測試片長 {Number(shot.test_duration_seconds ?? 0).toFixed(2)}s</span></header>
                                <p><b>Prompt：</b>{shot.prompt_zh}</p><p><b>構圖／運鏡：</b>{shot.composition}；{shot.camera_motion}</p><p><b>動作／表情：</b>{shot.action}；{shot.expression}</p><p><b>對白 placeholder：</b>{shot.dialogue_or_narration_placeholder_zh}</p><p><b>聲音後期：</b>{shot.audio_post}</p>
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
            </div>
          </div>
        </dialog>
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
        .video-detail-dialog {
          width: min(820px, calc(100vw - 20px));
          max-width: none;
          height: 100dvh;
          max-height: 100dvh;
          margin: 0 0 0 auto;
          border: 0;
          background: transparent;
          color: #f5f5f5;
          padding: 0;
        }
        .video-detail-dialog::backdrop {
          background: rgba(3, 2, 6, .76);
          backdrop-filter: blur(4px);
        }
        .video-detail-drawer {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          border-left: 1px solid #4c3768;
          background: #100d14;
          box-shadow: -24px 0 60px rgba(0, 0, 0, .45);
        }
        .video-detail-header {
          position: sticky;
          z-index: 3;
          top: 0;
          display: flex;
          justify-content: space-between;
          gap: 22px;
          align-items: flex-start;
          border-bottom: 1px solid #302747;
          background: rgba(16, 13, 20, .96);
          padding: 24px 26px 20px;
          backdrop-filter: blur(12px);
        }
        .video-detail-header h2 {
          margin: 6px 0;
          font-size: 25px;
        }
        .video-detail-header p {
          max-width: 590px;
          margin: 0;
          color: #a39da8;
          font-size: 11px;
          line-height: 1.6;
        }
        .video-detail-close {
          flex: none;
          border: 1px solid #644985;
          border-radius: 9px;
          background: #2a1b3d;
          color: #f3e8ff;
          padding: 9px 12px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }
        .video-detail-close:focus-visible {
          outline: 2px solid #c4b5fd;
          outline-offset: 3px;
        }
        .video-detail-body {
          display: grid;
          gap: 18px;
          padding: 20px 26px 42px;
        }
        .detail-artifact-section {
          border: 1px solid #302b37;
          border-radius: 14px;
          background: #17131b;
          padding: 18px;
        }
        .detail-section-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: end;
          margin-bottom: 14px;
        }
        .detail-section-heading h3 {
          margin: 5px 0;
          font-size: 18px;
        }
        .detail-section-heading p {
          margin: 0;
          color: #999;
          font-size: 10px;
          line-height: 1.55;
        }
        .detail-section-heading > strong {
          color: #c4b5fd;
          font-size: 12px;
        }
        .selected-style-states { display: flex; flex-wrap: wrap; gap: 7px; }
        .selected-style-states > * {
          border-radius: 999px;
          background: #29212f;
          color: #aaa;
          padding: 6px 9px;
          font-size: 9px;
        }
        .selected-style-states b { color: #d8b4fe; }
        .video-detail-header .selected-style-states { margin-top: 12px; }
        .artifact-empty {
          margin: 0;
          border: 1px dashed #3a3152;
          border-radius: 10px;
          color: #8d8991;
          padding: 18px;
          font-size: 11px;
          text-align: center;
        }
        :global(.spec-grid) {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 0;
        }
        :global(.spec-field) {
          min-width: 0;
          border: 1px solid #302b37;
          border-radius: 10px;
          background: #111014;
          padding: 11px;
        }
        :global(.spec-field > dt) {
          margin-bottom: 7px;
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 800;
        }
        :global(.spec-field > dd) {
          margin: 0;
          color: #cbc6cf;
          font-size: 10px;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }
        :global(.spec-field .spec-grid) {
          grid-template-columns: 1fr;
        }
        :global(.spec-list) {
          display: grid;
          gap: 5px;
          margin: 0;
          padding-left: 17px;
        }
        :global(.spec-sequence) {
          display: grid;
          gap: 8px;
        }
        :global(.spec-sequence > article) {
          border-left: 2px solid #6d28d9;
          background: #1c1920;
          padding: 9px;
        }
        :global(.spec-sequence > article > b) {
          display: block;
          margin-bottom: 7px;
          color: #e9d5ff;
        }
        :global(.spec-empty) { color: #77717d; }
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
          .published-reference-list,
          :global(.spec-grid) {
            grid-template-columns: 1fr;
          }
          .video-detail-dialog {
            width: 100vw;
          }
          .video-detail-header {
            align-items: stretch;
            flex-direction: column;
            padding: 20px;
          }
          .video-detail-close { width: 100%; }
          .video-detail-body { padding: 16px 14px 32px; }
          .detail-artifact-section { padding: 14px; }
          .detail-section-heading {
            align-items: flex-start;
            flex-direction: column;
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
