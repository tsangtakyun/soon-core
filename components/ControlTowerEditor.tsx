"use client";

import { useMemo, useState, type FormEvent } from "react";

type Status =
  "verified" | "active" | "waiting" | "blocked" | "experiment" | "unknown";
type Item = {
  id: string;
  area: string;
  key: string;
  title: string;
  summary: string;
  status: Status;
  value_json: Record<string, unknown>;
  owner: string | null;
  evidence_note: string | null;
  checkpoint_at: string | null;
};
type Decision = { id: string; title: string; context: string };
type Order = {
  id: string;
  agent: string;
  title: string;
  scope: string;
  status: Status;
  last_report: string | null;
};
type Client = {
  id: string;
  name: string;
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
};
type History = {
  id: string;
  entity_type: string;
  action: string;
  after_json: Record<string, unknown> | null;
  created_at: string;
};
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  items: Item[];
  clients: Client[];
  decisions: Decision[];
  orders: Order[];
  history: History[];
};
const statusOptions: Array<[Status, string]> = [
  ["verified", "已驗證"],
  ["active", "進行中"],
  ["waiting", "等待中"],
  ["blocked", "受阻"],
  ["experiment", "實驗中"],
  ["unknown", "資料不足"],
];

export function ControlTowerEditor({
  open,
  onClose,
  onSaved,
  items,
  clients,
  decisions,
  orders,
  history,
}: Props) {
  const [tab, setTab] = useState<
    "state" | "client" | "decision" | "order" | "history"
  >("state");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const effectiveId = selectedId || items[0]?.id || "";
  const selected = useMemo(
    () => items.find((item) => item.id === effectiveId) ?? items[0],
    [items, effectiveId],
  );
  if (!open) return null;
  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/control-tower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "更新失敗");
      await onSaved();
      setMessage("已更新並寫入審計紀錄。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="tower-modal"
      role="dialog"
      aria-modal="true"
      aria-label="管理 Command Center"
    >
      <div className="tower-backdrop" onClick={onClose} />
      <section className="tower-sheet">
        <header>
          <div>
            <small>營運中心管理</small>
            <h2>更新公司狀態</h2>
          </div>
          <button onClick={onClose} aria-label="關閉">
            ×
          </button>
        </header>
        <nav>
          {[
            ["state", "公司狀態"],
            ["client", "客戶 Roster"],
            ["decision", "Tommy 決策"],
            ["order", "AI 工作管理"],
            ["history", "更新紀錄"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key as typeof tab)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="tower-body">
          {tab === "state" && selected && (
            <StateForm
              key={selected.id}
              item={selected}
              items={items}
              selectedId={effectiveId}
              onSelect={setSelectedId}
              busy={busy}
              onSubmit={submit}
            />
          )}
          {tab === "client" && (
            <ClientForm clients={clients} busy={busy} onSubmit={submit} />
          )}
          {tab === "decision" && (
            <DecisionForm decisions={decisions} busy={busy} onSubmit={submit} />
          )}
          {tab === "order" && (
            <OrderForm orders={orders} busy={busy} onSubmit={submit} />
          )}
          {tab === "history" && <HistoryList history={history} />}
          {message && (
            <p className="tower-message" role="status">
              {message}
            </p>
          )}
        </div>
      </section>
      <style jsx global>
        {editorStyles}
      </style>
    </div>
  );
}

const clientStageOptions = [
  ["prospect", "Prospect"],
  ["contract_pending", "合約待簽"],
  ["signed", "已簽"],
  ["onboarding", "啟動準備"],
  ["active", "服務中"],
  ["at_risk", "有風險"],
  ["renewal_due", "待續約"],
  ["retained", "已續約"],
  ["lost", "Lost"],
];
function ClientForm({
  clients,
  busy,
  onSubmit,
}: {
  clients: Client[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [id, setId] = useState("new");
  const current = clients.find((client) => client.id === id);
  return (
    <div className="tower-stack">
      <label>
        客戶記錄
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="new">＋新增客戶</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <ClientFields
        key={id}
        id={id}
        current={current}
        busy={busy}
        onSubmit={onSubmit}
      />
    </div>
  );
}
function ClientFields({
  id,
  current,
  busy,
  onSubmit,
}: {
  id: string;
  current?: Client;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(current?.name ?? ""),
    [stage, setStage] = useState(current?.stage ?? "prospect"),
    [owner, setOwner] = useState(current?.owner ?? ""),
    [nextAction, setNextAction] = useState(current?.next_action ?? ""),
    [nextAt, setNextAt] = useState(current?.next_action_at?.slice(0, 16) ?? ""),
    [signAt, setSignAt] = useState(
      current?.expected_sign_at?.slice(0, 16) ?? "",
    ),
    [contractValue, setContractValue] = useState(
      current?.contract_value_minor == null
        ? ""
        : String(current.contract_value_minor / 100),
    ),
    [mrr, setMrr] = useState(
      current?.effective_monthly_revenue_minor == null
        ? ""
        : String(current.effective_monthly_revenue_minor / 100),
    ),
    [term, setTerm] = useState(
      current?.term_months == null ? "" : String(current.term_months),
    ),
    [risk, setRisk] = useState(current?.risk_note ?? ""),
    [evidence, setEvidence] = useState(current?.evidence_note ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          operation: "upsert_client",
          id: id === "new" ? null : id,
          name,
          stage,
          owner,
          next_action: nextAction,
          next_action_at: nextAt || null,
          expected_sign_at: signAt || null,
          contract_value_hkd:
            contractValue === "" ? null : Number(contractValue),
          effective_mrr_hkd: mrr === "" ? null : Number(mrr),
          term_months: term === "" ? null : Number(term),
          currency: "HKD",
          risk_note: risk,
          evidence_note: evidence,
        });
      }}
    >
      <div className="tower-fields">
        <label>
          客戶名稱
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          階段
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {clientStageOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          負責人
          <input value={owner} onChange={(e) => setOwner(e.target.value)} />
        </label>
        <label>
          合約期（月）
          <input
            type="number"
            min="1"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <label>
          預計簽署日
          <input
            type="datetime-local"
            value={signAt}
            onChange={(e) => setSignAt(e.target.value)}
          />
        </label>
        <label>
          下次跟進時間
          <input
            type="datetime-local"
            value={nextAt}
            onChange={(e) => setNextAt(e.target.value)}
          />
        </label>
        <label>
          合約值 HKD
          <input
            type="number"
            min="0"
            step="1"
            value={contractValue}
            onChange={(e) => setContractValue(e.target.value)}
          />
        </label>
        <label>
          有效 MRR HKD
          <input
            type="number"
            min="0"
            step="1"
            value={mrr}
            onChange={(e) => setMrr(e.target.value)}
          />
        </label>
      </div>
      <label>
        下一步
        <textarea
          rows={2}
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
      </label>
      <label>
        風險
        <textarea
          rows={2}
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
        />
      </label>
      <label>
        證據／備註
        <textarea
          rows={3}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
        />
      </label>
      <button className="tower-save" disabled={busy}>
        {busy ? "儲存中…" : "儲存客戶記錄"}
      </button>
    </form>
  );
}

function StateForm({
  item,
  items,
  selectedId,
  onSelect,
  busy,
  onSubmit,
}: {
  item: Item;
  items: Item[];
  selectedId: string;
  onSelect: (id: string) => void;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title),
    [summary, setSummary] = useState(item.summary),
    [status, setStatus] = useState(item.status),
    [owner, setOwner] = useState(item.owner ?? ""),
    [evidence, setEvidence] = useState(item.evidence_note ?? ""),
    [checkpoint, setCheckpoint] = useState(
      item.checkpoint_at?.slice(0, 16) ?? "",
    );
  const [values, setValues] = useState<Record<string, unknown>>(
    item.value_json,
  );
  const sales = item.key === "september-sales";
  function save(event: FormEvent) {
    event.preventDefault();
    void onSubmit({
      operation: "update_state",
      id: item.id,
      title,
      summary,
      status,
      owner,
      evidence_note: evidence,
      checkpoint_at: checkpoint || null,
      value_json: values,
    });
  }
  return (
    <form onSubmit={save}>
      <label>
        項目
        <select
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
        >
          {items.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.area} · {entry.title}
            </option>
          ))}
        </select>
      </label>
      <div className="tower-fields">
        <label>
          名稱
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label>
          狀態
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          負責人
          <input value={owner} onChange={(e) => setOwner(e.target.value)} />
        </label>
        <label>
          下次檢查
          <input
            type="datetime-local"
            value={checkpoint}
            onChange={(e) => setCheckpoint(e.target.value)}
          />
        </label>
      </div>
      <label>
        摘要
        <textarea
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          required
        />
      </label>
      <label>
        證據／備註
        <textarea
          rows={3}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
        />
      </label>
      {sales && (
        <>
          <p className="tower-source-note">
            可在此設定客戶目標及最低留存率；已簽約、合約待簽、合約值及每月經常收入（MRR）會由客戶名冊自動計算。
          </p>
          <div className="tower-fields sales">
            <NumberField
              label="客戶目標"
              value={values.target}
              onChange={(value) => setValues({ ...values, target: value })}
            />
            <NumberField
              label="最低留存率（%）"
              value={values.retention_floor_pct}
              onChange={(value) =>
                setValues({ ...values, retention_floor_pct: value })
              }
            />
          </div>
        </>
      )}
      <button className="tower-save" disabled={busy}>
        {busy ? "儲存中…" : "儲存公司狀態"}
      </button>
    </form>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        value={Number(value ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function DecisionForm({
  decisions,
  busy,
  onSubmit,
}: {
  decisions: Decision[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(""),
    [context, setContext] = useState(""),
    [recommendation, setRecommendation] = useState(""),
    [impact, setImpact] = useState(""),
    [due, setDue] = useState(""),
    [resolution, setResolution] = useState<Record<string, string>>({});
  return (
    <div className="tower-stack">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({
            operation: "create_decision",
            title,
            context,
            recommendation,
            impact,
            decision_due_at: due || null,
          });
        }}
      >
        <h3>新增需要 Tommy 決定的事項</h3>
        <label>
          標題
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label>
          背景
          <textarea
            rows={3}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            required
          />
        </label>
        <label>
          營運總管建議
          <textarea
            rows={2}
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
          />
        </label>
        <label>
          影響
          <textarea
            rows={2}
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
          />
        </label>
        <label>
          決定期限
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <button className="tower-save" disabled={busy}>
          加入決策隊列
        </button>
      </form>
      {decisions.map((decision) => (
        <article className="resolve" key={decision.id}>
          <strong>{decision.title}</strong>
          <p>{decision.context}</p>
          <textarea
            placeholder="Tommy 最終決定"
            value={resolution[decision.id] ?? ""}
            onChange={(e) =>
              setResolution({ ...resolution, [decision.id]: e.target.value })
            }
          />
          <button
            disabled={busy || !resolution[decision.id]}
            onClick={() =>
              void onSubmit({
                operation: "resolve_decision",
                id: decision.id,
                resolution: resolution[decision.id],
              })
            }
          >
            標記已決定
          </button>
        </article>
      ))}
    </div>
  );
}
function OrderForm({
  orders,
  busy,
  onSubmit,
}: {
  orders: Order[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [id, setId] = useState("new");
  const current = orders.find((order) => order.id === id);
  return (
    <div className="tower-stack">
      <label>
        工作指令
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="new">＋新增工作指令</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.agent} · {order.title}
            </option>
          ))}
        </select>
      </label>
      <OrderFields
        key={id}
        id={id}
        current={current}
        busy={busy}
        onSubmit={onSubmit}
      />
    </div>
  );
}
function OrderFields({
  id,
  current,
  busy,
  onSubmit,
}: {
  id: string;
  current?: Order;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [agent, setAgent] = useState(current?.agent ?? "codex"),
    [title, setTitle] = useState(current?.title ?? ""),
    [scope, setScope] = useState(current?.scope ?? ""),
    [status, setStatus] = useState<Status>(current?.status ?? "active"),
    [report, setReport] = useState(current?.last_report ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          operation: "upsert_work_order",
          id: id === "new" ? null : id,
          agent,
          title,
          scope,
          status,
          last_report: report,
        });
      }}
    >
      <div className="tower-fields">
        <label>
          Agent
          <select value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="codex">Codex</option>
            <option value="claude">Claude</option>
            <option value="human">Human</option>
          </select>
        </label>
        <label>
          狀態
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {statusOptions
              .filter(([value]) => value !== "experiment")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label>
        標題
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label>
        範圍
        <textarea
          rows={3}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        />
      </label>
      <label>
        最新報告
        <textarea
          rows={4}
          value={report}
          onChange={(e) => setReport(e.target.value)}
        />
      </label>
      <button className="tower-save" disabled={busy}>
        {busy ? "儲存中…" : "儲存工作指令"}
      </button>
    </form>
  );
}
function HistoryList({ history }: { history: History[] }) {
  return (
    <div className="history-list">
      {history.length ? (
        history.map((entry) => (
          <article key={entry.id}>
            <div>
              <strong>
                {String(entry.after_json?.title ?? entry.entity_type)}
              </strong>
              <span>{entry.action.toUpperCase()}</span>
            </div>
            <p>
              {new Date(entry.created_at).toLocaleString("zh-HK")} ·{" "}
              {entry.entity_type}
            </p>
          </article>
        ))
      ) : (
        <p>暫時未有更新紀錄。</p>
      )}
    </div>
  );
}

const editorStyles = `.tower-modal{position:fixed;z-index:2000;inset:0}.tower-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}.tower-sheet{position:absolute;top:0;right:0;width:min(680px,100%);height:100%;overflow:auto;border-left:1px solid #32303c;background:#111116;color:#f5f5f5;box-shadow:-25px 0 80px rgba(0,0,0,.45)}.tower-sheet>header{display:flex;align-items:center;justify-content:space-between;padding:25px;border-bottom:1px solid #292832}.tower-sheet header small{color:#a78bfa;font-size:9px;font-weight:800;letter-spacing:.17em}.tower-sheet h2{margin:6px 0 0;font-size:23px}.tower-sheet header button{border:0;background:transparent;color:#888;font-size:27px}.tower-sheet>nav{display:flex;gap:5px;overflow:auto;padding:12px 20px;border-bottom:1px solid #292832}.tower-sheet>nav button{white-space:nowrap;border:0;border-radius:8px;background:transparent;color:#777;padding:8px 11px;font-size:11px}.tower-sheet>nav button.active{background:#261d38;color:#c4b5fd}.tower-body{padding:24px}.tower-body form,.tower-stack{display:grid;gap:14px}.tower-body label{display:grid;gap:6px;color:#8d8997;font-size:10px}.tower-body input,.tower-body select,.tower-body textarea{width:100%;border:1px solid #302e38;border-radius:9px;background:#19191f;color:#f5f5f5;padding:10px;outline:none}.tower-body input:focus,.tower-body select:focus,.tower-body textarea:focus{border-color:#7c3aed}.tower-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tower-fields.sales{grid-template-columns:repeat(3,1fr);border:1px solid #292832;border-radius:12px;background:#15151b;padding:13px}.tower-save{border:0;border-radius:9px;background:#7c3aed;color:#fff;padding:12px;font-weight:700}.tower-save:disabled{opacity:.5}.tower-message{border:1px solid #314633;border-radius:9px;background:#122016;color:#86efac;padding:10px;font-size:11px}.tower-stack h3{margin:0;font-size:14px}.resolve{display:grid;gap:8px;border:1px solid #292832;border-radius:11px;background:#17171d;padding:14px}.resolve p{margin:0;color:#888;font-size:11px}.resolve button{justify-self:end;border:1px solid #4c3b69;border-radius:7px;background:#21192e;color:#c4b5fd;padding:8px 10px}.history-list{display:grid}.history-list article{border-bottom:1px solid #292832;padding:13px 2px}.history-list article>div{display:flex;justify-content:space-between;gap:12px}.history-list strong{font-size:12px}.history-list span{color:#a78bfa;font-size:9px}.history-list p{margin:5px 0 0;color:#666;font-size:10px}@media(max-width:560px){.tower-fields,.tower-fields.sales{grid-template-columns:1fr}}`;
