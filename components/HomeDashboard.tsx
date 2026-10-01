"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ControlTowerEditor } from "@/components/ControlTowerEditor";
import { DashboardShell } from "@/components/DashboardShell";
import { UnmatchedDocumentsPanel } from "@/components/UnmatchedDocumentsPanel";

type Status =
  "verified" | "active" | "waiting" | "blocked" | "experiment" | "unknown";
type StateItem = {
  id: string;
  area: string;
  key: string;
  title: string;
  summary: string;
  status: Status;
  value_json: Record<string, unknown>;
  owner: string | null;
  source_ref: string | null;
  evidence_note: string | null;
  checkpoint_at: string | null;
  updated_at: string;
};
type ClientActivity = {
  id: string;
  activity_type: string;
  summary: string;
  outcome: string | null;
  next_action: string | null;
  occurred_at: string;
};
type Client = {
  id: string;
  name: string;
  legal_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  external_ref: string | null;
  stage: string;
  owner: string | null;
  next_action: string | null;
  next_action_at: string | null;
  expected_sign_at: string | null;
  contract_value_minor: number | null;
  effective_monthly_revenue_minor: number | null;
  currency: string;
  term_months: number | null;
  risk_note: string | null;
  evidence_note: string | null;
  updated_at: string;
  last_activity_at: string | null;
  activities: ClientActivity[];
  data_completeness: { score: number; missing: string[] };
};
type UnmatchedDocument = {
  id: string;
  title: string;
  template_type: string | null;
  invoice_client: string | null;
  created_at: string;
};
type BriefAction = {
  actionKey: string;
  sourceType: "client" | "work_order" | "decision";
  sourceId: string;
  title: string;
  dueAt: string | null;
  assignedTo: string | null;
  status: "open" | "deferred";
  decisionId: string | null;
};
type ClientSummary = {
  prospects: number;
  contractPending: number;
  signed: number;
  onboarding: number;
  active: number;
  atRisk: number;
  renewalDue: number;
  retained: number;
  bookedContractValueMinor: number;
  effectiveMrrMinor: number;
};
type DailyBrief = {
  id: string;
  brief_date: string;
  timezone: string;
  change_summary_json: string[];
  alerts_json: Array<{
    alert_key: string;
    kind: string;
    severity: "warning" | "critical";
    title: string;
    detail_json: Record<string, unknown>;
  }>;
  generated_by: "cron" | "admin";
  generated_at: string;
};
type OperationalAlert = {
  id: string;
  alert_key: string;
  kind: string;
  severity: "warning" | "critical";
  title: string;
  detail_json: Record<string, unknown>;
  first_detected_at: string;
  last_seen_at: string;
};
type Data = {
  generatedAt: string;
  sources: Record<string, { status: string; message: string }>;
  metrics: {
    core: Record<string, number | null>;
    brand: Record<string, number | null>;
    egg: Record<string, number | null>;
    commercial: Record<string, number | null>;
  };
  documentAudit: {
    invoices: number;
    invoicesWithClient: number;
    proposals: number;
    proposalsWithClient: number;
    autoMatched: number;
    status: string;
  };
  unmatchedDocuments: UnmatchedDocument[];
  stateItems: StateItem[];
  clients: Client[];
  clientSummary: ClientSummary;
  decisions: Array<{ id: string; title: string; context: string }>;
  workOrders: Array<{
    id: string;
    agent: string;
    title: string;
    scope: string;
    status: Status;
    last_report: string | null;
    updated_at: string;
  }>;
  history: Array<{
    id: string;
    entity_type: string;
    action: string;
    after_json: Record<string, unknown> | null;
    created_at: string;
  }>;
  chiefBrief: {
    priorities: BriefAction[];
    due: BriefAction[];
    waiting: BriefAction[];
    decisions: BriefAction[];
  };
  dailyOperations: {
    latest: DailyBrief | null;
    history: DailyBrief[];
    alerts: OperationalAlert[];
    schedule: string;
  };
  engineeringVerification: {
    label: string;
    code_status: string;
    database_status: string;
    deployment_status: string;
    production_ui_status: string;
    stripe_test_status: string;
    live_payment_status: string;
    created_at: string;
  } | null;
};
const statusMeta: Record<Status, { label: string; color: string }> = {
  verified: { label: "已驗證", color: "#34d399" },
  active: { label: "進行中", color: "#facc15" },
  waiting: { label: "等待中", color: "#fb923c" },
  blocked: { label: "受阻", color: "#f87171" },
  experiment: { label: "實驗中", color: "#38bdf8" },
  unknown: { label: "資料不足", color: "#94a3b8" },
};
const num = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value: unknown) =>
  `HK$${new Intl.NumberFormat("en-HK").format(num(value))}`;

export function HomeDashboard({ afterHero }: { afterHero?: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  async function load(signal?: AbortSignal) {
    const response = await fetch("/api/dashboard", {
      cache: "no-store",
      signal,
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error || "未能載入 Command Center");
    setData(payload);
    setError("");
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "未能載入 Command Center");
        setData(payload);
        setError("");
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setError(
            reason instanceof Error
              ? reason.message
              : "未能載入 Command Center",
          );
      });
    return () => controller.abort();
  }, []);
  const groups = useMemo(
    () =>
      (data?.stateItems ?? []).reduce<Record<string, StateItem[]>>(
        (result, item) => {
          (result[item.area] ??= []).push(item);
          return result;
        },
        {},
      ),
    [data],
  );
  const revenue = groups.revenue?.find(
    (item) => item.key === "september-sales",
  );
  const sales = revenue?.value_json ?? {};
  const target = num(sales.target);
  const signed = data?.clientSummary?.signed ?? 0;
  const pending = data?.clientSummary?.contractPending ?? 0;
  const issues = Object.entries(data?.sources ?? {}).filter(
    ([, source]) => source.status !== "connected",
  );
  return (
    <DashboardShell activeSection="home">
      <main className="command-center">
        <header className="chief-hero">
          <div>
            <div className="eyebrow">
              <i /> SOON 營運中心
            </div>
            <h1>早晨，Tommy。</h1>
            <p>
              公司目前處於客戶驗證階段。首要任務是將待簽合約轉化為正式簽約，並完成商務基礎設施驗證。
            </p>
          </div>
          <div className="hero-meta">
            <span>SOON MASTER CHIEF · v0.2</span>
            <strong>
              {data
                ? new Date(data.generatedAt).toLocaleString("zh-HK")
                : "同步公司狀態中…"}
            </strong>
            <button onClick={() => setEditorOpen(true)}>更新公司狀態</button>
          </div>
        </header>
        {afterHero}
        {error && <div className="chief-error">{error}</div>}
        {issues.length > 0 && (
          <div className="source-warning">
            {issues
              .map(
                ([name, source]) =>
                  `${name.toUpperCase()}：${source.message || source.status}`,
              )
              .join(" · ")}
          </div>
        )}
        <ChiefBrief
          brief={data?.chiefBrief ?? null}
          loading={!data && !error}
          unavailable={Boolean(error)}
          onChanged={() => load()}
        />
        <DailyOperationsPanel
          data={data?.dailyOperations ?? null}
          loading={!data && !error}
          unavailable={Boolean(error)}
          onChanged={() => load()}
        />
        <section className="command-panel revenue">
          <Heading
            n="01"
            title="9 月銷售進程"
            aside={<Pill status={revenue?.status ?? "unknown"} />}
          />
          <div className="sales-grid">
            <Metric
              label="客戶目標"
              value={target || "—"}
              note="September target"
            />
            <Metric
              label="已簽合約"
              value={signed}
              note="由 Roster 階段計算"
              accent="#34d399"
            />
            <Metric
              label="合約待簽"
              value={pending}
              note="口頭確認不等於正式簽約"
              accent="#facc15"
            />
            <Metric
              label="尚欠正式簽約"
              value={Math.max(target - signed, 0)}
              note={`距離 ${target || "—"} 位客戶`}
              accent="#f87171"
            />
            <Metric
              label="已鎖定合約值"
              value={minorMoney(
                data?.clientSummary?.bookedContractValueMinor ?? 0,
                "HKD",
              )}
              note="Roster 已簽客戶合計"
            />
            <Metric
              label="有效 MRR"
              value={minorMoney(
                data?.clientSummary?.effectiveMrrMinor ?? 0,
                "HKD",
              )}
              note="Roster 有效收入合計"
            />
          </div>
          <div className="progress">
            <i
              style={{
                width: `${target ? Math.min(100, (signed / target) * 100) : 0}%`,
              }}
            />
          </div>
          <small className="evidence">
            客戶數、合約值及 MRR 以 Client Roster 為單一來源 · 目標來源：
            {revenue?.source_ref ?? "未設定"}
          </small>
        </section>
        <ClientPanel
          clients={data?.clients ?? []}
          summary={data?.clientSummary}
          commercial={data?.metrics?.commercial}
          documentAudit={data?.documentAudit}
          onChanged={() => load()}
        />
        {data && (
          <UnmatchedDocumentsPanel
            documents={data.unmatchedDocuments}
            clients={data.clients}
            onChanged={() => load()}
          />
        )}
        {data && (
          <section className="command-panel">
            <Heading
              n="360"
              title="客戶全貌"
              aside="身份 · Pipeline · 文件 · Timeline · Audit"
            />
            <div className="quick-links">
              {data.clients.map((client) => (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  {client.legal_name || client.name} →
                </Link>
              ))}
            </div>
          </section>
        )}
        <div className="command-grid">
          <Panel
            n="02"
            title="產品與工程"
            aside={`${groups.product?.length ?? 0} 條產品線`}
            items={groups.product}
          />
          <Panel
            n="03"
            title="增長實驗"
            aside="只顯示真實驗證"
            items={groups.experiment}
          />
        </div>
        <div className="command-grid">
          <Panel
            n="04"
            title="等待事項"
            aside={`${groups.waiting?.length ?? 0} 項`}
            items={groups.waiting}
          />
          <section className="command-panel">
            <Heading
              n="05"
              title="Tommy 決策"
              aside={`${data?.decisions?.length ?? 0} 項待決定`}
            />
            {data?.decisions?.length ? (
              <div className="rows">
                {data.decisions.map((item) => (
                  <article className="decision" key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.context}</p>
                  </article>
                ))}
              </div>
            ) : (
              <Empty text="目前沒有需要 Tommy 決定的事項" />
            )}
          </section>
        </div>
        <section className="command-panel">
          <Heading n="06" title="AI 工作管理" aside="最近工作指令" />
          <div className="orders">
            {(data?.workOrders ?? []).map((order) => (
              <article key={order.id}>
                <div>
                  <span>{order.agent.toUpperCase()}</span>
                  <Pill status={order.status} />
                </div>
                <h3>{order.title}</h3>
                <p>{order.scope}</p>
                <footer>
                  {order.last_report ?? "未有報告"} ·{" "}
                  {new Date(order.updated_at).toLocaleString("zh-HK")}
                </footer>
              </article>
            ))}
          </div>
        </section>
        <VerificationPanel verification={data?.engineeringVerification} />
        <section className="command-panel">
          <Heading n="07" title="系統脈搏" aside="即時來源數據" />
          <div className="pulse-grid">
            <Mini
              label="已發布題材"
              value={data?.metrics?.core?.topicsPublished}
            />
            <Mini
              label="內容方向"
              value={data?.metrics?.core?.contentDirections}
            />
            <Mini label="內容方法" value={data?.metrics?.core?.contentMethods} />
            <Mini
              label="宣傳企劃經驗"
              value={data?.metrics?.core?.campaignLearnings}
            />
            <Mini label="內容項目" value={data?.metrics?.core?.projects} />
            <Mini
              label="未處理情報"
              value={data?.metrics?.core?.openIntelligence}
            />
            <Mini label="品牌" value={data?.metrics?.brand?.brands} />
            <Mini label="Creators" value={data?.metrics?.egg?.creators} />
          </div>
          <div className="quick-links">
            <Link href="/intelligence-inbox">處理情報 →</Link>
            <Link href="/content-directions">內容方向 →</Link>
            <Link href="/campaign-experiences">宣傳企劃經驗 →</Link>
            <Link href="/intelligence">成效情報 →</Link>
          </div>
        </section>
      </main>
      {data && (
        <ControlTowerEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSaved={() => load()}
          items={data.stateItems}
          clients={data.clients}
          decisions={data.decisions}
          orders={data.workOrders}
          history={data.history}
        />
      )}
      <style jsx global>{`
        ${styles}${widthFixStyles}${rosterStyles}${briefStyles}${actionStyles}${dailyStyles}${clientOpsStyles}
      `}</style>
    </DashboardShell>
  );
}

function Pill({ status }: { status: Status }) {
  const meta = statusMeta[status] ?? statusMeta.unknown;
  return (
    <span
      className="status-pill"
      style={{ "--status": meta.color } as React.CSSProperties}
    >
      <i />
      {meta.label}
    </span>
  );
}
function Metric({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string | number;
  note: string;
  accent?: string;
}) {
  return (
    <article className="chief-metric">
      <span>{label}</span>
      <strong style={{ color: accent }}>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function Heading({
  n,
  title,
  aside,
}: {
  n: string;
  title: string;
  aside: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <span>{n}</span>
        <h2>{title}</h2>
      </div>
      <aside>{aside}</aside>
    </div>
  );
}
function ChiefBrief({
  brief,
  loading,
  unavailable,
  onChanged,
}: {
  brief: Data["chiefBrief"] | null;
  loading: boolean;
  unavailable: boolean;
  onChanged: () => Promise<void>;
}) {
  const blocks = [
    {
      key: "priority",
      title: "今日優先",
      description: "待簽合約及受阻工作",
      items: brief?.priorities ?? [],
    },
    {
      key: "due",
      title: "24 小時內到期",
      description: "即將到期的跟進與決策",
      items: brief?.due ?? [],
    },
    {
      key: "waiting",
      title: "等待外部回覆",
      description: "暫時依賴其他人處理",
      items: brief?.waiting ?? [],
    },
    {
      key: "decision",
      title: "需要 Tommy 決定",
      description: "仍未完成的管理決策",
      items: brief?.decisions ?? [],
    },
  ];
  return (
    <section className="command-panel chief-brief">
      <div className="ops-section-head">
        <div>
          <span>即時行動清單</span>
          <h2>營運總管摘要</h2>
          <p>根據目前客戶、工作指令及待決事項，即時計算今天需要處理的行動。</p>
        </div>
        <small>完成、延期及指派操作均會保留審計記錄</small>
      </div>
      <div className="chief-brief-grid">
        {blocks.map((block) => (
          <article key={block.key}>
            <header>
              <div>
                <strong>{block.title}</strong>
                <small>{block.description}</small>
              </div>
              <b>{loading ? "—" : block.items.length}</b>
            </header>
            {loading ? (
              <BriefSkeleton />
            ) : unavailable ? (
              <div className="brief-empty warning">
                <span>!</span>
                <p>暫時未能讀取行動資料</p>
              </div>
            ) : block.items.length ? (
              <div className="brief-action-list">
                {block.items.map((item) => (
                  <BriefActionRow
                    key={item.actionKey}
                    item={item}
                    onChanged={onChanged}
                  />
                ))}
              </div>
            ) : (
              <div className="brief-empty">
                <span>✓</span>
                <p>目前沒有項目</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
function DailyOperationsPanel({
  data,
  loading,
  unavailable,
  onChanged,
}: {
  data: Data["dailyOperations"] | null;
  loading: boolean;
  unavailable: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/control-tower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "generate_daily_operations" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "生成失敗");
      await onChanged();
      setMessage("今日快照已更新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失敗");
    } finally {
      setBusy(false);
    }
  }
  const latest = data?.latest ?? null;
  const alerts = data?.alerts ?? [];
  const history = data?.history ?? [];
  return (
    <section className="command-panel daily-ops">
      <div className="ops-section-head">
        <div>
          <span>每日狀態快照</span>
          <h2>每日營運循環</h2>
          <p>每天保存一次公司狀態，比較前一天的變化，並更新逾期或停滯警示。</p>
        </div>
        <small>{data?.schedule ?? "每日 07:00 UTC 自動執行"}</small>
      </div>
      <div className="daily-ops-head">
        <div>
          <span className={`daily-status-dot ${latest ? "ready" : ""}`} />
          <div>
            <strong>
              {loading
                ? "正在讀取最新快照…"
                : latest
                  ? `${latest.brief_date} 營運快照`
                  : "尚未建立每日快照"}
            </strong>
            <small>
              {loading
                ? "畫面會在資料返回後自動更新"
                : latest
                  ? `${latest.generated_by === "cron" ? "系統自動" : "人工"}建立 · ${new Date(latest.generated_at).toLocaleString("zh-HK")}`
                  : unavailable
                    ? "暫時未能讀取快照資料"
                    : "按右方按鈕即可建立第一個快照"}
            </small>
          </div>
        </div>
        <button disabled={busy || loading} onClick={() => void generate()}>
          {busy ? "生成中…" : "立即更新今日快照"}
        </button>
      </div>
      <div className="daily-ops-grid">
        <article>
          <header>
            <span>01</span>
            <div>
              <strong>與上一個快照比較</strong>
              <small>客戶階段、收入、行動及警示變化</small>
            </div>
          </header>
          {loading ? (
            <BriefSkeleton />
          ) : latest?.change_summary_json?.length ? (
            <ul>
              {latest.change_summary_json.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="daily-empty">尚未有可比較資料</p>
          )}
        </article>
        <article>
          <header>
            <span>02</span>
            <div>
              <strong>逾期與停滯警示</strong>
              <small>客戶跟進、簽署、工作與決策</small>
            </div>
          </header>
          {loading ? (
            <BriefSkeleton />
          ) : alerts.length ? (
            <div className="ops-alerts">
              {alerts.map((alert) => (
                <div key={alert.id} className={alert.severity}>
                  <span>{alert.severity === "critical" ? "嚴重" : "注意"}</span>
                  <p>{alert.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="daily-empty success">✓ 目前沒有逾期或停滯警示</p>
          )}
        </article>
        <article>
          <header>
            <span>03</span>
            <div>
              <strong>最近 7 個快照</strong>
              <small>保留每日營運變化記錄</small>
            </div>
          </header>
          {loading ? (
            <BriefSkeleton />
          ) : history.length ? (
            <ul>
              {history.map((item) => (
                <li key={item.id}>
                  {item.brief_date} ·{" "}
                  {item.generated_by === "cron" ? "自動" : "人工"} ·{" "}
                  {item.change_summary_json.length} 項變化
                </li>
              ))}
            </ul>
          ) : (
            <p className="daily-empty">尚未有快照歷史</p>
          )}
        </article>
      </div>
      {message && <small className="daily-message">{message}</small>}
    </section>
  );
}

function BriefSkeleton() {
  return (
    <div className="brief-skeleton" aria-label="正在載入" aria-busy="true">
      <i />
      <i />
      <i />
    </div>
  );
}
function BriefActionRow({
  item,
  onChanged,
}: {
  item: BriefAction;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"idle" | "assign" | "defer">("idle"),
    [value, setValue] = useState(item.assignedTo ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act(
    verb: "complete" | "defer" | "assign" | "convert_decision",
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/control-tower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "update_brief_action",
          verb,
          action_key: item.actionKey,
          source_type: item.sourceType,
          source_id: item.sourceId,
          title: item.title,
          current_assignee: item.assignedTo,
          current_due_at: item.dueAt,
          assigned_to: verb === "assign" ? value : null,
          due_at: verb === "defer" ? value : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "更新失敗");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="brief-action">
      <div>
        <span>{item.title}</span>
        <small>
          {item.assignedTo || "未指派"}
          {item.dueAt
            ? ` · ${new Date(item.dueAt).toLocaleString("zh-HK")}`
            : ""}
          {item.status === "deferred" ? " · 已延期" : ""}
        </small>
      </div>
      <div className="brief-buttons">
        <button disabled={busy} onClick={() => void act("complete")}>
          完成
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setMode("defer");
            setValue(item.dueAt?.slice(0, 16) ?? "");
          }}
        >
          延期
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setMode("assign");
            setValue(item.assignedTo ?? "");
          }}
        >
          指派
        </button>
        {item.sourceType !== "decision" && (
          <button disabled={busy} onClick={() => void act("convert_decision")}>
            轉決策
          </button>
        )}
      </div>
      {mode !== "idle" && (
        <div className="brief-inline">
          <input
            type={mode === "defer" ? "datetime-local" : "text"}
            value={value}
            placeholder={mode === "assign" ? "負責人" : ""}
            onChange={(event) => setValue(event.target.value)}
          />
          <button disabled={busy || !value} onClick={() => void act(mode)}>
            確認
          </button>
          <button onClick={() => setMode("idle")}>取消</button>
        </div>
      )}
      {error && <small className="brief-error">{error}</small>}
    </div>
  );
}
function VerificationPanel({
  verification,
}: {
  verification: Data["engineeringVerification"] | undefined;
}) {
  const checks = verification
    ? [
        ["CODE", verification.code_status],
        ["DATABASE", verification.database_status],
        ["DEPLOYMENT", verification.deployment_status],
        ["PRODUCTION UI", verification.production_ui_status],
        ["STRIPE TEST", verification.stripe_test_status],
        ["LIVE PAYMENT", verification.live_payment_status],
      ]
    : [];
  return (
    <section className="command-panel">
      <Heading
        n="VERIFY"
        title="工程驗證"
        aside={
          verification
            ? `${verification.label} · ${new Date(verification.created_at).toLocaleString("zh-HK")}`
            : "未有驗證記錄"
        }
      />
      {checks.length ? (
        <div className="verification-grid">
          {checks.map(([label, status]) => (
            <article key={label}>
              <span>{label}</span>
              <strong className={status.toLowerCase().replace("_", "-")}>
                {status}
              </strong>
            </article>
          ))}
        </div>
      ) : (
        <Empty text="部署後會寫入首個可審計驗證記錄" />
      )}
    </section>
  );
}
function Panel({
  n,
  title,
  aside,
  items,
}: {
  n: string;
  title: string;
  aside: string;
  items?: StateItem[];
}) {
  return (
    <section className="command-panel">
      <Heading n={n} title={title} aside={aside} />
      {items?.length ? (
        <div className="rows">
          {items.map((item) => (
            <article className="state-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.owner ?? "未設定負責人"}</small>
              </div>
              <p>{item.summary}</p>
              <Pill status={item.status} />
            </article>
          ))}
        </div>
      ) : (
        <Empty text="目前未有項目" />
      )}
    </section>
  );
}
function ClientPanel({
  clients,
  summary,
  commercial,
  documentAudit,
  onChanged,
}: {
  clients: Client[];
  summary?: ClientSummary;
  commercial?: Record<string, number | null>;
  documentAudit?: Data["documentAudit"];
  onChanged: () => Promise<void>;
}) {
  const stages = [
    "prospect",
    "contract_pending",
    "signed",
    "onboarding",
    "active",
    "at_risk",
    "renewal_due",
    "retained",
  ] as const;
  return (
    <section className="command-panel">
      <Heading
        n="02"
        title="客戶 Pipeline"
        aside={`${clients.length} 個可審計記錄 · Roster 單一來源`}
      />
      <div className="sales-grid">
        <Metric
          label="潛在客戶"
          value={summary?.prospects ?? 0}
          note="有獨立客戶記錄"
        />
        <Metric
          label="合約待簽"
          value={summary?.contractPending ?? 0}
          note="未簽約不會計作成交"
          accent="#facc15"
        />
        <Metric
          label="已簽約"
          value={summary?.signed ?? 0}
          note="包含後續服務階段"
          accent="#34d399"
        />
        <Metric
          label="啟動準備"
          value={summary?.onboarding ?? 0}
          note="已簽，準備交付"
        />
        <Metric label="服務中" value={summary?.active ?? 0} note="服務進行中" />
        <Metric label="有風險" value={summary?.atRisk ?? 0} note="需要跟進" />
      </div>
      <div className="pipeline-board">
        {stages.map((stage) => (
          <section key={stage}>
            <header>
              <strong>{clientStageLabel[stage]}</strong>
              <span>
                {clients.filter((client) => client.stage === stage).length}
              </span>
            </header>
            <div>
              {clients
                .filter((client) => client.stage === stage)
                .map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onChanged={onChanged}
                  />
                ))}
              {!clients.some((client) => client.stage === stage) && (
                <p className="pipeline-empty">—</p>
              )}
            </div>
          </section>
        ))}
      </div>
      <div className="document-audit">
        <div>
          <strong>文件客戶配對審計</strong>
          <p>
            發票：{documentAudit?.invoices ?? 0}（有客戶識別：
            {documentAudit?.invoicesWithClient ?? 0}） · 提案／報價單：
            {documentAudit?.proposals ?? 0}（有客戶識別：
            {documentAudit?.proposalsWithClient ?? 0}）
          </p>
        </div>
        <span>自動配對 {documentAudit?.autoMatched ?? 0}</span>
        <small>
          文件配對以客戶識別資料及審計記錄為準；宣傳企劃經驗不會被誤當為提案。
        </small>
      </div>
      <div className="pulse-grid" style={{ marginTop: 12 }}>
        <Mini label="提案／報價單" value={commercial?.proposals} />
        <Mini label="已付款發票" value={commercial?.paidInvoices} />
        <Mini label="待收款發票" value={commercial?.outstandingInvoices} />
        <Mini label="逾期發票" value={commercial?.overdueInvoices} />
        <Mini label="已收 HKD" value={commercial?.paidAmountHkd} />
        <Mini label="應收 HKD" value={commercial?.outstandingAmountHkd} />
      </div>
      <small className="evidence">
        客戶名冊是客戶階段、簽約狀態、合約值及有效每月經常收入（MRR）的唯一資料來源；完整度只按已填寫欄位計算，不會估算未知資料。
      </small>
    </section>
  );
}
function ClientCard({
  client,
  onChanged,
}: {
  client: Client;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<
      "quick" | "complete" | "activity" | "timeline" | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [stage, setStage] = useState(client.stage),
    [name, setName] = useState(client.name),
    [owner, setOwner] = useState(client.owner ?? ""),
    [nextAction, setNextAction] = useState(client.next_action ?? ""),
    [nextAt, setNextAt] = useState(client.next_action_at?.slice(0, 16) ?? ""),
    [signAt, setSignAt] = useState(client.expected_sign_at?.slice(0, 16) ?? ""),
    [value, setValue] = useState(
      client.contract_value_minor == null
        ? ""
        : String(client.contract_value_minor / 100),
    ),
    [mrr, setMrr] = useState(
      client.effective_monthly_revenue_minor == null
        ? ""
        : String(client.effective_monthly_revenue_minor / 100),
    ),
    [evidence, setEvidence] = useState(client.evidence_note ?? ""),
    [activityType, setActivityType] = useState("call"),
    [activitySummary, setActivitySummary] = useState(""),
    [outcome, setOutcome] = useState("");
  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/control-tower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "更新失敗");
      await onChanged();
      setMode(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="pipeline-client">
      <div className="client-card-head">
        <strong>{client.name}</strong>
        <span className={client.data_completeness.score < 60 ? "low" : ""}>
          {client.data_completeness.score}%
        </span>
      </div>
      <p>{client.next_action || "尚未設定下一步"}</p>
      <small>
        {client.owner || "未指派"} ·{" "}
        {client.contract_value_minor == null
          ? "金額待補"
          : minorMoney(client.contract_value_minor, client.currency)}
      </small>
      {client.data_completeness.missing.length > 0 && (
        <small className="client-missing">
          欠：{client.data_completeness.missing.join("、")}
        </small>
      )}
      <div className="client-actions">
        <button onClick={() => setMode(mode === "quick" ? null : "quick")}>
          快速更新
        </button>
        <button
          onClick={() => setMode(mode === "activity" ? null : "activity")}
        >
          ＋活動
        </button>
        <button
          onClick={() => setMode(mode === "timeline" ? null : "timeline")}
        >
          Timeline {client.activities.length}
        </button>
        {client.data_completeness.score < 100 && (
          <button
            className="fill"
            onClick={() => setMode(mode === "complete" ? null : "complete")}
          >
            補資料
          </button>
        )}
      </div>
      {mode === "quick" && (
        <form
          className="client-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit({
              operation: "quick_update_client",
              id: client.id,
              stage,
              next_action: nextAction,
              next_action_at: nextAt || null,
              expected_sign_at: signAt || null,
            });
          }}
        >
          <label>
            階段
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              {Object.entries(clientStageLabel)
                .filter(([key]) => key !== "lost")
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            下一步
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </label>
          <label>
            跟進日
            <input
              type="datetime-local"
              value={nextAt}
              onChange={(event) => setNextAt(event.target.value)}
            />
          </label>
          {stage === "contract_pending" && (
            <label>
              預計簽署
              <input
                type="datetime-local"
                value={signAt}
                onChange={(event) => setSignAt(event.target.value)}
              />
            </label>
          )}
          <button disabled={busy}>{busy ? "儲存中…" : "儲存"}</button>
        </form>
      )}
      {mode === "complete" && (
        <form
          className="client-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit({
              operation: "upsert_client",
              id: client.id,
              name,
              stage,
              owner,
              next_action: nextAction,
              next_action_at: nextAt || null,
              expected_sign_at: signAt || null,
              contract_value_hkd: value === "" ? null : Number(value),
              effective_mrr_hkd: mrr === "" ? null : Number(mrr),
              currency: "HKD",
              evidence_note: evidence,
            });
          }}
        >
          <label>
            客戶名稱
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            負責人
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            />
          </label>
          <label>
            下一步
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </label>
          <label>
            跟進日
            <input
              type="datetime-local"
              value={nextAt}
              onChange={(event) => setNextAt(event.target.value)}
            />
          </label>
          <label>
            預計簽署
            <input
              type="datetime-local"
              value={signAt}
              onChange={(event) => setSignAt(event.target.value)}
            />
          </label>
          <label>
            合約值 HKD
            <input
              type="number"
              min="0"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <label>
            有效 MRR HKD
            <input
              type="number"
              min="0"
              value={mrr}
              onChange={(event) => setMrr(event.target.value)}
            />
          </label>
          <label>
            證據／備註
            <textarea
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
            />
          </label>
          <button disabled={busy}>
            {busy ? "儲存中…" : "儲存並重算完整度"}
          </button>
        </form>
      )}
      {mode === "activity" && (
        <form
          className="client-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit({
              operation: "create_client_activity",
              client_id: client.id,
              activity_type: activityType,
              summary: activitySummary,
              outcome,
              next_action: nextAction,
              next_action_at: nextAt || null,
            });
          }}
        >
          <label>
            類型
            <select
              value={activityType}
              onChange={(event) => setActivityType(event.target.value)}
            >
              {[
                ["call", "電話"],
                ["meeting", "會議"],
                ["email", "Email"],
                ["proposal", "提案"],
                ["follow_up", "跟進"],
                ["reply", "客戶回覆"],
                ["note", "備註"],
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            內容
            <textarea
              value={activitySummary}
              onChange={(event) => setActivitySummary(event.target.value)}
              required
            />
          </label>
          <label>
            結果
            <input
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            />
          </label>
          <label>
            下一步
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </label>
          <label>
            跟進日
            <input
              type="datetime-local"
              value={nextAt}
              onChange={(event) => setNextAt(event.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? "記錄中…" : "加入 Timeline"}</button>
        </form>
      )}
      {mode === "timeline" && (
        <div className="client-timeline">
          {client.activities.length ? (
            client.activities.slice(0, 8).map((activity) => (
              <div key={activity.id}>
                <span>
                  {activityLabel[activity.activity_type] ??
                    activity.activity_type}
                </span>
                <p>{activity.summary}</p>
                <small>
                  {new Date(activity.occurred_at).toLocaleString("zh-HK")}
                </small>
              </div>
            ))
          ) : (
            <p>暫時未有活動。</p>
          )}
        </div>
      )}
      {error && <small className="client-error">{error}</small>}
    </article>
  );
}
const activityLabel: Record<string, string> = {
  call: "電話",
  meeting: "會議",
  email: "Email",
  proposal: "提案",
  follow_up: "跟進",
  reply: "客戶回覆",
  note: "備註",
  stage_change: "階段變更",
};
const clientStageLabel: Record<string, string> = {
  prospect: "Prospect",
  contract_pending: "合約待簽",
  signed: "已簽",
  onboarding: "啟動準備",
  active: "服務中",
  at_risk: "有風險",
  renewal_due: "待續約",
  retained: "已續約",
  lost: "Lost",
};
const minorMoney = (value: number, currency: string) =>
  `${currency} ${new Intl.NumberFormat("en-HK").format(value / 100)}`;
function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
function Mini({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <article className="mini-stat">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </article>
  );
}

const widthFixStyles = `.command-center{grid-template-columns:minmax(0,1fr)}`;
const rosterStyles = `.client-roster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.client-roster article{border:1px solid #292832;border-radius:12px;background:#0f0f14;padding:14px}.client-roster article>div{display:flex;justify-content:space-between;gap:12px}.client-roster strong{font-size:12px}.client-roster article span{color:#facc15;font-size:9px}.client-roster p{min-height:32px;margin:9px 0;color:#85818f;font-size:10px;line-height:1.5}.client-roster footer{color:#5f5b68;font-size:9px}@media(max-width:700px){.client-roster{grid-template-columns:1fr}}`;
const briefStyles = `.ops-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;margin-bottom:22px}.ops-section-head>div>span{color:#a78bfa;font-size:10px;font-weight:800;letter-spacing:.16em}.ops-section-head h2{margin:7px 0 6px;font-size:22px}.ops-section-head p{max-width:680px;margin:0;color:#8f8a9b;font-size:12px;line-height:1.65}.ops-section-head>small{max-width:290px;color:#696574;font-size:10px;line-height:1.55;text-align:right}.chief-brief-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.chief-brief-grid>article{min-height:185px;border:1px solid #2c2a35;border-radius:14px;background:linear-gradient(145deg,#111117,#0d0d12);padding:17px}.chief-brief-grid>article>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid #26242e;padding-bottom:13px}.chief-brief-grid header strong{display:block;color:#eeeaf7;font-size:14px}.chief-brief-grid header small{display:block;margin-top:5px;color:#706b7a;font-size:10px}.chief-brief-grid header b{display:grid;min-width:28px;height:28px;place-items:center;border-radius:9px;background:#251d34;color:#c4b5fd;font-size:12px}.brief-empty{display:grid;min-height:92px;place-items:center;align-content:center;gap:7px;color:#777280}.brief-empty span{display:grid;width:24px;height:24px;place-items:center;border-radius:50%;background:#153126;color:#6ee7b7;font-size:11px}.brief-empty p{margin:0;font-size:11px}.brief-empty.warning span{background:#3a2515;color:#fbbf24}.brief-skeleton{display:grid;gap:9px;margin-top:18px}.brief-skeleton i{height:10px;border-radius:20px;background:linear-gradient(90deg,#22202a 20%,#302b3c 50%,#22202a 80%);background-size:220% 100%;animation:brief-shimmer 1.3s ease-in-out infinite}.brief-skeleton i:nth-child(2){width:82%}.brief-skeleton i:nth-child(3){width:58%}@keyframes brief-shimmer{to{background-position:-220% 0}}.verification-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.verification-grid article{border:1px solid #292832;border-radius:11px;background:#0f0f14;padding:13px}.verification-grid span{display:block;color:#777485;font-size:9px}.verification-grid strong{display:block;margin-top:9px;font-size:12px}.verification-grid .pass{color:#34d399}.verification-grid .fail{color:#f87171}.verification-grid .not-tested{color:#94a3b8}@media(prefers-reduced-motion:reduce){.brief-skeleton i{animation:none}}@media(max-width:900px){.ops-section-head{display:grid}.ops-section-head>small{text-align:left}.chief-brief-grid{grid-template-columns:1fr}.verification-grid{grid-template-columns:repeat(3,1fr)}}`;
const actionStyles = `.brief-action-list{display:grid;gap:11px;margin-top:14px}.brief-action{display:grid;gap:10px;border-top:1px solid #292832;padding-top:12px}.brief-action:first-child{border-top:0;padding-top:0}.brief-action>div:first-child span{display:block;color:#e8e5ed;font-size:12px;line-height:1.5}.brief-action small{display:block;margin-top:5px;color:#777180;font-size:10px}.brief-buttons{display:flex;flex-wrap:wrap;gap:6px}.brief-buttons button,.brief-inline button{border:1px solid #3b3349;border-radius:7px;background:#1b1722;color:#b9b1c5;padding:7px 9px;font-size:10px}.brief-buttons button:hover,.brief-inline button:hover{border-color:#7c3aed;color:#d8b4fe}.brief-inline{display:flex;gap:6px}.brief-inline input{min-width:0;flex:1;border:1px solid #302e38;border-radius:7px;background:#19191f;color:#eee;padding:8px;font-size:10px}.brief-error{color:#f87171!important}.pipeline-board{display:grid;grid-template-columns:repeat(8,minmax(155px,1fr));gap:8px;margin-top:14px;overflow-x:auto;padding-bottom:6px}.pipeline-board>section{min-height:145px;border:1px solid #292832;border-radius:12px;background:#0d0d12;padding:10px}.pipeline-board header{display:flex;justify-content:space-between;color:#a9a4b3;font-size:9px}.pipeline-board header span{border-radius:999px;background:#25202f;color:#c4b5fd;padding:2px 6px}.pipeline-board section>div{display:grid;gap:7px;margin-top:10px}.pipeline-board article{border:1px solid #282530;border-radius:8px;background:#17151d;padding:9px}.pipeline-board article strong{font-size:9px}.pipeline-board article p{margin:6px 0;color:#837e8d;font-size:8px;line-height:1.4}.pipeline-board article small{color:#5d5965;font-size:7px}.pipeline-empty{margin:20px 0;text-align:center;color:#494650}.tower-source-note{margin:0;border:1px solid #30294a;border-radius:8px;background:#191523;color:#a99ac1;padding:9px;font-size:9px;line-height:1.5}@media(max-width:900px){.pipeline-board{grid-template-columns:repeat(8,155px)}}`;
const dailyStyles = `.daily-ops-head{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1px solid #302b3c;border-radius:14px;background:#100f16;padding:16px 18px}.daily-ops-head>div{display:flex;align-items:center;gap:11px}.daily-status-dot{width:9px;height:9px;flex:0 0 auto;border-radius:50%;background:#696574;box-shadow:0 0 0 5px rgba(105,101,116,.1)}.daily-status-dot.ready{background:#34d399;box-shadow:0 0 0 5px rgba(52,211,153,.1)}.daily-ops-head strong{display:block;font-size:14px}.daily-ops-head small{display:block;margin-top:5px;color:#777180;font-size:10px}.daily-ops-head button{border:1px solid #5c4380;border-radius:9px;background:linear-gradient(135deg,#2b1d3f,#21172f);color:#d8b4fe;padding:10px 13px;font-size:10px;font-weight:700}.daily-ops-head button:disabled{cursor:wait;opacity:.55}.daily-ops-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}.daily-ops-grid>article{min-height:190px;border:1px solid #2c2a35;border-radius:14px;background:#0f0f14;padding:17px}.daily-ops-grid article>header{display:flex;align-items:flex-start;gap:10px;border-bottom:1px solid #26242e;padding-bottom:13px}.daily-ops-grid article>header>span{color:#a78bfa;font-size:9px;font-weight:800;letter-spacing:.12em}.daily-ops-grid article>header strong{display:block;color:#eeeaf7;font-size:13px}.daily-ops-grid article>header small{display:block;margin-top:5px;color:#6f6a78;font-size:9px;line-height:1.4}.daily-ops-grid ul{display:grid;gap:8px;margin:14px 0 0;padding-left:18px}.daily-ops-grid li{color:#a29daa;font-size:11px;line-height:1.55}.daily-empty{display:grid;min-height:100px;place-items:center;margin:0;color:#777280;font-size:11px;text-align:center}.daily-empty.success{color:#6ee7b7}.ops-alerts{display:grid;gap:8px;margin-top:13px}.ops-alerts>div{display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:center;border:1px solid #342d28;border-radius:8px;background:#1c1816;padding:9px}.ops-alerts span{color:#fbbf24;font-size:9px;font-weight:700}.ops-alerts .critical span{color:#f87171}.ops-alerts p{margin:0;color:#c1bac6;font-size:11px}.daily-message{display:block;margin-top:10px;color:#86efac;font-size:10px}.client-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}.client-card-head>span{border-radius:999px;background:#163225;color:#6ee7b7;padding:2px 5px;font-size:7px}.client-card-head>span.low{background:#3a1d1d;color:#fca5a5}.client-missing{display:block;margin-top:6px!important;color:#a88b77!important;line-height:1.4}@media(max-width:900px){.daily-ops-head{align-items:flex-start;flex-direction:column}.daily-ops-grid{grid-template-columns:1fr}}`;
const clientOpsStyles = `.client-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.client-actions button{border:1px solid #312b3c;border-radius:5px;background:#131218;color:#85808e;padding:4px 5px;font-size:7px}.client-actions button.fill{border-color:#523c1f;color:#fbbf24}.client-inline-form{display:grid!important;gap:6px!important;margin-top:9px!important;border-top:1px solid #302c36;padding-top:8px}.client-inline-form label{display:grid;gap:3px;color:#77717f;font-size:7px}.client-inline-form input,.client-inline-form select,.client-inline-form textarea{min-width:0;width:100%;border:1px solid #302e38;border-radius:5px;background:#0e0e13;color:#eee;padding:6px;font-size:8px}.client-inline-form button{border:0;border-radius:6px;background:#6d28d9;color:#fff;padding:6px;font-size:8px}.client-timeline{display:grid!important;gap:5px!important;margin-top:8px!important;border-top:1px solid #302c36;padding-top:8px}.client-timeline>div{border-left:2px solid #4c3b69;padding-left:7px}.client-timeline span{color:#a78bfa;font-size:7px}.client-timeline p{margin:3px 0!important;color:#aaa4b1!important}.client-timeline small{font-size:7px!important}.client-error{display:block;margin-top:6px!important;color:#f87171!important}.document-audit{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:12px;border:1px solid #302a3b;border-radius:11px;background:#111017;padding:12px}.document-audit strong{font-size:10px}.document-audit p{margin:5px 0 0;color:#827c89;font-size:9px}.document-audit>span{border-radius:999px;background:#241d31;color:#c4b5fd;padding:5px 8px;font-size:8px}.document-audit>small{grid-column:1/-1;color:#69636f;font-size:8px}`;
const styles = `.command-center{display:grid;gap:18px;padding:8px 0 40px;color:#f7f7f8}.chief-hero{position:relative;overflow:hidden;display:flex;min-height:230px;align-items:flex-end;justify-content:space-between;gap:40px;border:1px solid #2b2938;border-radius:20px;background:radial-gradient(circle at 82% 5%,rgba(124,58,237,.22),transparent 36%),linear-gradient(135deg,#17161f,#0f0f13 72%);padding:34px}.chief-hero:after{position:absolute;right:-90px;bottom:-160px;width:390px;height:390px;border:1px solid rgba(167,139,250,.12);border-radius:50%;content:""}.eyebrow,.section-heading>div>span{color:#a78bfa;font-size:10px;font-weight:800;letter-spacing:.18em}.eyebrow i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#34d399;box-shadow:0 0 14px #34d399}.chief-hero h1{margin:16px 0 8px;font-size:44px;letter-spacing:-.04em}.chief-hero p{max-width:680px;margin:0;color:#9692a7;font-size:15px;line-height:1.7}.hero-meta{z-index:1;display:grid;gap:8px;min-width:205px;color:#6f6b7b;font-size:10px;text-align:right}.hero-meta strong{color:#bbb6ca;font-weight:500}.chief-error,.source-warning{border:1px solid rgba(248,113,113,.35);border-radius:12px;background:rgba(127,29,29,.16);color:#fecaca;padding:12px 16px;font-size:12px}.source-warning{border-color:rgba(251,146,60,.3);background:rgba(124,45,18,.13);color:#fdba74}.command-panel{border:1px solid #292832;border-radius:18px;background:#14141a;padding:24px}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}.section-heading h2{margin:5px 0 0;font-size:20px}.section-heading aside{color:#696674;font-size:10px}.sales-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.chief-metric{min-height:114px;border:1px solid #292832;border-radius:13px;background:#0f0f14;padding:15px}.chief-metric span,.mini-stat span{display:block;color:#777485;font-size:11px}.chief-metric strong{display:block;margin:13px 0 7px;color:#f5f3ff;font-size:25px;letter-spacing:-.03em}.chief-metric small{color:#575461;font-size:10px}.progress{height:4px;margin-top:17px;border-radius:10px;background:#22212a;overflow:hidden}.progress i{display:block;height:100%;border-radius:10px;background:linear-gradient(90deg,#7c3aed,#a78bfa)}.evidence{display:block;margin-top:10px;color:#625f6e;font-size:10px}.command-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.rows{display:grid}.state-row{display:grid;grid-template-columns:minmax(140px,.65fr) minmax(200px,1fr) auto;gap:14px;align-items:center;border-top:1px solid #25242c;padding:15px 2px}.state-row:first-child{border-top:0;padding-top:2px}.state-row strong{display:block;font-size:13px}.state-row small{display:block;margin-top:5px;color:#5f5c68;font-size:10px}.state-row p,.decision p{margin:0;color:#898693;font-size:11px;line-height:1.55}.status-pill{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:1px solid color-mix(in srgb,var(--status) 32%,transparent);border-radius:999px;background:color-mix(in srgb,var(--status) 9%,transparent);color:var(--status);padding:5px 8px;font-size:9px;font-weight:750}.status-pill i{width:5px;height:5px;border-radius:50%;background:currentColor}.empty-state{display:grid;min-height:135px;place-items:center;color:#696674;font-size:12px}.orders{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.orders article{border:1px solid #292832;border-radius:13px;background:#0f0f14;padding:16px}.orders article>div{display:flex;align-items:center;justify-content:space-between}.orders article>div>span{color:#a78bfa;font-size:9px;font-weight:800;letter-spacing:.16em}.orders h3{margin:18px 0 8px;font-size:15px}.orders p{min-height:48px;margin:0;color:#7f7b8a;font-size:11px;line-height:1.55}.orders footer{margin-top:17px;border-top:1px solid #25242c;padding-top:10px;color:#55525d;font-size:9px;line-height:1.5}.pulse-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:9px}.mini-stat{border:1px solid #292832;border-radius:11px;background:#0f0f14;padding:13px}.mini-stat strong{display:block;margin-top:9px;color:#c4b5fd;font-size:21px}.quick-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:15px}.quick-links a{border:1px solid #302a43;border-radius:8px;color:#a78bfa;padding:8px 11px;font-size:10px}.decision{border-top:1px solid #25242c;padding:14px}.decision strong{font-size:13px}@media(max-width:1250px){.sales-grid{grid-template-columns:repeat(3,1fr)}.pulse-grid{grid-template-columns:repeat(4,1fr)}}@media(max-width:900px){.chief-hero{align-items:flex-start;flex-direction:column}.hero-meta{text-align:left}.command-grid{grid-template-columns:1fr}.orders{grid-template-columns:1fr}.state-row{grid-template-columns:1fr auto}.state-row p{grid-column:1/-1}.pulse-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.chief-hero{padding:24px}.chief-hero h1{font-size:34px}.sales-grid{grid-template-columns:repeat(2,1fr)}}`;
