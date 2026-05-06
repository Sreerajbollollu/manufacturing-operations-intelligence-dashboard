import { useEffect, useMemo, useState } from "react";
import { T, font } from "../utils/tokens";

const STORAGE_KEY = "moi_action_state_v1";
const STATUSES = ["Open", "In Progress", "Completed", "Deferred"];
const OWNER_TEAMS = ["Manufacturing", "Quality", "Engineering", "Supply Chain", "Maintenance", "Industrial Engineering"];

function Card({ children, style, noPad }) {
  return <div style={{ background: T.low, border: `1px solid ${T.high}`, borderRadius: 12, padding: noPad ? 0 : 20, overflow: "hidden", ...style }}>{children}</div>;
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultDueDate(priority) {
  if (priority === "High") return addDays(3);
  if (priority === "Medium") return addDays(7);
  return addDays(14);
}

function defaultOwner(ownerTeam) {
  const normalized = String(ownerTeam || "").toLowerCase();
  if (normalized.includes("quality")) return "Quality";
  if (normalized.includes("maintenance")) return "Maintenance";
  if (normalized.includes("engineering") || normalized.includes("industrial")) return "Industrial Engineering";
  if (normalized.includes("planning") || normalized.includes("supply")) return "Supply Chain";
  return "Manufacturing";
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function PriorityBadge({ priority }) {
  const colors = {
    High: { bg: `${T.danger}1a`, fg: T.danger, border: `${T.danger}66` },
    Medium: { bg: `${T.warning}1a`, fg: T.warning, border: `${T.warning}66` },
    Low: { bg: `${T.primary}1a`, fg: T.primary, border: `${T.primary}66` },
  };
  const c = colors[priority] || colors.Low;
  return <span style={{ display: "inline-flex", minWidth: 64, justifyContent: "center", padding: "3px 9px", borderRadius: 4, background: c.bg, border: `1px solid ${c.border}`, color: c.fg, fontFamily: font.data, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{priority}</span>;
}

function StatusBadge({ status }) {
  const colors = {
    Open: T.primary,
    "In Progress": T.warning,
    Completed: T.success,
    Deferred: T.outline,
  };
  return <span style={{ fontFamily: font.data, fontSize: 10, color: colors[status] || T.outline, letterSpacing: "0.08em", textTransform: "uppercase" }}>{status}</span>;
}

function Stat({ label, value, color = T.onSurface }) {
  return (
    <div style={{ minWidth: 118 }}>
      <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.outline }}>{label}</div>
      <div style={{ fontFamily: font.data, fontSize: 24, color, lineHeight: 1.15, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ControlButton({ children, onClick, tone = T.primary, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ border: `1px solid ${tone}55`, background: disabled ? T.container : `${tone}12`, color: disabled ? T.outline : tone, borderRadius: 4, padding: "7px 9px", fontFamily: font.body, fontSize: 11, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer" }}>
      {children}
    </button>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.outline, marginBottom: 6 }}>{children}</div>;
}

function actionPlan(item, state) {
  return [
    `Issue: ${item.issue}`,
    `Evidence: ${item.evidence}`,
    `Recommended Action: ${item.recommended_action}`,
    `Owner: ${state.owner_team}`,
    `Due Date: ${state.due_date}`,
    `Expected Impact: ${item.expected_impact}`,
    `Status: ${state.status}`,
    state.note ? `Note: ${state.note}` : null,
  ].filter(Boolean).join("\n");
}

export default function ActionCenter({ recommendations, recommendationsError }) {
  const rawActions = recommendations?.recommendations || [];
  const isLoading = recommendations == null && !recommendationsError;
  const [actionState, setActionState] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    setActionState(loadState());
  }, []);

  const actions = useMemo(() => rawActions.map((item) => {
    const stored = actionState[item.id] || {};
    return {
      ...item,
      workflow: {
        status: stored.status || item.status || "Open",
        owner_team: stored.owner_team || defaultOwner(item.owner_team),
        due_date: stored.due_date || defaultDueDate(item.priority),
        note: stored.note || "",
        updated_at: stored.updated_at || null,
      },
    };
  }), [rawActions, actionState]);

  const persist = (id, patch) => {
    setActionState((prev) => {
      const next = {
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          ...patch,
          updated_at: new Date().toISOString(),
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const copyPlan = async (item) => {
    await navigator.clipboard.writeText(actionPlan(item, item.workflow));
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const total = actions.length;
  const open = actions.filter((item) => item.workflow.status === "Open").length;
  const inProgress = actions.filter((item) => item.workflow.status === "In Progress").length;
  const completed = actions.filter((item) => item.workflow.status === "Completed").length;
  const high = actions.filter((item) => item.priority === "High").length;

  return (
    <>
      <div style={{ borderBottom: `1px solid ${T.high}50`, paddingBottom: 8 }}>
        <h1 style={{ fontFamily: font.body, fontSize: 24, fontWeight: 600, margin: 0 }}>Operations Recommendation Center</h1>
        <p style={{ fontFamily: font.body, fontSize: 14, color: T.onSurfaceVar, margin: "4px 0 0" }}>Convert rule-based recommendations into owned operational actions.</p>
      </div>

      <Card>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
          <Stat label="Total Actions" value={total} color={T.primaryContainer} />
          <Stat label="Open" value={open} color={T.primary} />
          <Stat label="In Progress" value={inProgress} color={T.warning} />
          <Stat label="Completed" value={completed} color={T.success} />
          <Stat label="High Priority" value={high} color={high ? T.danger : T.outline} />
          <div style={{ marginLeft: "auto", fontFamily: font.data, fontSize: 11, color: T.outline, letterSpacing: "0.08em", textTransform: "uppercase" }}>Saved locally</div>
        </div>
      </Card>

      <Card noPad>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.high}`, background: `${T.lowest}80`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T.onSurface, margin: 0 }}>Action Workflow</h2>
          <span style={{ fontFamily: font.data, fontSize: 11, color: T.outline, letterSpacing: "0.08em", textTransform: "uppercase" }}>{STORAGE_KEY}</span>
        </div>

        {isLoading && <div style={{ padding: 28, fontFamily: font.data, color: T.outline }}>Loading actions...</div>}
        {recommendationsError && <div style={{ padding: 28, fontFamily: font.data, color: T.danger }}>Failed to load recommendations</div>}
        {!isLoading && !recommendationsError && actions.length === 0 && <div style={{ padding: 28, fontFamily: font.data, color: T.outline }}>No recommendations found</div>}

        {!isLoading && !recommendationsError && actions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {actions.map((item, index) => {
              const state = item.workflow;
              const completedCard = state.status === "Completed";
              return (
                <div key={item.id} style={{ padding: 18, borderBottom: index < actions.length - 1 ? `1px solid ${T.high}` : "none", opacity: completedCard ? 0.55 : 1, background: item.priority === "High" && !completedCard ? `${T.danger}08` : "transparent" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 0.9fr) minmax(280px, 1.1fr) minmax(300px, 1.25fr)", gap: 18, alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                        <PriorityBadge priority={item.priority} />
                        <StatusBadge status={state.status} />
                      </div>
                      <div style={{ fontFamily: font.body, fontSize: 14, fontWeight: 800, color: T.onSurface, marginBottom: 6 }}>{item.issue}</div>
                      <div style={{ fontFamily: font.data, fontSize: 11, color: T.outline }}>{item.related_kpi} · {item.line_or_shift}</div>
                      {state.updated_at && <div style={{ fontFamily: font.data, fontSize: 10, color: T.outlineVar, marginTop: 8 }}>Updated {new Date(state.updated_at).toLocaleString()}</div>}
                    </div>

                    <div>
                      <FieldLabel>Evidence</FieldLabel>
                      <div style={{ fontFamily: font.data, fontSize: 12, color: T.onSurfaceVar, lineHeight: 1.45, marginBottom: 14 }}>{item.evidence}</div>
                      <FieldLabel>Recommended Action</FieldLabel>
                      <div style={{ fontFamily: font.data, fontSize: 12, color: T.onSurface, lineHeight: 1.45 }}>{item.recommended_action}</div>
                      <div style={{ fontFamily: font.data, fontSize: 11, color: T.success, marginTop: 8 }}>{item.expected_impact}</div>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 10 }}>
                        <label>
                          <FieldLabel>Owner Team</FieldLabel>
                          <select value={state.owner_team} onChange={(e) => persist(item.id, { owner_team: e.target.value })} style={{ width: "100%", background: T.container, color: T.onSurface, border: `1px solid ${T.outlineVar}`, borderRadius: 4, padding: "8px 10px", fontFamily: font.data, fontSize: 12 }}>
                            {OWNER_TEAMS.map((team) => <option key={team} value={team}>{team}</option>)}
                          </select>
                        </label>
                        <label>
                          <FieldLabel>Due Date</FieldLabel>
                          <input type="date" value={state.due_date} onChange={(e) => persist(item.id, { due_date: e.target.value })} style={{ width: "100%", background: T.container, color: T.onSurface, border: `1px solid ${T.outlineVar}`, borderRadius: 4, padding: "8px 10px", fontFamily: font.data, fontSize: 12 }} />
                        </label>
                      </div>

                      <label>
                        <FieldLabel>Note</FieldLabel>
                        <textarea value={state.note} onChange={(e) => persist(item.id, { note: e.target.value })} placeholder="Add note..." rows={3} style={{ width: "100%", resize: "vertical", background: T.container, color: T.onSurface, border: `1px solid ${T.outlineVar}`, borderRadius: 4, padding: "9px 10px", fontFamily: font.data, fontSize: 12, lineHeight: 1.4 }} />
                      </label>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <ControlButton onClick={() => persist(item.id, { status: "In Progress" })} tone={T.warning}>Start Action</ControlButton>
                        <ControlButton onClick={() => persist(item.id, { status: "Completed" })} tone={T.success}>Mark Complete</ControlButton>
                        <ControlButton onClick={() => persist(item.id, { status: "Deferred" })} tone={T.outline}>Defer</ControlButton>
                        <ControlButton onClick={() => persist(item.id, { note: state.note })} tone={T.secondary}>Add Note</ControlButton>
                        <ControlButton onClick={() => copyPlan(item)} tone={T.primaryContainer}>{copiedId === item.id ? "Copied" : "Copy Action Plan"}</ControlButton>
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <FieldLabel>Status</FieldLabel>
                        <select value={state.status} onChange={(e) => persist(item.id, { status: e.target.value })} style={{ marginLeft: 8, background: T.container, color: T.onSurface, border: `1px solid ${T.outlineVar}`, borderRadius: 4, padding: "6px 8px", fontFamily: font.data, fontSize: 12 }}>
                          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
