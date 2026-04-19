import { useState, useEffect, useCallback, useRef, useMemo, useReducer } from "react";
import { Analytics } from "@vercel/analytics/react";
import { AnimatePresence, motion } from "framer-motion";

const FONTS = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@200;300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap";

async function callAI(prompt, sys = "You are an expert GTM/RevOps consultant. Improve the given content for clarity, professionalism, and strategic impact. Return ONLY the improved text.") {
  try {
    const base = window.location.hostname === "localhost" ? "https://www.revosys.pro" : "";
    const r = await fetch(`${base}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, system: sys }),
    });
    const d = await r.json();
    if (!r.ok) return `AI error: ${d.error || "unknown"}`;
    return d.text || "AI enhancement failed.";
  } catch {
    return "AI service unavailable.";
  }
}
let _id = 100; const uid = () => `id_${++_id}_${Date.now().toString(36)}`; const num = (n) => String(n).padStart(2, "0");

// Send magic link email via Vercel serverless function.
// Token is generated server-side — never passed from the client.
const sendMagicEmail = async ({ to, name, type = "login" }) => {
  const base = window.location.hostname === "localhost" ? "https://revosys.pro" : "";
  const res = await fetch(`${base}/api/send-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, name, type }),
  });
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) {
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  return body;
};

// Verify a magic link token against the server (HMAC-signed, stateless).
const verifyMagicToken = async (token) => {
  const base = window.location.hostname === "localhost" ? "https://revosys.pro" : "";
  const res = await fetch(`${base}/api/verify-token?token=${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  const d = await res.json().catch(() => null);
  return d?.email || null;
};

// ============================================================
// CASE STUDIES (anonymized, no company names, no timelines)
// ============================================================
const CASE_STUDIES = [
  { id: "cs1", title: "CRM Infrastructure from Zero to Revenue Engine", category: "CRM Implementation",
    headline: "Replaced 7 disconnected tools with one unified revenue platform",
    metrics: [{ val: "48hrs", arrow: "5min", label: "Lead Routing Time" }, { val: "0%", arrow: "100%", label: "Pipeline Visibility" }, { val: "Manual", arrow: "Automated", label: "PQL Routing" }],
    automations: ["Lead scoring engine with 12 weighted criteria", "Territory-based auto-routing with SLA tracking", "Lifecycle stage automation across 8 stages", "Product usage signals triggering sales alerts"],
    eliminated: ["Manual spreadsheet lead tracking", "Copy-paste between enrichment and CRM", "Weekly CSV exports for reporting", "Manual lead-to-account mapping"],
    tags: ["Lead Scoring", "Pipeline Automation", "Data Enrichment", "SLA Architecture"] },
  { id: "cs2", title: "Dual-Motion GTM: Sales-Led + Product-Led in Harmony", category: "Revenue Operations",
    headline: "Two growth engines running in parallel without conflict",
    metrics: [{ val: "New", arrow: "Active", label: "PQL-to-SQL KPI" }, { val: "Reactive", arrow: "30 days early", label: "Churn Detection" }, { val: "Siloed", arrow: "Unified", label: "Data Architecture" }],
    automations: ["Product usage cohorts feeding CRM in real-time", "Zero-overlap audience segmentation engine", "Behavior-triggered lifecycle campaigns", "Health scoring dashboards for CS team"],
    eliminated: ["Guessing which product users are sales-ready", "Duplicate messaging across teams", "Manual health check spreadsheets", "Disconnected product and sales data"],
    tags: ["PLG", "SLG", "Product Analytics", "Lifecycle Marketing"] },
  { id: "cs3", title: "AI Agents Running the Sales Floor", category: "AI Automation",
    headline: "Reps went from 70% admin time to 70% selling time",
    metrics: [{ val: "70%", arrow: "30%", label: "Admin Time" }, { val: "1x", arrow: "3x", label: "Response Rates" }, { val: "0", arrow: "4", label: "AI Agents Deployed" }],
    automations: ["AI prospecting agent auto-researching accounts", "AI copywriter drafting personalized outreach", "Smart CRM fields capturing call insights", "Deal risk scoring from conversation analysis"],
    eliminated: ["Manual prospect research (45 min/lead)", "Generic copy-paste email templates", "Forgotten follow-ups and dead leads", "Manual meeting prep and note-taking"],
    tags: ["AI Agents", "No-Code Automation", "Smart Fields", "Intelligent Routing"] },
  { id: "cs4", title: "Six-Stage Lead Pipeline with Quality Gates", category: "GTM Strategy",
    headline: "Every lead has a defined path. No lead falls through.",
    metrics: [{ val: "Undefined", arrow: "6 Stages", label: "Pipeline Structure" }, { val: "None", arrow: "Auto", label: "Stage Movement Rules" }, { val: "Chaos", arrow: "Playbook", label: "Rep Process" }],
    automations: ["Auto-stage progression based on engagement signals", "Score-threshold qualification with instant deal creation", "AI-assisted email drafting within sequencing", "Quality gate preventing bad-fit leads from progressing"],
    eliminated: ["Reps deciding their own qualification criteria", "Leads sitting in limbo with no next action", "Inconsistent data entry across the team", "Manual stage updates and deal creation"],
    tags: ["Lead Pipeline", "Sales Process", "Qualification Framework"] },
  { id: "cs5", title: "Data Integrity Overhaul: 40% to 90% Accuracy", category: "CRM Implementation",
    headline: "Turned a data disaster into a decision-making asset",
    metrics: [{ val: "40%", arrow: "90%", label: "Data Accuracy" }, { val: "0%", arrow: "+23%", label: "Sales Increase (QoQ)" }, { val: "None", arrow: "Weekly", label: "Executive Dashboards" }],
    automations: ["Automated data validation on every record", "Multi-region marketing automation at scale", "Cost-per-lead tracking across all channels", "Executive dashboards auto-refreshing weekly"],
    eliminated: ["Spreadsheet-based sales tracking", "Manual report generation for leadership", "Unvalidated data entering the CRM", "Regional teams running disconnected processes"],
    tags: ["Data Cleansing", "Sales Enablement", "Marketing Automation"] },
  { id: "cs6", title: "Lifecycle Engine for B2B2C with Zero Overlap", category: "AI Automation",
    headline: "Two audiences. One engine. No crossed wires.",
    metrics: [{ val: "High", arrow: "0%", label: "Segment Overlap" }, { val: "Batch", arrow: "Event-triggered", label: "Campaign Logic" }, { val: "Generic", arrow: "Hyper-personal", label: "Content Delivery" }],
    automations: ["Custom event sync between product and marketing", "Conditional content blocks per user segment", "Behavior-triggered retention sequences", "Health score integration with campaign targeting"],
    eliminated: ["Business buyers getting end-user emails", "Manual campaign scheduling and audience pulls", "One-size-fits-all messaging", "Reactive churn handling after it's too late"],
    tags: ["Lifecycle Marketing", "Conditional Logic", "B2B2C"] },
];

// ============================================================
// AI WORKFLOW BLUEPRINTS
// ============================================================
// (Diagnostic tools are defined inline as components below)

// ============================================================
// SCOPE TEMPLATES
// ============================================================
const SCOPE_TEMPLATES = [
  { id: "crm", label: "CRM Implementation", icon: "crm",
    sections: [
      { title: "Discovery & Audit", content: "Complete audit of existing CRM data, integrations, workflows, and team processes. Identify gaps, duplicates, and migration risks." },
      { title: "Data Architecture & Migration", content: "Map all objects, fields, and relationships. Define migration strategy for contacts, companies, deals, and custom objects." },
      { title: "Workflow & Automation Setup", content: "Recreate and improve all automation rules, sequences, lead routing logic, and lifecycle stage transitions." },
      { title: "Integrations", content: "Connect CRM to marketing automation, enrichment tools, analytics platforms, and middleware. Document all API connections." },
      { title: "Team Enablement & Handoff", content: "Training sessions for all users. SOPs for common workflows. Admin documentation and ongoing support plan." },
    ]
  },
  { id: "gtm", label: "GTM Strategy", icon: "target",
    sections: [
      { title: "Current State Analysis", content: "Audit of existing GTM motion: ICP definition, pipeline structure, conversion rates, and team capacity." },
      { title: "ICP & Positioning", content: "Define and refine ideal customer profile. Develop positioning framework and messaging hierarchy." },
      { title: "Lead Scoring & Routing Design", content: "Build lead scoring model with behavioral and firmographic criteria. Design routing rules by territory, segment, and score." },
      { title: "Pipeline & Funnel Architecture", content: "Define stage gates, entry/exit criteria, SLAs per stage, and handoff playbooks between teams." },
      { title: "Launch & Measurement Plan", content: "Rollout timeline, KPI framework, dashboard design, and 90-day success metrics." },
    ]
  },
  { id: "revops", label: "RevOps Architecture", icon: "activity",
    sections: [
      { title: "Tech Stack Audit", content: "Map all tools across marketing, sales, and CS. Identify overlap, gaps, and integration opportunities." },
      { title: "Data Architecture", content: "Define unified data model across all platforms. Establish naming conventions, field standards, and data governance rules." },
      { title: "Reporting & Attribution Design", content: "Build attribution model (first touch, multi-touch, or custom). Design executive dashboards and team-level reports." },
      { title: "Automation Blueprint", content: "Document all cross-platform automation flows. Prioritise by impact and build sequence." },
      { title: "Ongoing Ops Playbook", content: "Monthly RevOps cadence, QBR structure, hygiene processes, and escalation paths." },
    ]
  },
  { id: "ai", label: "AI Automation", icon: "ai",
    sections: [
      { title: "Use Case Discovery", content: "Identify top manual workflows suitable for AI automation. Prioritise by time saved and revenue impact." },
      { title: "Agent Design & Architecture", content: "Design AI agent workflows using no-code tools (Make, MindStudio, n8n). Define triggers, actions, and fallback logic." },
      { title: "Build & Test", content: "Build agents in staging environment. Test with real data. Validate accuracy, edge cases, and error handling." },
      { title: "Deployment & Integration", content: "Deploy agents to production. Connect to live CRM, inbox, and data sources. Monitor initial runs." },
      { title: "Handoff & Documentation", content: "Full SOPs for each agent. Training on how to modify or pause. Monitoring dashboard setup." },
    ]
  },
  { id: "custom", label: "Custom Scope", icon: "edit",
    sections: [
      { title: "Scope Overview", content: "" },
      { title: "Deliverables", content: "" },
      { title: "Timeline & Milestones", content: "" },
      { title: "Terms & Conditions", content: "" },
    ]
  },
];

// ============================================================
// SEED DATA
// ============================================================
const SEED = {
  users: [
    { id: "u1", name: "Sahil Bahri", email: "sahilbahri7@gmail.com", role: "admin", avatar: "SB", createdAt: "2025-01-15", status: "active" },
    { id: "u2", name: "Priya Sharma", email: "priya@team.com", role: "internal", avatar: "PS", createdAt: "2025-02-01", status: "active" },
    { id: "u3", name: "Alex Chen", email: "alex@client.com", role: "client", avatar: "AC", clientId: "c1", createdAt: "2025-03-01", status: "invited" },
  ],
  clients: [
    { id: "c1", name: "Meridian Health", company: "Meridian Health Corp", email: "ops@meridian.com", phone: "+1-555-0100", industry: "Healthcare", notes: "Enterprise HubSpot migration", createdAt: "2025-01-20", createdBy: "u1", status: "active" },
    { id: "c2", name: "NovaTech Solutions", company: "NovaTech Inc", email: "cto@novatech.io", phone: "+1-555-0200", industry: "SaaS", notes: "GTM stack overhaul", createdAt: "2025-02-10", createdBy: "u1", status: "active" },
  ],
  projects: [
    { id: "p1", clientId: "c1", name: "HubSpot CRM Migration", description: "Full CRM migration with custom integrations, data mapping, workflow recreation, and team enablement.", status: "active", visibility: "portfolio", category: "CRM Implementation", createdAt: "2025-01-25", updatedAt: "2025-03-01", coverColor: "#1a3a5c" },
    { id: "p2", clientId: "c2", name: "GTM Revenue Engine", description: "End-to-end GTM architecture including lead scoring, routing, attribution modeling, and revenue forecasting.", status: "active", visibility: "portfolio", category: "Revenue Operations", createdAt: "2025-02-15", updatedAt: "2025-03-10", coverColor: "#2d1b4e" },
  ],
  proposals: [{ id: "pr1", projectId: "p1", title: "CRM Migration Proposal", content: "Phased migration approach covering data mapping, custom object migration, workflow recreation, and team training over a 12-week timeline.", status: "accepted", createdAt: "2025-01-26", updatedAt: "2025-02-01", sentAt: "2025-01-28" }],
  scopes: [{ id: "s1", projectId: "p1", title: "Phase 1: Discovery & Data Audit", sections: [{ id: "sec1", title: "Data Audit", content: "Complete audit of existing data including contacts, companies, deals, and custom objects." }, { id: "sec2", title: "Integration Mapping", content: "Document all current integrations and map equivalent solutions." }, { id: "sec3", title: "Timeline & Milestones", content: "Establish milestones with clear deliverables for each phase." }], version: 1, locked: false, approvedBy: null, approvedAt: null, createdAt: "2025-02-01", rate: { type: "project", amount: 12000, currency: "USD" }, scopeStatus: "accepted", signedBy: "Alex Chen", signedAt: "2025-02-05T14:22:00", clientEmail: "alex@client.com" }],
  inbox: [
    {id:"msg1",threadId:"th1",from:"ops@meridian.com",fromName:"Meridian Health",to:"sahil@revosys.pro",subject:"HubSpot Migration — Phase 1 Update",body:"Hi Sahil,\n\nThanks for the update on Phase 1. The data export looks clean and the team is happy with the mapping document.\n\nA couple of questions:\n1. When do we kick off the automation rebuild?\n2. Can we schedule a call for next week?\n\nBest,\nAlex",clientId:"c1",date:"2025-03-14T10:30:00",read:true,direction:"inbound"},
    {id:"msg2",threadId:"th1",from:"sahil@revosys.pro",fromName:"Sahil — Revo-Sys",to:"ops@meridian.com",subject:"HubSpot Migration — Phase 1 Update",body:"Hi Alex,\n\nGreat to hear the team is happy with progress!\n\n1. Automation rebuild kicks off Monday — I'll send the workflow inventory today.\n2. Yes, let's do Tuesday 2pm EST. Calendar invite coming.\n\nSpeak soon,\nSahil",clientId:"c1",date:"2025-03-14T14:15:00",read:true,direction:"outbound"},
    {id:"msg3",threadId:"th2",from:"cto@novatech.io",fromName:"NovaTech CTO",to:"sahil@revosys.pro",subject:"GTM Stack Review — Urgent",body:"Hi,\n\nWe need to revisit the lead scoring model. The sales team is flagging a lot of false positives — high scores on leads that aren't converting.\n\nCan we jump on a call this week?\n\nThanks",clientId:"c2",date:"2025-03-15T09:00:00",read:false,direction:"inbound"},
  ],
  scopeVersions: [],
  tasks: [
    { id: "t1", projectId: "p1", scopeId: "s1", sectionId: "sec1", title: "Export Contact Data", description: "Export all contact records with custom fields", owner: "u2", status: "completed", visibility: "client", dueDate: "2025-02-15", createdAt: "2025-02-02", completedAt: "2025-02-14" },
    { id: "t2", projectId: "p1", scopeId: "s1", sectionId: "sec1", title: "Data Quality Assessment", description: "Run data quality checks on exported records", owner: "u2", status: "in_progress", visibility: "client", dueDate: "2025-03-01", createdAt: "2025-02-02", completedAt: null },
    { id: "t3", projectId: "p1", scopeId: "s1", sectionId: "sec2", title: "Map API Integrations", description: "Document all current API integrations", owner: "u1", status: "todo", visibility: "internal", dueDate: "2025-03-15", createdAt: "2025-02-05", completedAt: null },
  ],
  comments: [{ id: "cm1", taskId: "t1", userId: "u1", content: "Great work on the export. Let's review the field mapping next.", createdAt: "2025-02-14T10:30:00" }, { id: "cm2", taskId: "t1", userId: "u3", content: "Custom fields are all accounted for. @Priya Sharma can you verify?", createdAt: "2025-02-14T11:15:00" }],
  deliverables: [{ id: "d1", taskId: "t1", name: "contacts_export.csv", type: "file", size: "2.4 MB", createdAt: "2025-02-14", uploadedBy: "u2" }],
  activityLog: [
    { id: "a1", type: "project_created", userId: "u1", entityId: "p1", details: "Created project 'HubSpot CRM Migration'", timestamp: "2025-01-25T09:00:00" },
    { id: "a2", type: "proposal_sent", userId: "u1", entityId: "pr1", details: "Sent proposal to client", timestamp: "2025-01-28T14:00:00" },
    { id: "a3", type: "proposal_accepted", userId: "u3", entityId: "pr1", details: "Client accepted proposal", timestamp: "2025-02-01T10:30:00" },
    { id: "a4", type: "task_completed", userId: "u2", entityId: "t1", details: "Completed 'Export Contact Data'", timestamp: "2025-02-14T16:00:00" },
  ],
  portfolioSettings: {
    headline: "Revenue systems engineered for scale",
    subheadline: "Revo-Sys builds the GTM architecture that turns B2B complexity into predictable, scalable growth. Systems-first. Data-driven. Delivered.",
    services: [
      { id: "svc1", title: "GTM Strategy & Operations", description: "End-to-end go-to-market strategy: ICP definition, lead scoring, routing, and funnel optimization.", icon: "strategy" },
      { id: "svc2", title: "CRM Implementation", description: "Expert CRM implementation, migration, and optimization across sales, marketing, and service.", icon: "crm" },
      { id: "svc3", title: "Revenue Operations Architecture", description: "The operational backbone connecting marketing, sales, and CS with unified data and reporting.", icon: "revops" },
      { id: "svc4", title: "AI-Powered Workflow Automation", description: "Intelligent automation across your GTM stack using AI agents, middleware, and no-code tools.", icon: "ai" },
    ],
  },
};

// ============================================================
// REDUCER
// ============================================================
function reducer(state, action) {
  const log = (type, userId, entityId, details) => ({ id: uid(), type, userId, entityId, details, timestamp: new Date().toISOString() });
  switch (action.type) {
    case "ADD_CLIENT": { const e = { ...action.payload, id: uid(), createdAt: new Date().toISOString() }; return { ...state, clients: [...state.clients, e], activityLog: [...state.activityLog, log("client_created", action.userId, e.id, `Created client '${e.name}'`)] }; }
    case "UPDATE_CLIENT": return { ...state, clients: state.clients.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
    case "DELETE_CLIENT": return { ...state, clients: state.clients.filter(c => c.id !== action.payload) };
    case "ADD_PROJECT": { const e = { ...action.payload, id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; return { ...state, projects: [...state.projects, e], activityLog: [...state.activityLog, log("project_created", action.userId, e.id, `Created project '${e.name}'`)] }; }
    case "UPDATE_PROJECT": return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload, updatedAt: new Date().toISOString() } : p) };
    case "DELETE_PROJECT": return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case "CLONE_PROJECT": { const o = state.projects.find(p => p.id === action.payload); if (!o) return state; const n = { ...o, id: uid(), name: `${o.name} (Copy)`, status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; return { ...state, projects: [...state.projects, n] }; }
    case "ADD_PROPOSAL": { const e = { ...action.payload, id: uid(), status: "draft", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sentAt: null }; return { ...state, proposals: [...state.proposals, e] }; }
    case "UPDATE_PROPOSAL": return { ...state, proposals: state.proposals.map(p => p.id === action.payload.id ? { ...p, ...action.payload, updatedAt: new Date().toISOString() } : p) };
    case "DUPLICATE_PROPOSAL": { const o = state.proposals.find(p => p.id === action.payload); if (!o) return state; return { ...state, proposals: [...state.proposals, { ...o, id: uid(), title: `${o.title} (Copy)`, status: "draft", createdAt: new Date().toISOString(), sentAt: null }] }; }
    case "ADD_SCOPE": { const e = { ...action.payload, id: uid(), version: 1, locked: false, approvedBy: null, approvedAt: null, createdAt: new Date().toISOString() }; return { ...state, scopes: [...state.scopes, e] }; }
    case "UPDATE_SCOPE": { const old = state.scopes.find(s => s.id === action.payload.id); if (old?.locked) return state; const ver = old ? { id: uid(), scopeId: old.id, version: old.version, sections: JSON.parse(JSON.stringify(old.sections)), createdAt: new Date().toISOString() } : null; return { ...state, scopes: state.scopes.map(s => s.id === action.payload.id ? { ...s, ...action.payload, version: (s.version || 1) + 1 } : s), scopeVersions: ver ? [...state.scopeVersions, ver] : state.scopeVersions }; }
    case "APPROVE_SCOPE": return { ...state, scopes: state.scopes.map(s => s.id === action.payload ? { ...s, locked: true, approvedBy: action.userId, approvedAt: new Date().toISOString() } : s), activityLog: [...state.activityLog, log("scope_approved", action.userId, action.payload, "Scope approved")] };
    case "ADD_TASK": return { ...state, tasks: [...state.tasks, { ...action.payload, id: uid(), status: "todo", createdAt: new Date().toISOString(), completedAt: null }] };
    case "ADD_TASKS_BULK": { const es = action.payload.map(t => ({ ...t, id: uid(), status: "todo", createdAt: new Date().toISOString(), completedAt: null })); return { ...state, tasks: [...state.tasks, ...es], activityLog: [...state.activityLog, log("tasks_generated", action.userId, es[0]?.projectId, `Generated ${es.length} tasks`)] }; }
    case "UPDATE_TASK": { const was = state.tasks.find(t => t.id === action.payload.id)?.status === "completed"; const now = action.payload.status === "completed" && !was; return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? { ...t, ...action.payload, completedAt: now ? new Date().toISOString() : (action.payload.completedAt || null) } : t), activityLog: now ? [...state.activityLog, log("task_completed", action.userId, action.payload.id, "Completed task")] : state.activityLog }; }
    case "DELETE_TASK": return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case "ADD_COMMENT": return { ...state, comments: [...state.comments, { ...action.payload, id: uid(), createdAt: new Date().toISOString() }] };
    case "ADD_DELIVERABLE": { const e = { ...action.payload, id: uid(), createdAt: new Date().toISOString() }; return { ...state, deliverables: [...state.deliverables, e], activityLog: [...state.activityLog, log("deliverable_uploaded", action.userId, e.taskId, `Uploaded '${e.name}'`)] }; }
    case "DELETE_DELIVERABLE": return { ...state, deliverables: state.deliverables.filter(d => d.id !== action.payload) };
    case "ADD_USER": return { ...state, users: [...state.users, { ...action.payload, id: uid(), createdAt: new Date().toISOString(), status: action.payload.status || "invited" }] };
    case "UPDATE_USER": return { ...state, users: state.users.map(u => u.id === action.payload.id ? { ...u, ...action.payload } : u) };
    case "REMOVE_USER": return { ...state, users: state.users.filter(u => u.id !== action.payload) };
    // Token lifecycle now handled server-side via HMAC — no state storage needed.
    case "UPDATE_PORTFOLIO": return { ...state, portfolioSettings: { ...state.portfolioSettings, ...action.payload } };
    case "ACKNOWLEDGE_DELIVERY": return { ...state, activityLog: [...state.activityLog, log("delivery_acknowledged", action.userId, action.payload, "Delivery acknowledged")] };
    case "ADD_MESSAGE": return {...state, inbox:[...(state.inbox||[]), {...action.payload,id:uid(),date:new Date().toISOString(),read:false}]};
    case "MARK_READ": return {...state, inbox:(state.inbox||[]).map(m=>m.id===action.payload?{...m,read:true}:m)};
    default: return state;
  }
}

// ============================================================
// DESIGN SYSTEM
// ============================================================
const CSS = `
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes flowPulse{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes nodeGlow{0%,100%{box-shadow:0 0 8px rgba(196,162,101,0.05)}50%{box-shadow:0 0 24px rgba(196,162,101,0.2)}}
@keyframes dataFlow{0%{left:0;opacity:0}5%{opacity:1}95%{opacity:1}100%{left:100%;opacity:0}}
@keyframes particleFlow{0%{transform:translateY(0);opacity:0}8%{opacity:.9}85%{opacity:.7}100%{transform:translateY(var(--funnel-h));opacity:0}}
@keyframes connectorPulse{0%,100%{opacity:.2}50%{opacity:.7}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 0 rgba(196,162,101,0)}50%{box-shadow:0 0 32px rgba(196,162,101,0.18)}}
@keyframes slideInUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
@keyframes barGrow{from{width:0}to{width:var(--bar-w)}}
@keyframes numberGlow{0%,100%{text-shadow:none}50%{text-shadow:0 0 20px currentColor}}
@keyframes borderPulse{0%,100%{border-color:rgba(196,162,101,0.15)}50%{border-color:rgba(196,162,101,0.4)}}
@keyframes shinyBorder{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.ai-chat-glow{position:relative;border:none!important;background:var(--ink-2);isolation:isolate}
.ai-chat-glow::before{content:'';position:absolute;inset:-2px;border-radius:18px;background:linear-gradient(135deg,#4285f4,#ea4335,#fbbc04,#34a853,#7c6fa0,#5b8fa8,#c4a265,#4285f4);background-size:400% 400%;animation:shinyBorder 6s ease infinite;z-index:-1;opacity:.7}
.ai-chat-glow::after{content:'';position:absolute;inset:0;border-radius:16px;background:var(--ink-2);z-index:-1}
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0B0B0B;--ink-2:#111111;--ink-3:#1A1A1A;--ink-4:#222;--ink-5:#2a2a2a;--cream:#E8E0D4;--cream-dim:#B8B0A4;--cream-mute:#7A756D;--amber:#C4A265;--sky:#5B8FA8;--violet:#7C6FA0;--success:#6B9E6F;--danger:#A85B5B;--sage:#7B8F7E;--rose:#A8726F;--border:rgba(232,224,212,0.08);--border-h:rgba(232,224,212,0.15);--serif:'Instrument Serif',Georgia,serif;--sans:'Outfit',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace}
body{background:var(--ink);color:var(--cream);font-family:var(--sans);-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(232,224,212,0.1);border-radius:10px}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--amber)!important}
::selection{background:rgba(196,162,101,0.25);color:var(--cream)}
.ghost-btn{background:none;border:none;color:var(--cream-mute);cursor:pointer;padding:4px;display:inline-flex;transition:color .15s}.ghost-btn:hover{color:var(--cream)}
html,body{max-width:100vw;overflow-x:hidden}
img,svg{max-width:100%;height:auto}

/* ═══════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE (≤ 900px tablet, ≤ 640px phone)
   Attribute selectors override React inline styles via !important.
   ═══════════════════════════════════════════════════════════════ */
@media (max-width: 900px){
  /* Portfolio top nav */
  nav[style*="padding: 20px 64px"]{padding:14px 20px !important;flex-wrap:wrap !important;gap:12px !important}
  nav[style*="padding: 20px 64px"] > div:last-child{gap:14px !important;flex-wrap:wrap}
  nav[style*="padding: 20px 64px"] button{font-size:11px !important;padding:6px 12px !important}

  /* Portfolio sections: slim padding */
  section[style*="padding: 200px 64px 100px"]{padding:120px 20px 60px !important}
  section[style*="padding: \"200px 64px 100px\""]{padding:120px 20px 60px !important}
  section[style*="padding: 120px 64px"]{padding:64px 20px !important}
  section[style*="padding: 100px 64px"]{padding:60px 20px !important}
  section[style*="padding: 100px 40px"]{padding:60px 16px !important}
  footer[style*="padding: 60px 64px"]{padding:32px 20px !important;flex-direction:column !important;gap:12px !important;text-align:center !important}

  /* Collapse 2+ column grids to 1 column on mobile */
  [style*="grid-template-columns: 1fr auto"]{grid-template-columns:1fr !important;gap:40px !important}
  [style*="grid-template-columns: 300px 1fr"]{grid-template-columns:1fr !important;gap:28px !important}
  [style*="grid-template-columns: repeat(4, 1fr)"]{grid-template-columns:repeat(2, 1fr) !important}
  [style*="grid-template-columns: repeat(2, 1fr)"]{grid-template-columns:1fr !important}
  [style*="grid-template-columns: 1fr 1fr 1fr"]{grid-template-columns:1fr !important}
  [style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr !important}

  /* Typography scale */
  h1[style*="font-size"]{font-size:clamp(30px,8vw,44px) !important;line-height:1.12 !important}
  h2[style*="font-size: 44px"]{font-size:30px !important;line-height:1.15 !important}
  h2[style*="font-size: 40px"]{font-size:28px !important}
  h3[style*="font-size: 28px"]{font-size:22px !important}

  /* Hero right panel (funnel) — shrink, center */
  [style*="width: 420px"]{width:100% !important;max-width:360px !important;margin:0 auto !important}

  /* Hero stats row (6+/4/15+/3x) */
  [style*="gap: 48px"][style*="marginTop: 72px"]{gap:28px !important;margin-top:40px !important;flex-wrap:wrap !important}

  /* Portal sidebar: narrower on mobile, still collapsible */
  aside[style*="width: 220px"]{width:56px !important}
  aside[style*="width: 220px"] + main{padding:24px 20px !important}
  main[style*="padding: 36px 48px"]{padding:24px 18px !important}

  /* Portfolio marquee — reduce letter-spacing */
  [style*="letter-spacing: 0.3em"][style*="text-transform: uppercase"]{letter-spacing:0.12em !important}

  /* Case study header row — stack */
  [style*="grid-template-columns: 50px 1fr auto"]{grid-template-columns:40px 1fr !important;gap:16px !important}
  [style*="grid-template-columns: 50px 1fr auto"] > div:last-child{grid-column:1 / -1 !important;justify-content:flex-start !important}

  /* Funnel: 6 columns becomes scroll-snap strip */
  [style*="grid-template-columns: repeat(6, 1fr)"]{grid-template-columns:repeat(6, 78%) !important;overflow-x:auto !important;scroll-snap-type:x mandatory !important;padding-bottom:12px !important}
  [style*="grid-template-columns: repeat(6, 1fr)"] > *{scroll-snap-align:start !important}

  /* Job Finder specifics — overridden inline via className on redesign */
  .rs-job-layout{grid-template-columns:1fr !important}
  .rs-job-filters{position:static !important;width:100% !important;max-height:none !important;border-right:none !important;border-bottom:1px solid var(--border) !important;padding:16px !important;margin-bottom:16px !important}
  .rs-job-table{font-size:11px !important}
  .rs-job-table th,.rs-job-table td{padding:8px 10px !important}

  /* Generic large padding / tight containers */
  [style*="padding: 28px"]{padding:18px !important}
  [style*="padding: 32px"]{padding:20px !important}
  [style*="padding: 36px"]{padding:22px !important}

  /* Sidebar slide-in for Job Finder — make it near-fullscreen on mobile */
  [style*="width: 900px"][style*="position: fixed"]{width:100vw !important;max-width:100vw !important}
  [style*="width: 460px"][style*="position: fixed"]{width:100vw !important}

  /* Modal — edge-to-edge on mobile */
  [style*="max-width: 540px"]{max-width:94vw !important}
  [style*="max-width: 720px"]{max-width:94vw !important}
}
@media (max-width: 640px){
  nav[style*="padding"] > div:first-child{font-size:14px !important}
  section[style*="padding: 200px 64px 100px"]{padding:100px 16px 40px !important}
  [style*="font-size: 44px"]{font-size:26px !important}
  [style*="gap: 80px"]{gap:32px !important}
  [style*="padding: 60px 64px"]{padding:28px 16px !important}
  /* Hero CTA buttons — stack */
  [style*="marginTop: 48px"][style*="gap: 16px"]{flex-direction:column !important;align-items:stretch !important}
  /* Case study list padding */
  [style*="padding: 28px 36px"]{padding:18px 20px !important}
  [style*="padding: 0 36px 36px 86px"]{padding:0 20px 24px !important}
  /* Disable heavy translate hover on mobile (touch) */
  [style*="transform: translateY(-3px)"]{transform:none !important}
}
`;
const I={dash:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>,users:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,folder:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,doc:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,target:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,check:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>,plus:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,edit:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,trash:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,x:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,back:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,send:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,lock:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,copy:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,upload:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,search:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,activity:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,star:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,settings:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,logout:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,ai:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,arrow:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>,menu:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="16" y2="16"/></svg>,down:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="6 9 12 15 18 9"/></svg>,play:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>};
const Icon=({name,size=18})=><span style={{display:"inline-flex",width:size,height:size,flexShrink:0}}>{I[name]}</span>;

// Primitives
const Badge=({status})=>{const m={draft:{c:"var(--cream-mute)",bg:"rgba(232,224,212,0.06)"},sent:{c:"var(--sky)",bg:"rgba(91,143,168,0.12)"},accepted:{c:"var(--success)",bg:"rgba(107,158,111,0.12)"},rejected:{c:"var(--danger)",bg:"rgba(168,91,91,0.12)"},active:{c:"var(--amber)",bg:"rgba(196,162,101,0.1)"},completed:{c:"var(--success)",bg:"rgba(107,158,111,0.12)"},archived:{c:"var(--cream-mute)",bg:"rgba(232,224,212,0.05)"},todo:{c:"var(--cream-mute)",bg:"rgba(232,224,212,0.06)"},in_progress:{c:"var(--sky)",bg:"rgba(91,143,168,0.12)"},review:{c:"var(--violet)",bg:"rgba(124,111,160,0.12)"}};const s=m[status]||m.draft;return <span style={{fontFamily:"var(--mono)",fontSize:10,fontWeight:500,letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 10px",borderRadius:4,color:s.c,background:s.bg}}>{status?.replace("_"," ")}</span>;};
const Modal=({open,onClose,title,children,wide})=>{if(!open)return null;return(<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}><div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)"}}/><div onClick={e=>e.stopPropagation()} style={{position:"relative",background:"var(--ink-2)",border:"1px solid var(--border-h)",borderRadius:16,width:"92%",maxWidth:wide?720:540,maxHeight:"88vh",overflow:"auto",animation:"fadeUp .25s ease-out"}}><div style={{padding:"24px 28px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:400,fontStyle:"italic",color:"var(--cream)"}}>{title}</h3><button onClick={onClose} className="ghost-btn"><Icon name="x" size={18}/></button></div><div style={{padding:"20px 28px 28px"}}>{children}</div></div></div>);};
const Field=({label,value,onChange,type="text",placeholder,options,rows,disabled,children})=>(<div style={{marginBottom:18}}>{label&&<label style={{display:"block",marginBottom:6,fontFamily:"var(--mono)",fontSize:10,fontWeight:400,color:"var(--cream-mute)",textTransform:"uppercase",letterSpacing:"0.12em"}}>{label}</label>}{type==="select"?<select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} style={{width:"100%",padding:"11px 14px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:14,fontFamily:"var(--sans)",appearance:"none"}}>{options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:type==="textarea"?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows||4} disabled={disabled} style={{width:"100%",padding:"11px 14px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:14,fontFamily:"var(--sans)",resize:"vertical",lineHeight:1.7}}/>:<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{width:"100%",padding:"11px 14px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:14,fontFamily:"var(--sans)"}}/>}{children}</div>);
const Btn=({children,onClick,v="primary",size="md",disabled,style:sx,icon})=>{const vars={primary:{background:"var(--cream)",color:"var(--ink)",border:"none",fontWeight:600},secondary:{background:"transparent",color:"var(--cream-dim)",border:"1px solid var(--border-h)",fontWeight:400},danger:{background:"rgba(168,91,91,0.12)",color:"var(--danger)",border:"1px solid rgba(168,91,91,0.2)",fontWeight:500},ghost:{background:"transparent",color:"var(--cream-mute)",border:"none",fontWeight:400},ai:{background:"linear-gradient(135deg,var(--violet),var(--sky))",color:"#fff",border:"none",fontWeight:600}};const sizes={sm:{padding:"7px 14px",fontSize:12},md:{padding:"10px 20px",fontSize:13},lg:{padding:"14px 32px",fontSize:14}};return <button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:7,borderRadius:8,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,fontFamily:"var(--sans)",letterSpacing:"0.01em",transition:"all .2s",...vars[v],...sizes[size],...sx}}>{icon&&<Icon name={icon} size={13}/>}{children}</button>;};
const Empty=({icon="folder",title,action,onAction})=>(<div style={{textAlign:"center",padding:"72px 20px",color:"var(--cream-mute)"}}><div style={{marginBottom:20,opacity:0.15}}><Icon name={icon} size={56}/></div><p style={{fontSize:15,fontFamily:"var(--serif)",fontStyle:"italic",marginBottom:20}}>{title}</p>{action&&<Btn onClick={onAction} icon="plus">{action}</Btn>}</div>);
const Tabs=({tabs,active,onChange})=>(<div style={{display:"flex",gap:0,marginBottom:32,borderBottom:"1px solid var(--border)"}}>{tabs.map(t=><button key={t.key} onClick={()=>onChange(t.key)} style={{padding:"12px 24px",background:"none",border:"none",borderBottom:active===t.key?"1px solid var(--cream)":"1px solid transparent",color:active===t.key?"var(--cream)":"var(--cream-mute)",fontSize:13,fontWeight:active===t.key?500:400,cursor:"pointer",fontFamily:"var(--sans)",transition:"all 0.2s"}}>{t.label}{t.count!=null&&<span style={{marginLeft:8,fontFamily:"var(--mono)",fontSize:10,opacity:0.5}}>{t.count}</span>}</button>)}</div>);
const AIButton=({label="Enhance with AI",onConfirm,content})=>{const[st,setSt]=useState("idle");const[prompt,setPrompt]=useState("Improve for clarity and strategic impact.");const[result,setResult]=useState("");const run=async()=>{setSt("loading");const r=await callAI(`${prompt}\n\nContent:\n${content}`);setResult(r);setSt("preview");};if(st==="idle")return <div style={{marginTop:8}}><Btn v="ai" size="sm" icon="ai" onClick={()=>setSt("editing")}>{label}</Btn></div>;if(st==="loading")return <div style={{padding:24,textAlign:"center"}}><div style={{width:20,height:20,border:"2px solid var(--border)",borderTopColor:"var(--violet)",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block"}}/></div>;if(st==="editing")return(<div style={{marginTop:12,padding:16,background:"rgba(124,111,160,0.06)",border:"1px solid rgba(124,111,160,0.15)",borderRadius:10}}><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={2} style={{width:"100%",padding:10,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(124,111,160,0.15)",borderRadius:6,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)",resize:"none"}}/><div style={{display:"flex",gap:8,marginTop:10}}><Btn v="ai" size="sm" onClick={run}>Run</Btn><Btn v="ghost" size="sm" onClick={()=>setSt("idle")}>Cancel</Btn></div></div>);return(<div style={{marginTop:12,padding:16,background:"rgba(107,158,111,0.06)",border:"1px solid rgba(107,158,111,0.15)",borderRadius:10}}><div style={{padding:14,background:"rgba(0,0,0,0.3)",borderRadius:6,color:"var(--cream-dim)",fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result}</div><div style={{display:"flex",gap:8,marginTop:12}}><Btn size="sm" icon="check" onClick={()=>{onConfirm(result);setSt("idle");setResult("");}}>Accept</Btn><Btn v="ai" size="sm" onClick={run}>Retry</Btn><Btn v="ghost" size="sm" onClick={()=>{setSt("idle");setResult("");}}>Discard</Btn></div></div>);};

// ============================================================
// LEAD FUNNEL (ENLARGED, HOLISTIC)
// ============================================================
const LeadFunnel = () => {
  const [active, setActive] = useState(null);
  const stages = [
    { id: "signals", label: "Raw Signals", sub: "Intent data, web behavior, third-party sources, referral networks", count: "10,000+", color: "#5B8FA8", pct: 100, details: ["Website visitor behavior tracking", "Third-party intent signal monitoring", "Content engagement and research activity", "Event and conference lead capture", "Syndicated content interaction data", "Referral and partner network inputs"] },
    { id: "enriched", label: "Enriched Data", sub: "Verified contacts, firmographic profiles, ICP scoring", count: "4,200", color: "#7C6FA0", pct: 72, details: ["Contact verification and deduplication", "Company firmographic enrichment", "Technology stack identification", "Organizational structure mapping", "Email and phone verification", "ICP fit scoring and segmentation"] },
    { id: "leads", label: "Actioning Leads", sub: "Pipeline entry, sequence enrollment, outreach activation", count: "1,800", color: "#C4A265", pct: 52, details: ["Lead enters active pipeline", "Auto-assignment via territory rules", "Quality review and acceptance gate", "Enrolled in structured outreach sequence", "AI-personalized messaging generated", "Multi-channel touchpoints scheduled"] },
    { id: "mql", label: "MQLs", sub: "Score-qualified, marketing-validated, sales-ready", count: "680", color: "#7B8F7E", pct: 36, details: ["Behavioral score threshold crossed", "Lifecycle stage updated to qualified", "Deal record auto-created for tracking", "Territory-based ownership assigned", "Outreach status moves to active", "Marketing classification applied"] },
    { id: "sql", label: "SQLs", sub: "Sales-accepted, discovery completed, budget confirmed", count: "240", color: "#A8726F", pct: 22, details: ["Prospect engaged via reply or call", "Discovery conversation completed", "Qualification framework applied", "Business case and pain validated", "Deal formally created with value", "Multi-stakeholder engagement begins"] },
    { id: "opp", label: "Opportunities", sub: "Active pipeline, deal management, forecasting", count: "85", color: "#6B9E6F", pct: 12, details: ["Deal linked to full account record", "Qualification fields completed", "Close timeline and value assigned", "Pipeline managed in deal board", "Stakeholder research ongoing", "Revenue forecasting activated"] },
  ];
  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: 8 }}>
        {stages.map((s, i) => {
          const isActive = active === s.id;
          return (
            <div key={s.id} style={{ position: "relative" }}>
              {/* Connector arrow */}
              {i > 0 && <div style={{ position: "absolute", left: -6, top: 52, zIndex: 2 }}><svg width="12" height="16" viewBox="0 0 12 16"><path d="M0 3 L8 8 L0 13" fill="none" stroke={stages[i-1].color} strokeWidth="1.5" opacity="0.4"/></svg></div>}
              <div onClick={() => setActive(isActive ? null : s.id)} style={{
                padding: "24px 18px", borderRadius: 14, cursor: "pointer", transition: "all .3s", minHeight: isActive ? "auto" : 200,
                background: isActive ? `${s.color}12` : "var(--ink)", border: `1px solid ${isActive ? s.color + "40" : "var(--border)"}`,
                animation: isActive ? "nodeGlow 2.5s ease-in-out infinite" : "none",
              }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = s.color + "30"; e.currentTarget.style.background = `${s.color}08`; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--ink)"; }}}>
                <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 18, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.pct}%`, background: s.color, borderRadius: 2, transition: "width 1s" }} />
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: s.color, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Stage {num(i + 1)}</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", color: "var(--cream)", marginBottom: 8, lineHeight: 1.2 }}>{s.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", lineHeight: 1.6, marginBottom: 14 }}>{s.sub}</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 42, fontStyle: "italic", color: s.color, lineHeight: 1 }}>{s.count}</div>
                {isActive && (
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${s.color}20`, animation: "fadeUp .3s ease-out" }}>
                    {s.details.map((d, di) => (
                      <div key={di} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 7 }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: s.color, marginTop: 6, flexShrink: 0, opacity: 0.7 }} />
                        <span style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.5 }}>{d}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: "12px 4px" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--cream-mute)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Click any stage to expand</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", animation: "flowPulse 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--cream-mute)", letterSpacing: "0.1em" }}>LIVE SIGNAL FLOW</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// HERO FUNNEL
// ============================================================
const HeroFunnel = () => {
  const stages = [
    { label: "Raw Signals", sub: "Intent · Visits · Form Fills", color: "#6bb5d6", w: 100 },
    { label: "Qualified Leads", sub: "ICP Match · Behavioral Score", color: "#9b7fd4", w: 78 },
    { label: "MQLs", sub: "Nurtured · Sales-Ready Content", color: "#c4a265", w: 56 },
    { label: "SQLs", sub: "Discovery Called · Opportunity", color: "#d4777f", w: 38 },
    { label: "Pipeline", sub: "Actionable Revenue", color: "#6b9e6f", w: 22 },
  ];
  const particles = [...Array(10)].map((_, i) => ({ id: i, x: 8 + (i * 8.4) % 84, delay: i * 0.55, dur: 3.2 + (i % 4) * 0.4 }));
  const funnelHeight = 460;
  return (
    <div style={{ position: "relative", height: funnelHeight, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      {/* Particle overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {particles.map(p => (
          <div key={p.id} style={{ position: "absolute", width: 5, height: 5, borderRadius: "50%", background: `rgba(196,162,101,0.7)`, left: `${p.x}%`, top: 0, "--funnel-h": `${funnelHeight}px`, animation: `particleFlow ${p.dur}s ease-in ${p.delay}s infinite` }} />
        ))}
      </div>
      {stages.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.9 + i * 0.15 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "flex-start" }}
        >
          <div style={{ width: `${s.w}%`, padding: "8px 14px", background: `${s.color}12`, border: `1px solid ${s.color}35`, borderRadius: 7, display: "flex", justifyContent: "space-between", alignItems: "center", backdropFilter: "blur(4px)" }}>
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: s.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--cream-mute)", marginTop: 2 }}>{s.sub}</div>
            </div>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, opacity: 0.8, animation: `flowPulse ${1.4 + i * 0.25}s ease-in-out ${i * 0.2}s infinite` }} />
          </div>
          {i < stages.length - 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 1.75 }}
              style={{ width: 1, flex: 1, background: `linear-gradient(180deg, ${s.color}50, ${stages[i + 1].color}40)`, animation: `connectorPulse 2s ease-in-out ${i * 0.3}s infinite`, minHeight: 12 }}
            />
          )}
        </motion.div>
      ))}
      <div style={{ position: "absolute", bottom: -24, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--cream-mute)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Raw Signals → Pipeline</span>
      </div>
    </div>
  );
};

// ============================================================
// DIAGNOSTIC TOOL 1: Revenue Leak Detector
// ============================================================
const RevenueLeak = () => {
  const [leads, setLeads] = useState(""); const [mqlRate, setMqlRate] = useState(""); const [sqlRate, setSqlRate] = useState(""); const [winRate, setWinRate] = useState(""); const [dealSize, setDealSize] = useState(""); const [ran, setRan] = useState(false);
  const l = parseInt(leads) || 0; const mq = (parseInt(mqlRate) || 0) / 100; const sq = (parseInt(sqlRate) || 0) / 100; const wr = (parseInt(winRate) || 0) / 100; const ds = parseInt(dealSize) || 0;
  const mqls = Math.round(l * mq); const sqls = Math.round(mqls * sq); const wins = Math.round(sqls * wr); const rev = wins * ds;
  const leaks = [
    { stage: "Lead → MQL", lost: l - mqls, pct: l > 0 ? Math.round((1 - mq) * 100) : 0, dollarLost: (l - mqls) * sq * wr * ds },
    { stage: "MQL → SQL", lost: mqls - sqls, pct: mqls > 0 ? Math.round((1 - sq) * 100) : 0, dollarLost: (mqls - sqls) * wr * ds },
    { stage: "SQL → Won", lost: sqls - wins, pct: sqls > 0 ? Math.round((1 - wr) * 100) : 0, dollarLost: (sqls - wins) * ds },
  ];
  const biggestLeak = leaks.reduce((a, b) => b.dollarLost > a.dollarLost ? b : a, leaks[0]);
  const stages = [{ label: "Leads", val: l, c: "var(--sky)" }, { label: "MQLs", val: mqls, c: "var(--violet)" }, { label: "SQLs", val: sqls, c: "var(--amber)" }, { label: "Won", val: wins, c: "var(--success)" }];
  const canRun = l > 0 && mq > 0 && sq > 0 && wr > 0 && ds > 0;
  const inp = (label, val, set, ph) => (<div><label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--cream-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{label}</label><input value={val} onChange={e => { set(e.target.value); setRan(false); }} placeholder={ph} style={{ width: "100%", padding: "10px 14px", background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--cream)", fontSize: 15, fontFamily: "var(--sans)" }} /></div>);
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
      {inp("Monthly Leads", leads, setLeads, "1000")}{inp("MQL Rate %", mqlRate, setMqlRate, "25")}{inp("SQL Rate %", sqlRate, setSqlRate, "30")}{inp("Win Rate %", winRate, setWinRate, "20")}{inp("Avg Deal $", dealSize, setDealSize, "15000")}
    </div>
    {!ran && <button onClick={() => setRan(true)} disabled={!canRun} style={{ padding: "12px 28px", background: canRun ? "var(--cream)" : "var(--ink-3)", color: canRun ? "var(--ink)" : "var(--cream-mute)", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: canRun ? "pointer" : "not-allowed", fontFamily: "var(--sans)", opacity: canRun ? 1 : 0.3 }}>Detect Leaks</button>}
    {ran && canRun && (<div style={{ animation: "fadeUp .4s ease-out" }}>
      {/* Visual funnel */}
      <div style={{ marginBottom: 24 }}>
        {/* Numbers row — all at same height */}
        <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
          {stages.map(s => (
            <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", color: s.c }}>{s.val.toLocaleString()}</span>
            </div>
          ))}
        </div>
        {/* Bars row — grow upward from shared baseline */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100 }}>
          {stages.map((s, i) => { const maxH = 90; const h = l > 0 ? Math.max(12, (s.val / l) * maxH) : 12; return (
            <div key={s.label} style={{ flex: 1, height: h, background: `${s.c}25`, borderRadius: 6, border: `1px solid ${s.c}40`, position: "relative", transition: "height .6s ease-out" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "100%", background: `linear-gradient(180deg, ${s.c}40, ${s.c}15)`, borderRadius: 6 }} />
            </div>
          ); })}
        </div>
        {/* Labels + drop % row — all at same baseline */}
        <div style={{ display: "flex", gap: 2, marginTop: 8 }}>
          {stages.map((s, i) => (
            <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--cream-mute)", textTransform: "uppercase" }}>{s.label}</span>
              {i < stages.length - 1 && leaks[i] && <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--danger)", marginTop: 2 }}>-{leaks[i].pct}%</span>}
            </div>
          ))}
        </div>
      </div>
      {/* Leak breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {leaks.map((lk, i) => (<div key={i} style={{ padding: "20px 18px", background: lk === biggestLeak ? "rgba(168,91,91,0.1)" : "var(--ink-2)", borderRadius: 14, border: `1px solid ${lk === biggestLeak ? "rgba(168,91,91,0.35)" : "var(--border)"}`, animation: `slideInUp .4s ease-out ${i * 0.1}s both`, boxShadow: lk === biggestLeak ? "0 8px 32px rgba(168,91,91,0.12)" : "none", position: "relative", overflow: "hidden" }}>
          {lk === biggestLeak && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, var(--danger), transparent)" }} />}
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{lk.stage}</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 32, fontStyle: "italic", color: "var(--danger)", lineHeight: 1, marginBottom: 6, textShadow: lk === biggestLeak ? "0 0 24px rgba(168,91,91,0.4)" : "none" }}>${Math.round(lk.dollarLost).toLocaleString()}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--cream-mute)", marginTop: 4 }}>{lk.lost.toLocaleString()} leads lost · {lk.pct}% drop</div>
          {lk === biggestLeak && <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--danger)", marginTop: 10, padding: "4px 10px", background: "rgba(168,91,91,0.12)", borderRadius: 4, display: "inline-block", letterSpacing: "0.1em", fontWeight: 700 }}>▲ BIGGEST LEAK</div>}
        </div>))}
      </div>
      {/* Bottom line */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "var(--border)", borderRadius: 14, overflow: "hidden", animation: "slideInUp .4s ease-out .35s both" }}>
        <div style={{ padding: "22px 24px", background: "var(--ink-2)" }}><span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", display: "block", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Monthly Revenue</span><div style={{ fontFamily: "var(--serif)", fontSize: 36, fontStyle: "italic", color: "var(--cream)", lineHeight: 1 }}>${rev.toLocaleString()}</div></div>
        <div style={{ padding: "22px 24px", background: "rgba(107,158,111,0.06)" }}><span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--success)", display: "block", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>+50% Leak Fixed</span><div style={{ fontFamily: "var(--serif)", fontSize: 36, fontStyle: "italic", color: "var(--success)", lineHeight: 1, textShadow: "0 0 20px rgba(107,158,111,0.35)" }}>${Math.round(rev + biggestLeak.dollarLost * 0.5).toLocaleString()}</div></div>
        <div style={{ padding: "22px 24px", background: "rgba(196,162,101,0.06)" }}><span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--amber)", display: "block", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Annual Upside</span><div style={{ fontFamily: "var(--serif)", fontSize: 36, fontStyle: "italic", color: "var(--amber)", lineHeight: 1, textShadow: "0 0 20px rgba(196,162,101,0.35)" }}>${Math.round(biggestLeak.dollarLost * 0.5 * 12).toLocaleString()}</div></div>
      </div>
    </div>)}
  </div>);
};

// ============================================================
// DIAGNOSTIC TOOL 2: GTM Readiness Score
// ============================================================
const GTMReadiness = () => {
  const dims = [
    { key: "scoring", label: "Lead Scoring", q: "Do you have automated lead scoring based on behavior + fit?" },
    { key: "routing", label: "Lead Routing", q: "Are leads auto-assigned to reps based on territory/segment rules?" },
    { key: "lifecycle", label: "Lifecycle Stages", q: "Are contacts mapped to defined stages (Lead → MQL → SQL → Customer)?" },
    { key: "attribution", label: "Attribution", q: "Can you trace a closed deal back to its original marketing source?" },
    { key: "automation", label: "Workflow Automation", q: "Are handoffs between Marketing, Sales, and CS automated?" },
    { key: "ai", label: "AI in GTM", q: "Are you using AI agents for prospecting, research, or CRM tasks?" },
  ];
  const [scores, setScores] = useState({});
  const setScore = (key, val) => setScores(p => ({ ...p, [key]: p[key] === val ? undefined : val }));
  const opts = [{ v: 2, t: "Yes", c: "var(--success)" }, { v: 1, t: "Partial", c: "var(--amber)" }, { v: 0, t: "No", c: "var(--danger)" }];
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const max = dims.length * 2;
  const pct = max > 0 && Object.keys(scores).length === dims.length ? Math.round((total / max) * 100) : null;
  const grade = pct === null ? null : pct >= 80 ? { g: "A", c: "var(--success)", t: "Operationally mature. Focus on AI augmentation and optimization." } : pct >= 60 ? { g: "B", c: "var(--amber)", t: "Foundation is there. Critical gaps in automation and data flow need attention." } : pct >= 35 ? { g: "C", c: "var(--rose)", t: "Significant operational debt. Prioritize infrastructure before scaling." } : { g: "D", c: "var(--danger)", t: "Operating on manual processes. Immediate intervention needed to support growth." };
  return (<div>
    <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
      {dims.map(d => { const v = scores[d.key]; return (
        <div key={d.key} style={{ padding: "16px 20px", background: v !== undefined ? `${opts.find(o=>o.v===v)?.c}08` : "var(--ink-2)", borderRadius: 12, border: `1px solid ${v !== undefined ? opts.find(o=>o.v===v)?.c + "25" : "var(--border)"}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, transition: "all .25s" }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, color: "var(--cream)", fontWeight: 600, marginBottom: 3 }}>{d.label}</div><div style={{ fontSize: 12, color: "var(--cream-mute)", lineHeight: 1.5 }}>{d.q}</div></div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {opts.map(opt => (
              <button key={opt.v} onClick={() => setScore(d.key, opt.v)} style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${v === opt.v ? opt.c : "var(--border)"}`, background: v === opt.v ? `${opt.c}18` : "transparent", color: v === opt.v ? opt.c : "var(--cream-mute)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: v === opt.v ? 700 : 400, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", transition: "all .15s", transform: v === opt.v ? "scale(1.05)" : "scale(1)" }}>{opt.t}</button>
            ))}
          </div>
        </div>
      ); })}
    </div>
    {grade && (<div style={{ animation: "fadeUp .4s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 28, padding: "28px 32px", background: "var(--ink)", borderRadius: 16, border: `1px solid ${grade.c}30`, boxShadow: `0 0 48px ${grade.c}10` }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 80, fontStyle: "italic", color: grade.c, lineHeight: 1, animation: "scaleIn .5s ease-out", textShadow: `0 0 40px ${grade.c}50` }}>{grade.g}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 18, color: grade.c, fontWeight: 700 }}>{pct}%</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--cream-mute)", letterSpacing: "0.12em" }}>GTM SCORE</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", color: "var(--cream)", marginBottom: 10 }}>GTM Readiness Grade</div>
          <p style={{ fontSize: 14, color: "var(--cream-dim)", lineHeight: 1.8, marginBottom: 20 }}>{grade.t}</p>
          <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>{dims.map((d, di) => { const v = scores[d.key]; const c = v === 2 ? "var(--success)" : v === 1 ? "var(--amber)" : "var(--danger)"; return (<div key={d.key} style={{ flex: 1, height: 8, borderRadius: 4, background: c, opacity: 0.8, animation: `slideInUp .4s ease-out ${di * 0.07}s both`, boxShadow: `0 2px 8px ${c}40` }} title={d.label} />); })}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>{dims.map(d => { const v = scores[d.key]; const c = v === 2 ? "var(--success)" : v === 1 ? "var(--amber)" : "var(--danger)"; return <span key={d.key} style={{ fontFamily: "var(--mono)", fontSize: 8, color: c, flex: 1, textAlign: "center", letterSpacing: "0.06em" }}>{d.label.split(" ")[0]}</span>; })}</div>
        </div>
      </div>
    </div>)}
  </div>);
};

// ============================================================
// DIAGNOSTIC TOOL 3: Automation ROI Calculator
// ============================================================
const AutomationROI = () => {
  const [reps, setReps] = useState(""); const [hours, setHours] = useState(""); const [dealVal, setDealVal] = useState(""); const [ran, setRan] = useState(false);
  const r = parseInt(reps) || 0; const h = parseInt(hours) || 0; const dv = parseInt(dealVal) || 0;
  const weeklySaved = r * h * 0.6; const annualHours = weeklySaved * 50;
  const additionalDeals = Math.round(r * (h * 0.6 / 40) * 2.5 * 12);
  const pipelineGain = additionalDeals * dv;
  const revGain = Math.round(pipelineGain * 0.25);
  const paybackWeeks = revGain > 0 ? Math.max(2, Math.round(12 / (revGain / 50000))) : 0;
  const canRun = r > 0 && h > 0 && dv > 0;
  const inp = (label, val, set, ph) => (<div><label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--cream-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{label}</label><input value={val} onChange={e => { set(e.target.value); setRan(false); }} placeholder={ph} style={{ width: "100%", padding: "10px 14px", background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--cream)", fontSize: 15, fontFamily: "var(--sans)" }} /></div>);
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
      {inp("Sales Reps", reps, setReps, "8")}{inp("Hrs/Week on Admin", hours, setHours, "15")}{inp("Avg Deal Value $", dealVal, setDealVal, "12000")}
    </div>
    {!ran && <button onClick={() => setRan(true)} disabled={!canRun} style={{ padding: "12px 28px", background: canRun ? "var(--cream)" : "var(--ink-3)", color: canRun ? "var(--ink)" : "var(--cream-mute)", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: canRun ? "pointer" : "not-allowed", fontFamily: "var(--sans)", opacity: canRun ? 1 : 0.3 }}>Calculate ROI</button>}
    {ran && canRun && (<div style={{ animation: "fadeUp .4s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Hours Reclaimed /Year", val: annualHours.toLocaleString(), sub: `${Math.round(weeklySaved)}hrs/week freed up`, c: "var(--sky)" },
          { label: "Additional Pipeline", val: `$${pipelineGain.toLocaleString()}`, sub: `~${additionalDeals} more deals in pipeline`, c: "var(--violet)" },
          { label: "Projected Revenue Gain", val: `$${revGain.toLocaleString()}`, sub: "At 25% close rate on new pipeline", c: "var(--success)" },
          { label: "Estimated Payback", val: `${paybackWeeks} weeks`, sub: "Time to recoup implementation cost", c: "var(--amber)" },
        ].map((m, i) => (
          <div key={i} style={{ padding: "22px 16px", background: `${m.c}08`, borderRadius: 14, border: `1px solid ${m.c}22`, textAlign: "center", animation: `slideInUp .4s ease-out ${i * 0.1}s both`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${m.c}, transparent)` }} />
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>{m.label}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 34, fontStyle: "italic", color: m.c, textShadow: `0 0 24px ${m.c}40`, lineHeight: 1 }}>{m.val}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", marginTop: 10, lineHeight: 1.5 }}>{m.sub}</div>
          </div>
        ))}
      </div>
      {/* Visual bar showing time reallocation */}
      <div style={{ padding: "16px 20px", background: "var(--ink)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Rep Time Reallocation (per week)</div>
        <div style={{ display: "flex", height: 32, borderRadius: 6, overflow: "hidden", gap: 2 }}>
          <div style={{ width: `${((40 - h) / 40) * 100}%`, background: "var(--sky)30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--cream-mute)", fontFamily: "var(--mono)" }}>Selling: {40 - h}h</div>
          <div style={{ width: `${(h * 0.4 / 40) * 100}%`, background: "var(--amber)30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--cream-mute)", fontFamily: "var(--mono)" }}>Remaining: {Math.round(h * 0.4)}h</div>
          <div style={{ width: `${(h * 0.6 / 40) * 100}%`, background: "var(--success)40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--cream)", fontFamily: "var(--mono)", fontWeight: 600 }}>+{Math.round(h * 0.6)}h selling</div>
        </div>
      </div>
    </div>)}
  </div>);
};

// ============================================================
// DIAGNOSTIC TOOL 4: Stack Integration Map
// ============================================================
const StackMap = () => {
  const tools = [
    { id: "crm", label: "CRM", ex: "HubSpot, Salesforce" }, { id: "enrich", label: "Enrichment", ex: "ZoomInfo, Apollo, Clearbit" },
    { id: "marketing", label: "Marketing Automation", ex: "Braze, Marketo, Mailchimp" }, { id: "analytics", label: "Product Analytics", ex: "Amplitude, Mixpanel, Heap" },
    { id: "middleware", label: "Middleware", ex: "Make, Zapier, n8n" }, { id: "ai", label: "AI Tools", ex: "Claude, GPT, MindStudio" },
  ];
  const suggestedAdditions = [
    { id: "revenue-intel", label: "Revenue Intelligence", ex: "Gong, Chorus, Clari", obj: "Record and analyze every sales call with AI — extracting deal risks, rep coaching moments, and competitive intel automatically.", fit: "Syncs call summaries and deal health scores directly into CRM. Triggers risk alerts and auto-updates forecast fields.", color: "var(--sky)" },
    { id: "intent", label: "Intent Data Platform", ex: "Bombora, 6sense, G2", obj: "Surface accounts actively researching your category before they ever fill a form. The highest-value signal in modern GTM.", fit: "Feeds into lead scoring as a top-weighted signal. Auto-prioritizes outreach queues so reps call warm accounts first.", color: "var(--violet)" },
    { id: "scheduling", label: "Scheduling Automation", ex: "Chili Piper, Calendly", obj: "Eliminate meeting back-and-forth. Instant round-robin booking with automated reminders and no-show workflows.", fit: "Embedded directly in email sequences and web forms to convert intent into booked meetings with zero friction.", color: "var(--amber)" },
    { id: "warehouse", label: "Data Warehouse / BI", ex: "Snowflake, BigQuery, Looker", obj: "Centralize all revenue data from CRM, marketing, and product into a single source of truth for cross-channel reporting.", fit: "Powers executive dashboards with full-funnel attribution — from first touch to closed revenue — across all channels.", color: "var(--success)" },
    { id: "cs-platform", label: "Customer Success Platform", ex: "Gainsight, ChurnZero, Totango", obj: "Track customer health scores post-sale and automate retention playbooks triggered by product usage signals.", fit: "Connects to product analytics and CRM to auto-trigger CS intervention when health score drops below threshold.", color: "var(--sage)" },
    { id: "abm", label: "Account-Based Marketing", ex: "Demandbase, Terminus, RollWorks", obj: "Run coordinated multi-channel campaigns targeting your exact ICP accounts with personalized messaging at scale.", fit: "Syncs with CRM account records to ensure sales and marketing are targeting the same account list simultaneously.", color: "var(--rose)" },
  ];
  const [selected, setSelected] = useState(new Set());
  const toggle = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const integrations = {
    "crm+enrich": { label: "Auto-enrichment on lead creation", impact: "high" },
    "crm+marketing": { label: "Lifecycle-triggered campaigns", impact: "high" },
    "crm+analytics": { label: "PQL routing from product signals", impact: "high" },
    "crm+middleware": { label: "Cross-platform workflow automation", impact: "medium" },
    "crm+ai": { label: "AI-powered CRM fields and scoring", impact: "high" },
    "enrich+marketing": { label: "Segment enrichment for targeting", impact: "medium" },
    "enrich+ai": { label: "AI research agent with verified data", impact: "medium" },
    "marketing+analytics": { label: "Behavior-triggered lifecycle messaging", impact: "high" },
    "marketing+ai": { label: "AI-generated personalized content", impact: "medium" },
    "analytics+ai": { label: "Predictive churn and expansion signals", impact: "high" },
    "middleware+ai": { label: "Autonomous multi-step AI workflows", impact: "high" },
  };

  const active = []; const missing = [];
  Object.entries(integrations).forEach(([key, val]) => {
    const [a, b] = key.split("+");
    if (selected.has(a) && selected.has(b)) active.push({ ...val, key });
    else if (selected.has(a) || selected.has(b)) missing.push({ ...val, key, needs: selected.has(a) ? tools.find(t => t.id === b)?.label : tools.find(t => t.id === a)?.label });
  });

  return (<div>
    <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", marginBottom: 12, letterSpacing: "0.08em" }}>SELECT TOOLS IN YOUR CURRENT STACK</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
      {tools.map(t => (<button key={t.id} onClick={() => toggle(t.id)} style={{ padding: "16px 18px", background: selected.has(t.id) ? "rgba(196,162,101,0.1)" : "var(--ink)", border: `1.5px solid ${selected.has(t.id) ? "rgba(196,162,101,0.4)" : "var(--border)"}`, borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all .2s", transform: selected.has(t.id) ? "translateY(-1px)" : "none", boxShadow: selected.has(t.id) ? "0 4px 16px rgba(196,162,101,0.12)" : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ fontSize: 14, color: selected.has(t.id) ? "var(--cream)" : "var(--cream-dim)", fontWeight: 600 }}>{t.label}</div>
          {selected.has(t.id) && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--amber)", animation: "flowPulse 1.5s ease-in-out infinite", flexShrink: 0, marginTop: 3 }} />}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: selected.has(t.id) ? "var(--amber)" : "var(--cream-mute)" }}>{t.ex}</div>
      </button>))}
    </div>
    {selected.size >= 2 && (<div style={{ animation: "fadeUp .3s ease-out" }}>
      {active.length > 0 && (<div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--success)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
          Automations You Should Have ({active.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{active.map((a, ai) => (
          <div key={a.key} style={{ padding: "14px 16px", background: "rgba(107,158,111,0.06)", borderRadius: 10, border: "1px solid rgba(107,158,111,0.18)", display: "flex", justifyContent: "space-between", alignItems: "center", animation: `slideInUp .35s ease-out ${ai * 0.06}s both` }}>
            <span style={{ fontSize: 13, color: "var(--cream-dim)", fontWeight: 500 }}>{a.label}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: a.impact === "high" ? "var(--success)" : "var(--amber)", padding: "3px 8px", borderRadius: 4, background: a.impact === "high" ? "rgba(107,158,111,0.12)" : "rgba(196,162,101,0.12)", fontWeight: 700 }}>{a.impact.toUpperCase()}</span>
          </div>
        ))}</div>
      </div>)}
      {missing.length > 0 && (<div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)" }} />
          Unlocked by Adding ({missing.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{missing.map(m => (
          <div key={m.key} style={{ padding: "14px 16px", background: "rgba(196,162,101,0.05)", borderRadius: 10, border: "1px solid rgba(196,162,101,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--cream-mute)" }}>{m.label}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--amber)", padding: "3px 8px", borderRadius: 4, background: "rgba(196,162,101,0.1)", fontWeight: 600 }}>+ {m.needs}</span>
          </div>
        ))}</div>
      </div>)}
    </div>)}
    {/* Suggested additions — always visible */}
    <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--violet)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--violet)", animation: "flowPulse 2s ease-in-out infinite" }} />
        Recommended Stack Additions
      </div>
      <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", marginBottom: 16, lineHeight: 1.6 }}>Tools that would meaningfully upgrade your GTM architecture based on high-impact gaps we commonly find.</p>
      <div style={{ display: "grid", gap: 10 }}>
        {suggestedAdditions.map((s, si) => (
          <div key={s.id} style={{ padding: "20px 22px", background: `${s.color}06`, borderRadius: 12, border: `1px solid ${s.color}20`, animation: `slideInUp .4s ease-out ${si * 0.08}s both` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: s.color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Category</div>
                <div style={{ fontSize: 15, color: "var(--cream)", fontWeight: 700, marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)" }}>{s.ex}</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: s.color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>What it does</div>
                <div style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.6 }}>{s.obj}</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: s.color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>How it fits your stack</div>
                <div style={{ fontSize: 12, color: "var(--cream-mute)", lineHeight: 1.6 }}>{s.fit}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>);
};

// ============================================================
// PORTFOLIO PAGE (Consulting Website)
// ============================================================
// ============================================================
// PARTICLE CANVAS — hero background
// ============================================================
const ParticleCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const COUNT = 90;   // was 60, +50%
    let raf;
    let particles = [];

    const resize = () => {
      // Use the parent's rendered size, not CSS 100%
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const initParticles = () => {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        // slow drift — speed reduced 30% from 0.35 → 0.245
        vx: (Math.random() - 0.5) * 0.245,
        vy: (Math.random() - 0.5) * 0.245,
        r: Math.random() * 1.4 + 0.6,          // 0.6 – 2 px radius (unchanged)
        a: Math.random() * 0.12 + 0.23,         // 0.23 – 0.35 opacity — more visible but still subtle
      }));
    };

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // Wrap around edges seamlessly
        if (p.x < -4) p.x = canvas.width + 4;
        else if (p.x > canvas.width + 4) p.x = -4;
        if (p.y < -4) p.y = canvas.height + 4;
        else if (p.y > canvas.height + 4) p.y = -4;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        // cream-white tint to stay coherent with the design system
        ctx.fillStyle = `rgba(232,224,212,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    initParticles();
    tick();

    const onResize = () => {
      resize();
      // Redistribute particles so none cluster at old edges
      for (const p of particles) {
        if (p.x > canvas.width)  p.x = Math.random() * canvas.width;
        if (p.y > canvas.height) p.y = Math.random() * canvas.height;
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
};

// ============================================================
// STAT COUNTER — counts up from 0 to target on scroll-into-view
// ============================================================
const StatCounter = ({ value, label }) => {
  const match = value.match(/^(\d+)(.*)$/);
  const target = parseInt(match[1], 10);
  const suffix = match[2] || "";
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);
  const rafRef = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !startedRef.current) {
        startedRef.current = true;
        const duration = 1800;
        let startTime = null;
        const tick = (now) => {
          if (!startTime) startTime = now;
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          setCount(Math.round(eased * target));
          if (progress < 1) {
            rafRef.current = requestAnimationFrame(tick);
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    }, { threshold: 0 }); // fire as soon as any pixel enters viewport
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startedRef.current = false; // reset so StrictMode double-mount works
    };
  }, [target]);
  return (
    <div ref={ref}>
      <span style={{ fontFamily: "var(--serif)", fontSize: 38, fontStyle: "italic", color: "var(--amber)" }}>{count}{suffix}</span>
      <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{label}</span>
    </div>
  );
};

const PortfolioPage = ({ data, onLogin }) => {
  const ps = data.portfolioSettings;
  const [expandedCase, setExpandedCase] = useState(null);
  const [hov, setHov] = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [activeTool, setActiveTool] = useState(0);
  const [cForm, setCForm] = useState({ name: "", email: "", company: "", message: "", budget: "" });
  const [cState, setCState] = useState("idle");
  const [cError, setCError] = useState("");
  const categories = ["all", ...new Set(CASE_STUDIES.map(c => c.category))];
  const filteredCases = filterCat === "all" ? CASE_STUDIES : CASE_STUDIES.filter(c => c.category === filterCat);

  const submitContact = async () => {
    if (!cForm.name || !cForm.email || !cForm.message) return;
    setCState("loading");
    try {
      const base = window.location.hostname === "localhost" ? "https://revosys.pro" : "";
      const res = await fetch(`${base}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cForm),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to send");
      setCState("success");
      setCForm({ name: "", email: "", company: "", message: "", budget: "" });
    } catch (err) {
      setCState("error");
      setCError(err.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, opacity: 0.03, background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }} />
      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "20px 64px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(11,11,11,0.88)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}><span style={{fontFamily:"var(--serif)",fontSize:24,fontStyle:"italic",color:"var(--cream)"}}>Revo</span><span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--amber)",letterSpacing:"0.15em",textTransform:"uppercase",marginLeft:4}}>-Sys</span><span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)",letterSpacing:"0.12em",textTransform:"uppercase",marginLeft:14}}>GTM Platform</span></div>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["About", "Funnel", "Work"].map(s => (<button key={s} onClick={() => document.getElementById(s.toLowerCase())?.scrollIntoView({ behavior: "smooth" })} style={{ background: "none", border: "none", color: "var(--cream-mute)", fontSize: 13, fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", transition: "color .2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--cream)"} onMouseLeave={e => e.currentTarget.style.color = "var(--cream-mute)"}>{s}</button>))}
          <a href="/blog" style={{ background: "none", border: "none", color: "var(--cream-mute)", fontSize: 13, fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", transition: "color .2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--cream)"} onMouseLeave={e => e.currentTarget.style.color = "var(--cream-mute)"}>Blog</a>
          <button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} style={{ background: "none", border: "none", color: "var(--cream-mute)", fontSize: 13, fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", transition: "color .2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--cream)"} onMouseLeave={e => e.currentTarget.style.color = "var(--cream-mute)"}>Contact</button>
          <button onClick={onLogin} style={{ padding: "8px 20px", background: "transparent", border: "1px solid var(--border-h)", borderRadius: 6, color: "var(--cream-dim)", fontSize: 13, fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", transition: "all .2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--cream)"; e.currentTarget.style.color = "var(--cream)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--cream-dim)"; }}>Client Portal</button>
        </div>
      </nav>
      {/* Hero */}
      <section style={{ padding: "200px 64px 100px", maxWidth: 1560, margin: "0 auto", position: "relative", overflow: "hidden" }}>
        <ParticleCanvas />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 80, alignItems: "center", position: "relative", zIndex: 1 }}>
          {/* Left: copy */}
          <div>
            <div>
              <div
                style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--cream-mute)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 40, animation: "fadeUp 0.7s ease-out 0.1s both" }}
              >Revenue Operations / GTM Strategy / AI Automation</div>
              <h1
                style={{ fontFamily: "var(--serif)", fontSize: "clamp(42px, 6vw, 76px)", fontWeight: 400, fontStyle: "italic", color: "var(--cream)", lineHeight: 1.08, maxWidth: 760, marginBottom: 32, animation: "fadeUp 0.7s ease-out 0.3s both" }}
              >{ps.headline}</h1>
              <p
                style={{ fontSize: 18, color: "var(--cream-mute)", maxWidth: 520, lineHeight: 1.8, fontWeight: 300, animation: "fadeUp 0.7s ease-out 0.5s both" }}
              >{ps.subheadline}</p>
            </div>
            <div
              style={{ marginTop: 48, display: "flex", gap: 16, animation: "fadeUp 0.7s ease-out 0.7s both" }}
            >
              <button onClick={() => document.getElementById("work")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "14px 36px", background: "var(--cream)", color: "var(--ink)", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)" }}>View Work</button>
              <button onClick={() => document.getElementById("workflows")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "14px 36px", background: "transparent", color: "var(--cream-dim)", border: "1px solid var(--border-h)", borderRadius: 8, fontSize: 15, cursor: "pointer", fontFamily: "var(--sans)" }}>Run a Diagnostic</button>
            </div>
            <div style={{ display: "flex", gap: 48, marginTop: 72, animation: "fadeUp .8s ease-out .4s both" }}>
              {[["6+", "Years in RevOps"], ["4", "CRM Platforms"], ["15+", "GTM Implementations"], ["3x", "Pipeline Velocity"]].map(([v, l]) => (
                <StatCounter key={l} value={v} label={l} />
              ))}
            </div>
          </div>
          {/* Right: animated funnel */}
          <div style={{ width: 420, animation: "fadeIn 1.2s ease-out .4s both", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--cream-mute)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)", animation: "flowPulse 1.8s ease-in-out infinite" }} />
              GTM Signal Flow
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)", animation: "flowPulse 1.8s ease-in-out .6s infinite" }} />
            </div>
            <HeroFunnel />
          </div>
        </div>
      </section>
      {/* Marquee */}
      <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "12px 0", overflow: "hidden", whiteSpace: "nowrap" }}>
        <div style={{ display: "inline-block", animation: "marquee 35s linear infinite" }}>{[...Array(2)].map((_, i) => <span key={i} style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.3em", textTransform: "uppercase" }}>{" "}Revo-Sys &middot; CRM Architecture &middot; Lead Scoring &middot; Pipeline Automation &middot; Data Enrichment &middot; AI Agents &middot; No-Code Workflows &middot; Lifecycle Marketing &middot; Revenue Attribution &middot; Sales Enablement &middot; Intent Signals &middot;{" "}</span>)}</div>
      </div>
      {/* About / Bio */}
      <section id="about" style={{ padding: "120px 64px", maxWidth: 1560, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 64 }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 20 }}>About</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 40, fontWeight: 400, fontStyle: "italic", color: "var(--cream)", lineHeight: 1.15, marginBottom: 24 }}>The System</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>{["HubSpot RevOps", "HubSpot Sales", "Salesforce Admin"].map(c => (<span key={c} style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "5px 12px", borderRadius: 4, border: "1px solid var(--border)", color: "var(--cream-mute)", letterSpacing: "0.05em" }}>{c}</span>))}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Core Stack</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border)", borderRadius: 8, overflow: "hidden" }}>{["HubSpot", "Braze", "Amplitude", "ZoomInfo", "Apollo", "Salesforce", "Make.com", "MindStudio"].map(t => (<div key={t} style={{ padding: "10px 12px", background: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 13, color: "var(--cream-dim)" }}>{t}</div>))}</div>
          </div>
          <div>
            <p style={{ fontSize: 20, color: "var(--cream-dim)", lineHeight: 1.65, marginBottom: 40, fontWeight: 300, maxWidth: 680 }}>We build the operational backbone of B2B growth — <em style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--cream)" }}>from first signal to closed revenue</em>.</p>
            {/* 4 capability tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 2 }}>
              {[
                { icon: "activity", color: "var(--sky)", label: "Revenue Architecture", desc: "Unified data model across CRM, enrichment, and product — one source of truth for every team." },
                { icon: "target", color: "var(--amber)", label: "GTM Strategy", desc: "ICP, lead scoring, routing logic, and pipeline stage design built to scale with your motion." },
                { icon: "ai", color: "var(--violet)", label: "AI Automation", desc: "No-code AI agents that cut admin work by 60%+ and accelerate pipeline velocity end-to-end." },
                { icon: "dash", color: "var(--success)", label: "Lifecycle Marketing", desc: "Behaviour-triggered campaigns from first touch through expansion and retention — zero gaps." },
              ].map((cap, ci) => (
                <div key={ci} style={{ padding: "28px 24px", background: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${cap.color}12`, border: `1px solid ${cap.color}28`, display: "flex", alignItems: "center", justifyContent: "center", color: cap.color, flexShrink: 0 }}>
                      <Icon name={cap.icon} size={16} />
                    </div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: cap.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{cap.label}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--cream-mute)", lineHeight: 1.65, margin: 0, fontWeight: 300 }}>{cap.desc}</p>
                </div>
              ))}
            </div>
            {/* Services inline */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginTop: 2 }}>{ps.services.map((svc, i) => (<div key={svc.id} style={{ padding: "28px 24px", background: "var(--ink-2)" }}><span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--amber)", letterSpacing: "0.1em" }}>{num(i + 1)}</span><h3 style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 400, color: "var(--cream)", margin: "10px 0 6px", fontStyle: "italic" }}>{svc.title}</h3><p style={{ color: "var(--cream-mute)", fontSize: 12, lineHeight: 1.7, fontWeight: 300 }}>{svc.description}</p></div>))}</div>
          </div>
        </div>
      </section>
      {/* Lead Funnel (ENLARGED) */}
      <section id="funnel" style={{ padding: "100px 40px", maxWidth: 1560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20, padding: "0 24px" }}>
          <div><span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Interactive</span><h2 style={{ fontFamily: "var(--serif)", fontSize: 44, fontWeight: 400, fontStyle: "italic", color: "var(--cream)", marginTop: 10 }}>The Revenue Funnel</h2></div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.1em", maxWidth: 280, textAlign: "right", lineHeight: 1.6 }}>FROM RAW SIGNALS TO CLOSED REVENUE</span>
        </div>
        <p style={{ fontSize: 16, color: "var(--cream-mute)", lineHeight: 1.8, marginBottom: 40, maxWidth: 700, fontWeight: 300, padding: "0 24px" }}>This is the lead architecture we design for every engagement. Each stage has defined automation rules, manual quality gates, and clear handoff criteria between teams.</p>
        <div style={{ background: "var(--ink-2)", border: "1px solid var(--border)", borderRadius: 20, padding: "32px 28px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, var(--sky), var(--violet), var(--amber), var(--sage), var(--rose), var(--success))", opacity: 0.4 }} />
          <LeadFunnel />
        </div>
      </section>
      {/* Interactive Diagnostics */}
      <section id="workflows" style={{ padding: "100px 64px", maxWidth: 1560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <div><span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Interactive Diagnostics</span><h2 style={{ fontFamily: "var(--serif)", fontSize: 44, fontWeight: 400, fontStyle: "italic", color: "var(--cream)", marginTop: 10 }}>See the Thinking in Action</h2></div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.1em", maxWidth: 320, textAlign: "right", lineHeight: 1.6 }}>YOUR NUMBERS / INSTANT INSIGHTS</span>
        </div>
        <p style={{ fontSize: 16, color: "var(--cream-mute)", lineHeight: 1.8, marginBottom: 40, maxWidth: 800, fontWeight: 300 }}>Plug in your real numbers. Get instant visual diagnostics. No sign-up, no AI fluff. Just the math and frameworks we use with every client.</p>
        {/* Horizontal tool selector */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { title: "Revenue Leak Detector", sub: "Pipeline bleeding money?", color: "var(--danger)", icon: "01" },
            { title: "GTM Readiness Score", sub: "How mature is your ops?", color: "var(--amber)", icon: "02" },
            { title: "Automation ROI Calculator", sub: "What automation saves?", color: "var(--success)", icon: "03" },
            { title: "Stack Integration Map", sub: "Automations you're missing?", color: "var(--violet)", icon: "04" },
          ].map((tab, i) => (
            <div key={i} onClick={() => setActiveTool(i)}
              onMouseEnter={e => { if (activeTool !== i) { e.currentTarget.style.borderColor = tab.color + "35"; e.currentTarget.style.background = `${tab.color}06`; }}}
              onMouseLeave={e => { if (activeTool !== i) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--ink)"; }}}
              style={{ padding: "26px 24px", borderRadius: 16, cursor: "pointer", transition: "all .25s", background: activeTool === i ? `linear-gradient(145deg, ${tab.color}14, ${tab.color}06)` : "var(--ink)", border: `1.5px solid ${activeTool === i ? tab.color + "55" : "var(--border)"}`, transform: activeTool === i ? "translateY(-3px)" : "none", boxShadow: activeTool === i ? `0 12px 40px ${tab.color}18` : "none" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 300, color: activeTool === i ? tab.color : "var(--ink-5)", lineHeight: 1, marginBottom: 20, letterSpacing: "-0.02em" }}>{tab.icon}</div>
              <h4 style={{ fontFamily: "var(--serif)", fontSize: 20, fontStyle: "italic", color: activeTool === i ? "var(--cream)" : "var(--cream-dim)", margin: "0 0 8px", lineHeight: 1.2, fontWeight: 400 }}>{tab.title}</h4>
              <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: activeTool === i ? tab.color : "var(--cream-mute)", margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tab.sub}</p>
              {activeTool === i && <div style={{ marginTop: 16, height: 2, background: `linear-gradient(90deg, ${tab.color}, transparent)`, borderRadius: 1, animation: "slideInUp .3s ease-out" }} />}
            </div>
          ))}
        </div>
        {/* Tool content panels — kept in DOM to preserve state, shown/hidden */}
        {[
          { title: "Revenue Leak Detector", desc: "Enter your funnel numbers. See exactly which stage is costing you the most revenue and what fixing it would mean annually.", color: "var(--danger)" },
          { title: "GTM Readiness Score", desc: "Answer 6 questions about your current ops. Get an instant grade with a visual breakdown of where you're strong and where you're exposed.", color: "var(--amber)" },
          { title: "Automation ROI Calculator", desc: "Enter your team size and manual workload. See projected hours reclaimed, pipeline gain, and payback period.", color: "var(--success)" },
          { title: "Stack Integration Map", desc: "Select the tools you use today. See which integrations you should have and what adding one more tool would unlock.", color: "var(--violet)" },
        ].map((tool, i) => (
          <div key={i} style={{ display: activeTool === i ? "block" : "none" }}>
            <div style={{ background: "var(--ink-2)", border: `1px solid ${tool.color}22`, borderRadius: 20, overflow: "hidden", boxShadow: `0 0 80px ${tool.color}08`, animation: "fadeUp .35s ease-out" }}>
              <div style={{ padding: "28px 36px", borderBottom: `1px solid ${tool.color}18`, background: `linear-gradient(135deg, ${tool.color}07, transparent 60%)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontFamily: "var(--serif)", fontSize: 28, fontStyle: "italic", color: "var(--cream)", margin: "0 0 6px", fontWeight: 400 }}>{tool.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--cream-mute)", margin: 0, lineHeight: 1.6, maxWidth: 600 }}>{tool.desc}</p>
                </div>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${tool.color}15`, border: `1px solid ${tool.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: tool.color, animation: "flowPulse 2s ease-in-out infinite", boxShadow: `0 0 12px ${tool.color}60` }} />
                </div>
              </div>
              <div style={{ padding: "32px 36px" }}>
                {i === 0 && <RevenueLeak />}
                {i === 1 && <GTMReadiness />}
                {i === 2 && <AutomationROI />}
                {i === 3 && <StackMap />}
              </div>
            </div>
          </div>
        ))}
      </section>
      {/* Case Studies */}
      <section id="work" style={{ padding: "100px 64px", maxWidth: 1560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
          <div><span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Portfolio</span><h2 style={{ fontFamily: "var(--serif)", fontSize: 44, fontWeight: 400, fontStyle: "italic", color: "var(--cream)", marginTop: 10 }}>What Changed After We Stepped In</h2></div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 32, flexWrap: "wrap" }}>{categories.map(c => (<button key={c} onClick={() => setFilterCat(c)} style={{ padding: "8px 20px", borderRadius: 8, fontFamily: "var(--mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", transition: "all .2s", background: filterCat === c ? "rgba(196,162,101,0.1)" : "transparent", border: filterCat === c ? "1px solid rgba(196,162,101,0.25)" : "1px solid var(--border)", color: filterCat === c ? "var(--amber)" : "var(--cream-mute)" }}>{c}</button>))}</div>
        <div style={{ display: "grid", gap: 2 }}>{filteredCases.map((cs, i) => {
          const isExp = expandedCase === cs.id;
          return (<div key={cs.id} style={{ background: isExp ? "var(--ink-2)" : hov === cs.id ? "var(--ink-2)" : "var(--ink)", transition: "background .3s", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ padding: "28px 36px", display: "grid", gridTemplateColumns: "50px 1fr auto", gap: 24, alignItems: "center", cursor: "pointer" }} onClick={() => setExpandedCase(isExp ? null : cs.id)} onMouseEnter={() => setHov(cs.id)} onMouseLeave={() => setHov(null)}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 44, fontWeight: 400, color: isExp ? "var(--amber)" : "var(--ink-4)", fontStyle: "italic", lineHeight: 1, transition: "color .3s" }}>{num(i + 1)}</span>
              <div>
                <h3 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 400, color: "var(--cream)", margin: "0 0 6px", fontStyle: "italic" }}>{cs.title}</h3>
                <p style={{ fontSize: 14, color: "var(--cream-mute)", margin: "0 0 12px", fontWeight: 300 }}>{cs.headline}</p>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {cs.metrics.map((m, mi) => (
                    <div key={mi} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--danger)", textDecoration: "line-through", opacity: 0.6 }}>{m.val}</span>
                      <svg width="16" height="10" viewBox="0 0 16 10"><path d="M0 5 L10 5 M7 2 L11 5 L7 8" fill="none" stroke="var(--amber)" strokeWidth="1.5"/></svg>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--success)", fontWeight: 600 }}>{m.arrow}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--cream-mute)", marginLeft: 2 }}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--amber)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{cs.category}</span>
                <div style={{ color: "var(--cream-mute)", transition: "transform .3s", transform: isExp ? "rotate(180deg)" : "none" }}><Icon name="down" size={18} /></div>
              </div>
            </div>
            {isExp && (<div style={{ padding: "0 36px 36px 86px", animation: "fadeUp .3s ease-out" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cs.metrics.length}, 1fr)`, gap: 12, marginBottom: 28 }}>
                {cs.metrics.map((m, mi) => (
                  <div key={mi} style={{ padding: "24px 20px", background: "var(--ink)", borderRadius: 14, border: "1px solid var(--border)", textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, var(--danger), var(--success))", opacity: 0.4 }} />
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--cream-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>{m.label}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <div><div style={{ fontFamily: "var(--serif)", fontSize: 28, fontStyle: "italic", color: "var(--danger)", opacity: 0.5, textDecoration: "line-through" }}>{m.val}</div><div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--cream-mute)", marginTop: 2 }}>BEFORE</div></div>
                      <svg width="32" height="20" viewBox="0 0 32 20"><path d="M2 10 L24 10" stroke="var(--amber)" strokeWidth="1.5" strokeDasharray="4 3"/><path d="M20 5 L27 10 L20 15" fill="none" stroke="var(--amber)" strokeWidth="1.5"/></svg>
                      <div><div style={{ fontFamily: "var(--serif)", fontSize: 28, fontStyle: "italic", color: "var(--success)" }}>{m.arrow}</div><div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--cream-mute)", marginTop: 2 }}>AFTER</div></div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div style={{ padding: "20px 24px", background: "rgba(107,158,111,0.04)", borderRadius: 12, border: "1px solid rgba(107,158,111,0.12)" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--success)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Icon name="check" size={14} /> Built & Automated</div>
                  {cs.automations.map((a, ai) => (<div key={ai} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", marginTop: 7, flexShrink: 0 }} /><span style={{ fontSize: 14, color: "var(--cream-dim)", lineHeight: 1.6 }}>{a}</span></div>))}
                </div>
                <div style={{ padding: "20px 24px", background: "rgba(168,91,91,0.04)", borderRadius: 12, border: "1px solid rgba(168,91,91,0.12)" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--danger)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Icon name="x" size={14} /> Manual Work Eliminated</div>
                  {cs.eliminated.map((e, ei) => (<div key={ei} style={{ marginBottom: 8 }}><span style={{ fontSize: 14, color: "var(--cream-mute)", lineHeight: 1.6, textDecoration: "line-through", opacity: 0.6 }}>{e}</span></div>))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{cs.tags.map(t => <span key={t} style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "5px 12px", borderRadius: 4, background: "var(--ink-3)", color: "var(--cream-mute)" }}>{t}</span>)}</div>
            </div>)}
          </div>);
        })}</div>
      </section>
      {/* Contact Section */}
      <section id="contact" style={{ padding: "100px 64px", maxWidth: 1560, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
          {/* Left — headline + bullets */}
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 20 }}>Get in Touch</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 44, fontWeight: 400, fontStyle: "italic", color: "var(--cream)", lineHeight: 1.12, marginBottom: 28, maxWidth: 480 }}>Let's build your revenue system.</h2>
            <p style={{ fontSize: 16, color: "var(--cream-mute)", lineHeight: 1.8, fontWeight: 300, marginBottom: 40, maxWidth: 420 }}>Tell us about your GTM challenges. We'll come back with a clear perspective on what's worth fixing and how we'd approach it.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "CRM implementation or migration", color: "var(--sky)" },
                { label: "GTM strategy & ICP definition", color: "var(--amber)" },
                { label: "Lead scoring & pipeline automation", color: "var(--violet)" },
                { label: "AI agents & RevOps architecture", color: "var(--success)" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: "var(--cream-dim)", fontWeight: 300 }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 48, padding: "20px 24px", border: "1px solid var(--border)", background: "var(--ink-2)", borderRadius: 10 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Response time</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", color: "var(--amber)" }}>Within 1 business day.</div>
            </div>
          </div>
          {/* Right — form */}
          <div style={{ background: "var(--ink-2)", border: "1px solid var(--border-h)", borderRadius: 16, padding: "40px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, var(--amber), var(--violet), var(--sky))", opacity: 0.5 }} />
            {cState === "success" ? (
              <div style={{ textAlign: "center", padding: "60px 0", animation: "fadeUp .4s ease-out" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(107,158,111,0.12)", border: "1px solid rgba(107,158,111,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><Icon name="check" size={24} /></div>
                <h3 style={{ fontFamily: "var(--serif)", fontSize: 26, fontStyle: "italic", color: "var(--cream)", marginBottom: 12, fontWeight: 400 }}>Message received.</h3>
                <p style={{ fontSize: 14, color: "var(--cream-mute)", lineHeight: 1.7, marginBottom: 24 }}>I'll review your message and get back to you within 1 business day.</p>
                <button onClick={() => setCState("idle")} style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--amber)", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>Send another →</button>
              </div>
            ) : (
              <div>
                <h3 style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", color: "var(--cream)", marginBottom: 24, fontWeight: 400 }}>Start a conversation</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Name *</label>
                    <input value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--cream)", fontSize: 14, fontFamily: "var(--sans)" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Email *</label>
                    <input type="email" value={cForm.email} onChange={e => setCForm(f => ({ ...f, email: e.target.value }))} placeholder="you@company.com" style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--cream)", fontSize: 14, fontFamily: "var(--sans)" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Company</label>
                    <input value={cForm.company} onChange={e => setCForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--cream)", fontSize: 14, fontFamily: "var(--sans)" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Budget range</label>
                    <select value={cForm.budget} onChange={e => setCForm(f => ({ ...f, budget: e.target.value }))} style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, color: cForm.budget ? "var(--cream)" : "var(--cream-mute)", fontSize: 14, fontFamily: "var(--sans)", appearance: "none" }}>
                      <option value="">Select range</option>
                      <option>Under $5,000</option>
                      <option>$5,000 – $15,000</option>
                      <option>$15,000 – $40,000</option>
                      <option>$40,000+</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--cream-mute)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>What are you working on? *</label>
                  <textarea value={cForm.message} onChange={e => setCForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe your GTM challenge, current setup, and what outcome you're aiming for..." rows={5} style={{ width: "100%", padding: "11px 14px", background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--cream)", fontSize: 14, fontFamily: "var(--sans)", resize: "vertical", lineHeight: 1.7 }} />
                </div>
                {cState === "error" && <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(168,91,91,0.08)", border: "1px solid rgba(168,91,91,0.2)", borderRadius: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--danger)" }}>Error: {cError}. Please try again.</div>}
                <button
                  onClick={submitContact}
                  disabled={cState === "loading" || !cForm.name || !cForm.email || !cForm.message}
                  style={{ width: "100%", padding: "14px", background: "var(--cream)", color: "var(--ink)", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: cState === "loading" ? "wait" : "pointer", fontFamily: "var(--sans)", opacity: (!cForm.name || !cForm.email || !cForm.message) ? 0.4 : 1, transition: "opacity .2s" }}
                >
                  {cState === "loading" ? "Sending…" : "Send message →"}
                </button>
                <p style={{ fontSize: 11, color: "var(--cream-mute)", marginTop: 12, textAlign: "center", fontFamily: "var(--mono)", letterSpacing: "0.04em" }}>No pitch decks. No sales calls unless you want one.</p>
              </div>
            )}
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer style={{ padding: "40px 64px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 18, fontStyle: "italic", color: "var(--cream-mute)" }}>Revo-Sys</span>
        <div style={{ display: "flex", gap: 28 }}>
          {[["About", "#about"], ["Work", "#work"], ["Blog", "/blog"], ["Contact", "#contact"]].map(([label, href]) => (
            <a key={label} href={href} style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--cream-mute)", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", transition: "color .2s" }}
               onMouseEnter={e => e.currentTarget.style.color = "var(--cream)"}
               onMouseLeave={e => e.currentTarget.style.color = "var(--cream-mute)"}>{label}</a>
          ))}
        </div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--cream-mute)", letterSpacing: "0.1em" }}>&copy; {new Date().getFullYear()} / Revenue Systems</span>
      </footer>
    </div>
  );
};

// ============================================================
// AI HELPER COMPONENTS
// ============================================================

const AIScopeDeliverables=({scope,projectId,userId,dispatch})=>{
  const[open,setOpen]=useState(false);
  const[loading,setLoading]=useState(false);
  const[deliverables,setDeliverables]=useState([]);
  const[accepted,setAccepted]=useState(new Set());
  const run=async()=>{
    setLoading(true);setOpen(true);
    const text=scope.sections.map(s=>`${s.title}: ${s.content}`).join("\n\n");
    const raw=await callAI(`Based on these project scope sections, generate a structured list of deliverables. Each deliverable should have a title, description, and estimated phase (1, 2, or 3). Return as JSON array: [{title, description, phase}]\n\n${text}`,"You are a GTM project manager. Return ONLY valid JSON — no markdown, no explanation.");
    try{const parsed=JSON.parse(raw.replace(/```json?|```/g,"").trim());setDeliverables(parsed);setAccepted(new Set(parsed.map((_,i)=>i)));}catch{setDeliverables([{title:"Parse error",description:raw,phase:1}]);}
    setLoading(false);
  };
  const acceptAll=()=>{
    const tasks=deliverables.filter((_,i)=>accepted.has(i)).map(d=>({projectId,scopeId:scope.id,title:d.title,description:d.description,owner:userId,visibility:"client",dueDate:"",status:"todo"}));
    dispatch({type:"ADD_TASKS_BULK",payload:tasks,userId});
    setOpen(false);setDeliverables([]);setAccepted(new Set());
  };
  return(<>
    <Btn size="sm" v="ai" icon="ai" onClick={run}>Generate Deliverables from Scope</Btn>
    <Modal open={open} onClose={()=>setOpen(false)} title="AI: Scope → Deliverables" wide>
      {loading?<div style={{padding:40,textAlign:"center"}}><div style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--violet)",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block",marginBottom:16}}/><p style={{color:"var(--cream-mute)",fontSize:13}}>Analysing scope and generating deliverables...</p></div>:<div>
        <p style={{fontSize:13,color:"var(--cream-mute)",marginBottom:16,lineHeight:1.6}}>Review the suggested deliverables. Toggle to accept/reject, then click "Accept All" to create as tasks.</p>
        {deliverables.map((d,i)=>(
          <div key={i} onClick={()=>{const n=new Set(accepted);n.has(i)?n.delete(i):n.add(i);setAccepted(n);}} style={{padding:"14px 16px",marginBottom:8,background:accepted.has(i)?"rgba(107,158,111,0.06)":"var(--ink)",borderRadius:10,border:`1px solid ${accepted.has(i)?"rgba(107,158,111,0.25)":"var(--border)"}`,cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start",transition:"all .2s"}}>
            <div style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${accepted.has(i)?"var(--success)":"var(--border-h)"}`,display:"flex",alignItems:"center",justifyContent:"center",background:accepted.has(i)?"rgba(107,158,111,0.15)":"transparent",flexShrink:0,marginTop:1}}>{accepted.has(i)&&<Icon name="check" size={11}/>}</div>
            <div><div style={{fontSize:13,color:"var(--cream)",fontWeight:500,marginBottom:3}}>{d.title} <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--violet)",padding:"2px 6px",borderRadius:4,background:"rgba(124,111,160,0.12)",marginLeft:6}}>Phase {d.phase}</span></div><div style={{fontSize:12,color:"var(--cream-mute)",lineHeight:1.5}}>{d.description}</div></div>
          </div>
        ))}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
          <Btn v="secondary" onClick={()=>setOpen(false)}>Cancel</Btn>
          <Btn icon="check" onClick={acceptAll} disabled={accepted.size===0}>Accept {accepted.size} → Create Tasks</Btn>
        </div>
      </div>}
    </Modal>
  </>);
};

const AITaskBreakdown=({projectId,userId,dispatch})=>{
  const[open,setOpen]=useState(false);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[suggestions,setSuggestions]=useState([]);
  const[accepted,setAccepted]=useState(new Set());
  const run=async()=>{
    if(!input.trim())return;
    setLoading(true);
    const raw=await callAI(`Break down this deliverable into 4-6 logical sequential tasks. Return as JSON array: [{title, description}]\n\nDeliverable: ${input}`,"You are a project manager. Return ONLY valid JSON — no markdown.");
    try{const parsed=JSON.parse(raw.replace(/```json?|```/g,"").trim());setSuggestions(parsed);setAccepted(new Set(parsed.map((_,i)=>i)));}catch{setSuggestions([{title:"Parse error",description:raw}]);}
    setLoading(false);
  };
  const createSelected=()=>{
    const tasks=suggestions.filter((_,i)=>accepted.has(i)).map(s=>({projectId,title:s.title,description:s.description,owner:userId,visibility:"client",dueDate:"",status:"todo"}));
    dispatch({type:"ADD_TASKS_BULK",payload:tasks,userId});
    setOpen(false);setSuggestions([]);setInput("");setAccepted(new Set());
  };
  return(<>
    <Btn size="sm" v="secondary" icon="ai" onClick={()=>setOpen(true)}>AI Task Breakdown</Btn>
    <Modal open={open} onClose={()=>{setOpen(false);setSuggestions([]);}} title="AI: Task Breakdown" wide>
      {suggestions.length===0?<div>
        <p style={{fontSize:13,color:"var(--cream-mute)",marginBottom:16,lineHeight:1.6}}>Describe a deliverable and AI will break it into 4–6 logical sequential tasks.</p>
        <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="e.g. Set up HubSpot lead scoring with 12 criteria including firmographic and behavioral signals..." rows={4} style={{width:"100%",padding:"12px 14px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)",resize:"vertical",lineHeight:1.7,marginBottom:16}}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setOpen(false)}>Cancel</Btn><Btn v="ai" icon="ai" onClick={run} disabled={!input.trim()||loading}>{loading?"Thinking...":"Break Down"}</Btn></div>
      </div>:<div>
        <p style={{fontSize:13,color:"var(--cream-mute)",marginBottom:16}}>Toggle tasks to accept or reject, then create the selected ones.</p>
        {suggestions.map((s,i)=>(
          <div key={i} onClick={()=>{const n=new Set(accepted);n.has(i)?n.delete(i):n.add(i);setAccepted(n);}} style={{padding:"14px 16px",marginBottom:8,background:accepted.has(i)?"rgba(107,158,111,0.06)":"var(--ink)",borderRadius:10,border:`1px solid ${accepted.has(i)?"rgba(107,158,111,0.25)":"var(--border)"}`,cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start",transition:"all .2s"}}>
            <div style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${accepted.has(i)?"var(--success)":"var(--border-h)"}`,display:"flex",alignItems:"center",justifyContent:"center",background:accepted.has(i)?"rgba(107,158,111,0.15)":"transparent",flexShrink:0,marginTop:1}}>{accepted.has(i)&&<Icon name="check" size={11}/>}</div>
            <div><div style={{fontSize:13,color:"var(--cream)",fontWeight:500,marginBottom:2}}>{s.title}</div><div style={{fontSize:12,color:"var(--cream-mute)",lineHeight:1.5}}>{s.description}</div></div>
          </div>
        ))}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
          <Btn v="secondary" onClick={()=>setSuggestions([])}>← Back</Btn>
          <Btn icon="check" onClick={createSelected} disabled={accepted.size===0}>Create {accepted.size} Tasks</Btn>
        </div>
      </div>}
    </Modal>
  </>);
};

// ============================================================
// APP PAGES (Dashboard, Clients, Projects, ProjectDetail, Activity, Settings)
// ============================================================
const CHAT_SUGGESTIONS=["Summarize my open projects","Which tasks are overdue?","Draft a client update email","Suggest next steps for my pipeline","What should I focus on today?"];
const DashboardPage=({data,user,onNav})=>{
  const my=data.tasks.filter(t=>t.owner===user.id);
  const stats=[{label:"Active Projects",val:data.projects.filter(p=>p.status==="active").length,c:"var(--amber)",dest:"projects"},{label:"Open Tasks",val:my.filter(t=>t.status!=="completed").length,c:"var(--sky)",dest:"projects"},{label:"Completed",val:my.filter(t=>t.status==="completed").length,c:"var(--success)",dest:"projects"},{label:"Clients",val:data.clients.filter(c=>c.status==="active").length,c:"var(--violet)",dest:"clients"}];
  const recent=[...data.activityLog].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,8);
  const overdue=my.filter(t=>t.status!=="completed"&&t.dueDate&&new Date(t.dueDate)<new Date());
  const[draftModal,setDraftModal]=useState(false);
  const[draftLoad,setDraftLoad]=useState(false);
  const[draftText,setDraftText]=useState("");
  const[hovStat,setHovStat]=useState(null);
  const[chatMessages,setChatMessages]=useState([{role:"assistant",content:"Hi! I'm your Revo-Sys AI assistant. Ask me about your projects, clients, or GTM strategy."}]);
  const[chatInput,setChatInput]=useState("");
  const[chatLoading,setChatLoading]=useState(false);
  const chatEndRef=useRef(null);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chatMessages]);
  const runDraft=async()=>{setDraftLoad(true);const r=await callAI(`Based on this recent project activity, write a professional weekly client update email:\n${recent.map(a=>`- ${a.details} (${new Date(a.timestamp).toLocaleDateString()})`).join("\n")}`,"You are a GTM consultant writing a concise, professional weekly client update email. Use a confident, clear tone. Include key milestones, current status, and any blockers. Return just the email body text.");setDraftText(r);setDraftLoad(false);};
  const sendChat=async(msg)=>{
    const text=(msg||chatInput).trim();
    if(!text||chatLoading)return;
    setChatInput("");
    const newMsgs=[...chatMessages,{role:"user",content:text}];
    setChatMessages(newMsgs);
    setChatLoading(true);
    const ctx=`User: ${user.name} (${user.role}). Projects: ${data.projects.map(p=>p.name).join(", ")||"none"}. Open tasks: ${data.tasks.filter(t=>t.status!=="completed").length}. Overdue: ${data.tasks.filter(t=>t.status!=="completed"&&t.dueDate&&new Date(t.dueDate)<new Date()).length}. Clients: ${data.clients.map(c=>c.name).join(", ")||"none"}.`;
    const history=newMsgs.slice(-6).map(m=>`${m.role==="user"?"User":"Assistant"}: ${m.content}`).join("\n");
    const reply=await callAI(`Context: ${ctx}\n\nConversation:\n${history}`,"You are a helpful GTM and RevOps assistant for Revo-Sys. Answer concisely and practically based on the user's project data provided.");
    setChatMessages(prev=>[...prev,{role:"assistant",content:reply}]);
    setChatLoading(false);
  };
  return(<div>
    <div style={{marginBottom:40}}><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.2em",textTransform:"uppercase"}}>Dashboard</span><h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginTop:8}}>Welcome, {user.name.split(" ")[0]}</h1></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"var(--border)",borderRadius:12,overflow:"hidden",marginBottom:40}}>{stats.map((s,i)=>(<div key={i} onClick={()=>onNav&&onNav(s.dest)} onMouseEnter={()=>setHovStat(i)} onMouseLeave={()=>setHovStat(null)} style={{padding:"28px 24px",background:hovStat===i?"var(--ink-3)":"var(--ink-2)",cursor:"pointer",transition:"background .15s"}}><div style={{fontFamily:"var(--serif)",fontSize:40,fontWeight:400,color:s.c,fontStyle:"italic"}}>{s.val}</div><div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:8}}>{s.label}</div></div>))}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h3 style={{fontFamily:"var(--serif)",fontSize:20,fontStyle:"italic",color:"var(--cream)",margin:0}}>Recent Activity</h3>{user.role==="admin"&&<Btn v="ai" size="sm" icon="ai" onClick={()=>{setDraftModal(true);if(!draftText)runDraft();}}>Draft Weekly Update</Btn>}</div>{recent.map(a=>(<div key={a.id} style={{padding:"10px 0",borderBottom:"1px solid var(--border)",display:"flex",gap:14,alignItems:"flex-start"}}><span style={{width:5,height:5,borderRadius:"50%",background:"var(--amber)",marginTop:7,flexShrink:0}}/><div><p style={{fontSize:13,color:"var(--cream-dim)",lineHeight:1.5,margin:0}}>{a.details}</p><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{new Date(a.timestamp).toLocaleDateString()}</span></div></div>))}</div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)"}}><h3 style={{fontFamily:"var(--serif)",fontSize:20,fontStyle:"italic",color:overdue.length?"var(--danger)":"var(--cream)",marginBottom:20}}>{overdue.length?`${overdue.length} Overdue`:"Upcoming Tasks"}</h3>{(overdue.length?overdue:my.filter(t=>t.status!=="completed").slice(0,6)).map(t=>{const p=data.projects.find(p=>p.id===t.projectId);return(<div key={t.id} style={{padding:"10px 0",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><p style={{margin:0,fontSize:13,color:"var(--cream-dim)"}}>{t.title}</p><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{p?.name}</span></div><Badge status={t.status}/></div>);})}{my.filter(t=>t.status!=="completed").length===0&&<p style={{color:"var(--cream-mute)",fontSize:13,fontStyle:"italic"}}>All clear</p>}</div></div>
{/* AI Chat Panel */}
<div className="ai-chat-glow" style={{marginTop:32,background:"var(--ink-2)",borderRadius:16,display:"flex",flexDirection:"column",height:500}}>
  <div style={{padding:"18px 24px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12}}>
    <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,var(--violet),var(--sky))",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="ai" size={16}/></div>
    <div><div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--amber)",letterSpacing:"0.1em",textTransform:"uppercase"}}>AI Assistant</div><div style={{fontSize:12,color:"var(--cream-mute)"}}>Ask anything about your projects, clients, or GTM strategy</div></div>
  </div>
  <div style={{flex:1,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:10}}>
    {chatMessages.map((m,i)=>(
      <div key={i} style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end"}}>
        {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:8,background:"linear-gradient(135deg,var(--violet),var(--sky))",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="ai" size={11}/></div>}
        <div style={{maxWidth:"70%",padding:"10px 14px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",background:m.role==="user"?"var(--amber)":"var(--ink)",color:m.role==="user"?"var(--ink)":"var(--cream-dim)",fontSize:13,lineHeight:1.7,border:m.role==="user"?"none":"1px solid var(--border)",whiteSpace:"pre-wrap"}}>{m.content}</div>
        {m.role==="user"&&<div style={{width:26,height:26,borderRadius:8,background:"rgba(196,162,101,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"var(--mono)",fontSize:9,color:"var(--amber)"}}>{user.avatar}</div>}
      </div>
    ))}
    {chatLoading&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:8,background:"linear-gradient(135deg,var(--violet),var(--sky))",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="ai" size={11}/></div><div style={{padding:"10px 14px",borderRadius:"12px 12px 12px 4px",background:"var(--ink)",border:"1px solid var(--border)"}}><div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:"var(--violet)",animation:`flowPulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div></div></div>}
    <div ref={chatEndRef}/>
  </div>
  <div style={{padding:"8px 24px 10px",display:"flex",gap:6,flexWrap:"wrap"}}>
    {CHAT_SUGGESTIONS.map(s=>(
      <button key={s} onClick={()=>sendChat(s)} disabled={chatLoading} style={{padding:"5px 10px",borderRadius:16,background:"var(--ink)",border:"1px solid var(--border)",color:"var(--cream-mute)",fontSize:11,fontFamily:"var(--mono)",cursor:"pointer",transition:"all .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--amber)";e.currentTarget.style.color="var(--amber)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--cream-mute)";}}>
        {s}
      </button>
    ))}
  </div>
  <div style={{padding:"10px 24px 18px",display:"flex",gap:8}}>
    <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}}} placeholder="Ask anything..." style={{flex:1,padding:"11px 16px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:10,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)"}}/>
    <button onClick={()=>sendChat()} disabled={!chatInput.trim()||chatLoading} style={{width:42,height:42,borderRadius:10,background:chatInput.trim()&&!chatLoading?"var(--amber)":"var(--ink-3)",border:"none",cursor:chatInput.trim()&&!chatLoading?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",color:chatInput.trim()&&!chatLoading?"var(--ink)":"var(--cream-mute)",transition:"all .2s",flexShrink:0}}><Icon name="send" size={15}/></button>
  </div>
</div>
<Modal open={draftModal} onClose={()=>setDraftModal(false)} title="Draft Weekly Client Update" wide>
  {draftLoad?<div style={{padding:40,textAlign:"center"}}><div style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--violet)",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block",marginBottom:16}}/><p style={{color:"var(--cream-mute)",fontSize:13}}>Drafting update from activity log...</p></div>:<div>
    <div style={{padding:20,background:"var(--ink)",borderRadius:10,border:"1px solid var(--border)",color:"var(--cream-dim)",fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",marginBottom:16,minHeight:160}}>{draftText||"Click 'Regenerate' to draft an update."}</div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="secondary" onClick={runDraft}>Regenerate</Btn><Btn icon="copy" onClick={()=>{navigator.clipboard?.writeText(draftText);}} disabled={!draftText}>Copy</Btn></div>
  </div>}
</Modal>
</div>);};

const ClientsPage=({data,dispatch,user,onNav})=>{const[modal,setModal]=useState(false);const[editing,setEditing]=useState(null);const[form,setForm]=useState({name:"",company:"",email:"",phone:"",industry:"",notes:"",status:"active"});const[q,setQ]=useState("");const[expandedClient,setExpandedClient]=useState(null);const openNew=()=>{setForm({name:"",company:"",email:"",phone:"",industry:"",notes:"",status:"active"});setEditing(null);setModal(true);};const openEdit=(c)=>{setForm({...c});setEditing(c.id);setModal(true);};const save=()=>{editing?dispatch({type:"UPDATE_CLIENT",payload:{...form,id:editing}}):dispatch({type:"ADD_CLIENT",payload:{...form,createdBy:user.id},userId:user.id});setModal(false);};const filtered=data.clients.filter(c=>!q||`${c.name} ${c.company}`.toLowerCase().includes(q.toLowerCase()));const statusColor={active:"var(--amber)",todo:"var(--cream-mute)",in_progress:"var(--sky)",review:"var(--violet)",completed:"var(--success)"};return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:40}}><div><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.2em",textTransform:"uppercase"}}>Relationships</span><h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginTop:8}}>Clients</h1></div>{user.role!=="client"&&<Btn icon="plus" onClick={openNew}>New Client</Btn>}</div><div style={{marginBottom:24,position:"relative"}}><span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--cream-mute)"}}><Icon name="search" size={15}/></span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." style={{width:"100%",padding:"11px 14px 11px 40px",background:"var(--ink-2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:14,fontFamily:"var(--sans)"}}/></div>{filtered.length===0?<Empty icon="users" title="No clients" action="Add Client" onAction={openNew}/>:(<div style={{display:"grid",gap:1,background:"var(--border)",borderRadius:12,overflow:"hidden"}}>{filtered.map(c=>{const n=data.projects.filter(p=>p.clientId===c.id).length;const isExp=expandedClient===c.id;const cProjs=data.projects.filter(p=>p.clientId===c.id);return(<div key={c.id}><div onClick={()=>setExpandedClient(isExp?null:c.id)} style={{padding:"20px 24px",background:"var(--ink-2)",display:"grid",gridTemplateColumns:"48px 1fr auto auto",gap:16,alignItems:"center",cursor:"pointer",transition:"background .2s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--ink-3)"} onMouseLeave={e=>e.currentTarget.style.background="var(--ink-2)"}><div style={{width:48,height:48,borderRadius:12,background:"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:18,fontStyle:"italic",color:"var(--amber)"}}>{c.name.split(" ").map(w=>w[0]).join("").slice(0,2)}</div><div><p style={{margin:0,fontSize:15,color:"var(--cream)",fontWeight:500}}>{c.name}</p><span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)"}}>{c.company} / {n} project{n!==1?"s":""}</span></div><Badge status={c.status}/>{user.role!=="client"&&<button onClick={e=>{e.stopPropagation();openEdit(c);}} className="ghost-btn" style={{color:"var(--cream-mute)"}}><Icon name="edit" size={14}/></button>}</div>{isExp&&<div style={{padding:"12px 24px 20px",background:"var(--ink-2)",borderTop:"1px solid var(--border)",animation:"fadeUp .2s ease-out"}}><div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10}}>Assigned Projects</div>{cProjs.length===0?<p style={{fontSize:13,color:"var(--cream-mute)",fontStyle:"italic"}}>No projects assigned</p>:<div style={{display:"grid",gap:6}}>{cProjs.map(proj=>(<div key={proj.id} onClick={()=>onNav&&onNav("project_detail",proj.id)} style={{padding:"12px 16px",background:"var(--ink)",borderRadius:8,border:"1px solid var(--border)",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"border-color .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--amber)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}><div><div style={{fontSize:14,color:"var(--cream)",fontWeight:500,marginBottom:2}}>{proj.name}</div><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--amber)",letterSpacing:"0.08em",textTransform:"uppercase"}}>{proj.category}</span></div><Badge status={proj.status}/></div>))}</div>}</div>}</div>);})}</div>)}<Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit Client":"New Client"}><Field label="Name" value={form.name} onChange={v=>setForm({...form,name:v})}/><Field label="Company" value={form.company} onChange={v=>setForm({...form,company:v})}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Field label="Email" value={form.email} onChange={v=>setForm({...form,email:v})}/><Field label="Phone" value={form.phone} onChange={v=>setForm({...form,phone:v})}/></div><Field label="Notes" value={form.notes} onChange={v=>setForm({...form,notes:v})} type="textarea"/><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>{editing&&<Btn v="danger" onClick={()=>{dispatch({type:"DELETE_CLIENT",payload:editing});setModal(false);}}>Delete</Btn>}<Btn v="secondary" onClick={()=>setModal(false)}>Cancel</Btn><Btn onClick={save} disabled={!form.name}>{editing?"Save":"Create"}</Btn></div></Modal></div>);};

const ProjectsPage=({data,dispatch,user,onNav})=>{const[modal,setModal]=useState(false);const[tab,setTab]=useState("active");const[form,setForm]=useState({name:"",description:"",clientId:"",status:"active",visibility:"private",category:""});const[editing,setEditing]=useState(null);const acc=user.role==="client"?data.projects.filter(p=>p.clientId===user.clientId):data.projects;const filtered=acc.filter(p=>tab==="active"?p.status==="active":p.status!=="active");const openNew=()=>{setForm({name:"",description:"",clientId:data.clients[0]?.id||"",status:"active",visibility:"private",category:""});setEditing(null);setModal(true);};const openEdit=p=>{setForm({...p});setEditing(p.id);setModal(true);};const save=()=>{editing?dispatch({type:"UPDATE_PROJECT",payload:{...form,id:editing}}):dispatch({type:"ADD_PROJECT",payload:form,userId:user.id});setModal(false);};return(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:40}}><div><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.2em",textTransform:"uppercase"}}>Work</span><h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginTop:8}}>Projects</h1></div>{user.role!=="client"&&<Btn icon="plus" onClick={openNew}>New Project</Btn>}</div><Tabs tabs={[{key:"active",label:"Active",count:acc.filter(p=>p.status==="active").length},{key:"past",label:"Archive",count:acc.filter(p=>p.status!=="active").length}]} active={tab} onChange={setTab}/>{filtered.length===0?<Empty icon="folder" title="No projects" action={user.role!=="client"?"New Project":null} onAction={openNew}/>:(<div style={{display:"grid",gap:1,background:"var(--border)",borderRadius:12,overflow:"hidden"}}>{filtered.map((proj,i)=>{const client=data.clients.find(c=>c.id===proj.clientId);const tc=data.tasks.filter(t=>t.projectId===proj.id).length;const done=data.tasks.filter(t=>t.projectId===proj.id&&t.status==="completed").length;const pct=tc>0?Math.round((done/tc)*100):0;return(<div key={proj.id} onClick={()=>onNav("project_detail",proj.id)} style={{padding:"24px 28px",background:"var(--ink-2)",display:"grid",gridTemplateColumns:"56px 1fr 180px auto",gap:20,alignItems:"center",cursor:"pointer",transition:"background .2s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--ink-3)"} onMouseLeave={e=>e.currentTarget.style.background="var(--ink-2)"}><span style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,color:"var(--ink-4)",fontStyle:"italic"}}>{num(i+1)}</span><div><h3 style={{margin:0,fontSize:17,color:"var(--cream)",fontWeight:500}}>{proj.name}</h3><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--amber)",letterSpacing:"0.08em",textTransform:"uppercase"}}>{proj.category}</span></div><div>{tc>0&&<><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{done}/{tc}</span><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{pct}%</span></div><div style={{height:2,background:"var(--border)",borderRadius:1}}><div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,var(--amber),var(--success))",borderRadius:1}}/></div></>}</div><div style={{display:"flex",gap:8,alignItems:"center"}}><Badge status={proj.status}/>{user.role!=="client"&&<button onClick={e=>{e.stopPropagation();openEdit(proj);}} className="ghost-btn"><Icon name="edit" size={14}/></button>}</div></div>);})}</div>)}<Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit Project":"New Project"}><Field label="Name" value={form.name} onChange={v=>setForm({...form,name:v})}/><Field label="Description" value={form.description} onChange={v=>setForm({...form,description:v})} type="textarea"/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Field label="Client" value={form.clientId} onChange={v=>setForm({...form,clientId:v})} type="select" options={[{value:"",label:"Select..."},...data.clients.map(c=>({value:c.id,label:c.name}))]}/><Field label="Category" value={form.category} onChange={v=>setForm({...form,category:v})}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Field label="Status" value={form.status} onChange={v=>setForm({...form,status:v})} type="select" options={[{value:"active",label:"Active"},{value:"completed",label:"Completed"},{value:"archived",label:"Archived"}]}/><Field label="Visibility" value={form.visibility} onChange={v=>setForm({...form,visibility:v})} type="select" options={[{value:"private",label:"Private"},{value:"portfolio",label:"Portfolio"}]}/></div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>{editing&&<><Btn v="danger" onClick={()=>{dispatch({type:"DELETE_PROJECT",payload:editing});setModal(false);}}>Delete</Btn><Btn v="secondary" icon="copy" onClick={()=>{dispatch({type:"CLONE_PROJECT",payload:editing,userId:user.id});setModal(false);}}>Clone</Btn></>}<Btn v="secondary" onClick={()=>setModal(false)}>Cancel</Btn><Btn onClick={save} disabled={!form.name}>{editing?"Save":"Create"}</Btn></div></Modal></div>);};

// ============================================================
// TASKS TAB CONTENT (Kanban + Table)
// ============================================================
const KANBAN_COLS=[{status:"todo",label:"To Do",color:"var(--cream-mute)"},{status:"in_progress",label:"In Progress",color:"var(--sky)"},{status:"review",label:"Review",color:"var(--violet)"},{status:"completed",label:"Completed",color:"var(--success)"}];

const TasksTabContent=({vis,sel,detail,setDetail,data,user,dispatch,projectId,tModal,setTModal,tEdit,setTEdit,tForm,setTForm,comment,setComment,showMentions,setShowMentions,cRef,tComments,tDelivs,counts,filter,setFilter,filtered})=>{
  const[taskView,setTaskView]=useState("board");
  const now=new Date();
  const openAddTask=(status="todo")=>{setTForm({title:"",description:"",owner:user.id,visibility:"client",dueDate:"",status});setTEdit(null);setTModal(true);};
  if(sel) return(
    <div><div style={{display:"grid",gridTemplateColumns:"5fr 3fr",gap:24}}><div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h2 style={{margin:0,fontFamily:"var(--serif)",fontSize:22,fontStyle:"italic",color:"var(--cream)",fontWeight:400}}>{sel.title}</h2><Badge status={sel.status}/></div><p style={{color:"var(--cream-mute)",fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{sel.description||"No description"}</p></div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)"}}><h3 style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:16}}>Comments</h3>{tComments.map(c=>{const a=data.users.find(u=>u.id===c.userId);return(<div key={c.id} style={{padding:"12px 0",borderBottom:"1px solid var(--border)",display:"flex",gap:12}}><div style={{width:32,height:32,borderRadius:8,background:"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:12,fontStyle:"italic",color:"var(--amber)",flexShrink:0}}>{a?.avatar}</div><div><span style={{fontSize:13,fontWeight:500,color:"var(--cream-dim)"}}>{a?.name}</span><p style={{margin:"4px 0 0",fontSize:13,color:"var(--cream-mute)",lineHeight:1.6}}>{c.content}</p></div></div>)})}<div style={{marginTop:16}}><textarea ref={cRef} value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>{if(e.key==="@")setShowMentions(true);if(e.key==="Escape")setShowMentions(false);if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(comment.trim()){dispatch({type:"ADD_COMMENT",payload:{taskId:detail,userId:user.id,content:comment}});setComment("");}}}} placeholder="Comment..." rows={2} style={{width:"100%",padding:12,background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)",resize:"none"}}/>{showMentions&&<div style={{background:"var(--ink-3)",border:"1px solid var(--border-h)",borderRadius:8,padding:4,marginTop:4}}>{data.users.map(u=><button key={u.id} onClick={()=>{setComment(p=>p+`@${u.name} `);setShowMentions(false);}} style={{display:"block",width:"100%",padding:"8px 12px",background:"none",border:"none",color:"var(--cream-dim)",fontSize:13,cursor:"pointer",textAlign:"left",borderRadius:4,fontFamily:"var(--sans)"}}>{u.name}</button>)}</div>}<div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}><Btn size="sm" icon="send" onClick={()=>{if(comment.trim()){dispatch({type:"ADD_COMMENT",payload:{taskId:detail,userId:user.id,content:comment}});setComment("");}}} disabled={!comment.trim()}>Send</Btn></div></div></div></div><div><div style={{padding:24,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",marginBottom:16}}>{[["Owner",data.users.find(u=>u.id===sel.owner)?.name||"Unassigned"],["Due",sel.dueDate?new Date(sel.dueDate).toLocaleDateString():"Not set"]].map(([l,v])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)",fontSize:13}}><span style={{color:"var(--cream-mute)"}}>{l}</span><span style={{color:"var(--cream-dim)"}}>{v}</span></div>))}</div><div style={{padding:24,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.12em",textTransform:"uppercase"}}>Deliverables</span><button onClick={()=>{const n=prompt("File name:");if(n)dispatch({type:"ADD_DELIVERABLE",payload:{taskId:detail,name:n,type:"file",size:`${(Math.random()*5+.5).toFixed(1)} MB`,uploadedBy:user.id},userId:user.id});}} className="ghost-btn" style={{color:"var(--amber)"}}><Icon name="upload" size={14}/></button></div>{tDelivs.length===0?<p style={{color:"var(--cream-mute)",fontSize:12,fontStyle:"italic"}}>None</p>:tDelivs.map(d=><div key={d.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)"}}><span style={{fontSize:13,color:"var(--cream-dim)"}}>{d.name}</span><button onClick={()=>dispatch({type:"DELETE_DELIVERABLE",payload:d.id})} className="ghost-btn" style={{color:"var(--danger)"}}><Icon name="trash" size={12}/></button></div>)}</div>{user.role!=="client"&&<div style={{padding:24,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)"}}><div style={{display:"grid",gap:5}}>{["todo","in_progress","review","completed"].map(s=>(<button key={s} onClick={()=>{if(s==="completed"&&tDelivs.length===0){alert("Upload a deliverable first.");return;}dispatch({type:"UPDATE_TASK",payload:{id:sel.id,status:s},userId:user.id});}} style={{padding:"9px 14px",background:sel.status===s?"rgba(196,162,101,0.1)":"var(--ink)",border:sel.status===s?"1px solid rgba(196,162,101,0.25)":"1px solid var(--border)",borderRadius:6,color:sel.status===s?"var(--amber)":"var(--cream-mute)",fontSize:12,cursor:"pointer",textTransform:"capitalize",fontFamily:"var(--sans)"}}>{s.replace("_"," ")}</button>))}</div></div>}</div></div></div>
  );
  return(
    <div>
      {/* View toggle + Add Task */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{display:"flex",gap:4}}>
          {[{v:"board",label:"Board"},{v:"table",label:"Table"}].map(({v,label})=>(
            <button key={v} onClick={()=>setTaskView(v)} style={{padding:"7px 16px",borderRadius:6,background:taskView===v?"rgba(196,162,101,0.1)":"transparent",border:taskView===v?"1px solid rgba(196,162,101,0.25)":"1px solid var(--border)",color:taskView===v?"var(--amber)":"var(--cream-mute)",fontFamily:"var(--mono)",fontSize:11,cursor:"pointer",letterSpacing:"0.06em"}}>{label}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {user.role!=="client"&&<><Btn icon="plus" size="sm" onClick={()=>openAddTask()}>Add Task</Btn><AITaskBreakdown projectId={projectId} userId={user.id} dispatch={dispatch}/></>}
        </div>
      </div>
      {/* Board View */}
      {taskView==="board"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,alignItems:"start"}}>
          {KANBAN_COLS.map(col=>{
            const colTasks=vis.filter(t=>t.status===col.status);
            return(
              <div key={col.status} style={{background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden"}}>
                <div style={{height:3,background:col.color}}/>
                <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid var(--border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:10,color:col.color,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:600}}>{col.label}</span>
                    <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",background:"var(--ink)",padding:"2px 7px",borderRadius:10}}>{colTasks.length}</span>
                  </div>
                  {user.role!=="client"&&<button onClick={()=>openAddTask(col.status)} style={{background:"none",border:"none",color:"var(--cream-mute)",cursor:"pointer",fontSize:16,lineHeight:1,padding:2}} title={`Add to ${col.label}`}>+</button>}
                </div>
                <div style={{padding:10,display:"flex",flexDirection:"column",gap:8,minHeight:80}}>
                  {colTasks.length===0&&<p style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--ink-5)",textAlign:"center",padding:"16px 0"}}>No tasks</p>}
                  {colTasks.map(t=>{
                    const owner=data.users.find(u=>u.id===t.owner);
                    const delvCount=data.deliverables.filter(d=>d.taskId===t.id).length;
                    const isOverdue=t.dueDate&&new Date(t.dueDate)<now&&t.status!=="completed";
                    return(
                      <div key={t.id} onClick={()=>setDetail(t.id)} style={{padding:"12px 14px",background:"var(--ink)",borderRadius:8,border:"1px solid var(--border)",borderLeft:`2px solid ${col.color}`,cursor:"pointer",transition:"border-color .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=col.color} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                        <div style={{fontSize:13,color:"var(--cream)",marginBottom:8,lineHeight:1.4}}>{t.title}</div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            {owner&&<div style={{width:24,height:24,borderRadius:"50%",background:"rgba(196,162,101,0.15)",border:"1px solid rgba(196,162,101,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:9,fontStyle:"italic",color:"var(--amber)"}}>{owner.avatar}</div>}
                            {delvCount>0&&<span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",background:"var(--ink-2)",padding:"2px 6px",borderRadius:4}}>{delvCount} file{delvCount!==1?"s":""}</span>}
                          </div>
                          {t.dueDate&&<span style={{fontFamily:"var(--mono)",fontSize:9,color:isOverdue?"var(--danger)":"var(--cream-mute)"}}>{new Date(t.dueDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Table View */}
      {taskView==="table"&&(
        <div style={{borderRadius:12,border:"1px solid var(--border)",overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"40px 1fr 120px 80px 100px 60px",background:"var(--ink-3)",padding:"10px 16px",gap:12}}>
            {["#","Task","Status","Owner","Due","Files"].map(h=><span key={h} style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{h}</span>)}
          </div>
          {vis.length===0&&<div style={{padding:"32px",textAlign:"center",color:"var(--cream-mute)",fontSize:13,fontStyle:"italic"}}>No tasks yet</div>}
          {vis.map((t,i)=>{
            const owner=data.users.find(u=>u.id===t.owner);
            const delvCount=data.deliverables.filter(d=>d.taskId===t.id).length;
            const isOverdue=t.dueDate&&new Date(t.dueDate)<now&&t.status!=="completed";
            return(
              <div key={t.id} onClick={()=>setDetail(t.id)} style={{display:"grid",gridTemplateColumns:"40px 1fr 120px 80px 100px 60px",padding:"12px 16px",gap:12,alignItems:"center",background:"var(--ink-2)",borderTop:"1px solid var(--border)",cursor:"pointer",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--ink-3)"} onMouseLeave={e=>e.currentTarget.style.background="var(--ink-2)"}>
                <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--ink-5)"}}>{num(i+1)}</span>
                <span style={{fontSize:13,color:"var(--cream)"}}>{t.title}</span>
                <Badge status={t.status}/>
                <div>{owner?<div style={{width:28,height:28,borderRadius:"50%",background:"rgba(196,162,101,0.15)",border:"1px solid rgba(196,162,101,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:10,fontStyle:"italic",color:"var(--amber)"}}>{owner.avatar}</div>:<span style={{color:"var(--cream-mute)",fontSize:12}}>—</span>}</div>
                <span style={{fontFamily:"var(--mono)",fontSize:11,color:isOverdue?"var(--danger)":"var(--cream-mute)"}}>{t.dueDate?new Date(t.dueDate).toLocaleDateString():"—"}</span>
                <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)"}}>{delvCount>0?delvCount:"—"}</span>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={tModal} onClose={()=>setTModal(false)} title={tEdit?"Edit Task":"New Task"}><Field label="Title" value={tForm.title} onChange={v=>setTForm({...tForm,title:v})}/><Field label="Description" value={tForm.description} onChange={v=>setTForm({...tForm,description:v})} type="textarea"/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Field label="Owner" value={tForm.owner} onChange={v=>setTForm({...tForm,owner:v})} type="select" options={[{value:"",label:"Unassigned"},...data.users.map(u=>({value:u.id,label:u.name}))]}/><Field label="Due Date" value={tForm.dueDate} onChange={v=>setTForm({...tForm,dueDate:v})} type="date"/></div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>{tEdit&&<Btn v="danger" onClick={()=>{dispatch({type:"DELETE_TASK",payload:tEdit});setTModal(false);setDetail(null);}}>Delete</Btn>}<Btn v="secondary" onClick={()=>setTModal(false)}>Cancel</Btn><Btn onClick={()=>{tEdit?dispatch({type:"UPDATE_TASK",payload:{...tForm,id:tEdit},userId:user.id}):dispatch({type:"ADD_TASK",payload:{...tForm,projectId}});setTModal(false);}} disabled={!tForm.title}>{tEdit?"Save":"Create"}</Btn></div></Modal>
    </div>
  );
};

// ProjectDetail with all sub-tabs (Overview, Proposals, Scopes, Tasks, Delivery)
const ProjectDetail=({data,dispatch,user,projectId,onNav})=>{
  // ALL hooks must be declared before any conditional return (React rules of hooks)
  const[tab,setTab]=useState("overview");
  const[pModal,setPModal]=useState(false);
  const[pEdit,setPEdit]=useState(null);
  const[pForm,setPForm]=useState({title:"",content:""});
  const[sModal,setSModal]=useState(false);
  const[sEdit,setSEdit]=useState(null);
  const[sForm,setSForm]=useState({title:"",sections:[{id:uid(),title:"",content:""}],rateType:"project",rateAmount:"",rateHours:""});
  const[sTemplateStep,setSTemplateStep]=useState("pick");
  const[expanded,setExpanded]=useState(null);
  const[tModal,setTModal]=useState(false);
  const[tEdit,setTEdit]=useState(null);
  const[tForm,setTForm]=useState({title:"",description:"",owner:"",visibility:"client",dueDate:"",status:"todo"});
  const[detail,setDetail]=useState(null);
  const[comment,setComment]=useState("");
  const[filter,setFilter]=useState("all");
  const[showMentions,setShowMentions]=useState(false);
  const cRef=useRef(null);
  const[summary,setSummary]=useState("");
  const[sumLoad,setSumLoad]=useState(false);
  const[ack,setAck]=useState(false);

  const project=data.projects.find(p=>p.id===projectId);
  if(!project)return <Empty icon="folder" title="Project not found"/>;

  const client=data.clients.find(c=>c.id===project.clientId);
  const proposals=data.proposals.filter(p=>p.projectId===projectId);
  const scopes=data.scopes.filter(s=>s.projectId===projectId);
  const tasks=data.tasks.filter(t=>t.projectId===projectId);
  const vis=user.role==="client"?tasks.filter(t=>t.visibility==="client"):tasks;
  const done=vis.filter(t=>t.status==="completed");
  const deliverables=data.deliverables.filter(d=>tasks.some(t=>t.id===d.taskId));
  const pct=vis.length>0?Math.round((done.length/vis.length)*100):0;
  const filtered=filter==="all"?vis:vis.filter(t=>t.status===filter);
  const sel=detail?vis.find(t=>t.id===detail):null;
  const tComments=detail?data.comments.filter(c=>c.taskId===detail):[];
  const tDelivs=detail?data.deliverables.filter(d=>d.taskId===detail):[];
  const counts={all:vis.length,todo:vis.filter(t=>t.status==="todo").length,in_progress:vis.filter(t=>t.status==="in_progress").length,completed:vis.filter(t=>t.status==="completed").length};
return(<div><button onClick={()=>detail?setDetail(null):onNav("projects")} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",color:"var(--cream-mute)",cursor:"pointer",marginBottom:24,fontFamily:"var(--mono)",fontSize:11,letterSpacing:"0.05em"}}><Icon name="back" size={14}/> {detail?"Tasks":"Projects"}</button>{!detail&&<><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:40}}><div><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--amber)",letterSpacing:"0.15em",textTransform:"uppercase"}}>{project.category}</span><h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginTop:8}}>{project.name}</h1></div><Badge status={project.status}/></div><Tabs tabs={[{key:"overview",label:"Overview"},{key:"proposals",label:"Proposals",count:proposals.length},{key:"scopes",label:"Scopes",count:scopes.length},{key:"tasks",label:"Tasks",count:vis.length},{key:"delivery",label:"Delivery"}]} active={tab} onChange={setTab}/></>}
{/* Overview */}
{tab==="overview"&&!detail&&<div style={{display:"grid",gridTemplateColumns:"5fr 3fr",gap:24}}><div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",marginBottom:20}}><p style={{color:"var(--cream-dim)",fontSize:15,lineHeight:1.8}}>{project.description}</p></div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)"}}>{done.length}/{vis.length} tasks</span><span style={{fontFamily:"var(--serif)",fontSize:24,fontStyle:"italic",color:"var(--cream)"}}>{pct}%</span></div><div style={{height:3,background:"var(--border)",borderRadius:2}}><div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,var(--amber),var(--success))",borderRadius:2}}/></div></div></div><div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",marginBottom:20}}>{client?<><p style={{fontSize:15,color:"var(--cream)",margin:"0 0 3px"}}>{client.name}</p><p style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--cream-mute)",margin:0}}>{client.company}</p></>:<p style={{color:"var(--cream-mute)"}}>Unassigned</p>}</div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)"}}>{[["Deliverables",deliverables.length],["Created",new Date(project.createdAt).toLocaleDateString()]].map(([l,v])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}><span style={{color:"var(--cream-mute)"}}>{l}</span><span style={{color:"var(--cream-dim)"}}>{v}</span></div>))}</div></div></div>}
{/* Proposals */}
{tab==="proposals"&&!detail&&<div>{user.role!=="client"&&<div style={{marginBottom:24}}><Btn icon="plus" onClick={()=>{setPForm({title:"",content:""});setPEdit(null);setPModal(true);}}>New Proposal</Btn></div>}{proposals.map(p=>(<div key={p.id} style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><h3 style={{margin:0,fontSize:17,color:"var(--cream)",fontWeight:500}}>{p.title}</h3><div style={{display:"flex",gap:8,alignItems:"center"}}><Badge status={p.status}/>{user.role!=="client"&&<button onClick={()=>{setPForm({title:p.title,content:p.content});setPEdit(p.id);setPModal(true);}} className="ghost-btn"><Icon name="edit" size={13}/></button>}</div></div><p style={{color:"var(--cream-mute)",fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap",margin:"0 0 16px"}}>{p.content?.slice(0,400)}</p><div style={{display:"flex",gap:8}}>{user.role!=="client"&&p.status==="draft"&&<Btn size="sm" v="secondary" icon="send" onClick={()=>dispatch({type:"UPDATE_PROPOSAL",payload:{id:p.id,status:"sent",sentAt:new Date().toISOString()}})}>Send</Btn>}{user.role==="client"&&p.status==="sent"&&<><Btn size="sm" icon="check" onClick={()=>dispatch({type:"UPDATE_PROPOSAL",payload:{id:p.id,status:"accepted"}})}>Accept</Btn><Btn size="sm" v="danger" onClick={()=>dispatch({type:"UPDATE_PROPOSAL",payload:{id:p.id,status:"rejected"}})}>Reject</Btn></>}</div></div>))}<Modal open={pModal} onClose={()=>setPModal(false)} title={pEdit?"Edit Proposal":"New Proposal"} wide><Field label="Title" value={pForm.title} onChange={v=>setPForm({...pForm,title:v})}/><Field label="Content" value={pForm.content} onChange={v=>setPForm({...pForm,content:v})} type="textarea" rows={10}/><AIButton label="Beautify with AI" content={pForm.content} onConfirm={v=>setPForm({...pForm,content:v})}/><div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}><Btn v="secondary" onClick={()=>setPModal(false)}>Cancel</Btn><Btn onClick={()=>{pEdit?dispatch({type:"UPDATE_PROPOSAL",payload:{id:pEdit,...pForm}}):dispatch({type:"ADD_PROPOSAL",payload:{...pForm,projectId},userId:user.id});setPModal(false);}} disabled={!pForm.title}>{pEdit?"Save":"Create"}</Btn></div></Modal></div>}
{/* Scopes */}
{tab==="scopes"&&!detail&&<div>{user.role!=="client"&&<div style={{marginBottom:24}}><Btn icon="plus" onClick={()=>{setSForm({title:"",sections:[{id:uid(),title:"",content:""}],rateType:"project",rateAmount:"",rateHours:""});setSEdit(null);setSTemplateStep("pick");setSModal(true);}}>New Scope</Btn></div>}{scopes.map(s=>(<div key={s.id} style={{background:"var(--ink-2)",borderRadius:12,border:`1px solid ${s.locked?"rgba(107,158,111,0.2)":"var(--border)"}`,overflow:"hidden",marginBottom:12}}><div style={{padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setExpanded(expanded===s.id?null:s.id)}><div style={{display:"flex",alignItems:"center",gap:12}}>{s.locked&&<span style={{color:"var(--success)"}}><Icon name="lock" size={14}/></span>}<div><h3 style={{margin:0,fontSize:16,color:"var(--cream)",fontWeight:500}}>{s.title}</h3><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>v{s.version} / {s.sections.length} sections</span></div></div><span style={{color:"var(--cream-mute)",transition:"transform .2s",transform:expanded===s.id?"rotate(180deg)":"none"}}><Icon name="down" size={16}/></span></div>{expanded===s.id&&<div style={{padding:"0 24px 20px"}}>{s.sections.map((sec,i)=>(<div key={sec.id} style={{padding:"16px 20px",marginBottom:6,background:"var(--ink)",borderRadius:8,borderLeft:"2px solid var(--amber)"}}><h4 style={{margin:"0 0 6px",fontSize:14,color:"var(--cream)",fontWeight:500}}>{sec.title}</h4><p style={{margin:0,fontSize:13,color:"var(--cream-mute)",lineHeight:1.7}}>{sec.content}</p></div>))}<div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>{!s.locked&&user.role!=="client"&&<Btn size="sm" v="secondary" onClick={()=>dispatch({type:"ADD_TASKS_BULK",payload:s.sections.map(sec=>({projectId,scopeId:s.id,sectionId:sec.id,title:sec.title,description:sec.content,owner:user.id,visibility:"client",dueDate:""})),userId:user.id})}>Generate Tasks</Btn>}{!s.locked&&(user.role==="client"||user.role==="admin")&&<Btn size="sm" icon="lock" onClick={()=>dispatch({type:"APPROVE_SCOPE",payload:s.id,userId:user.id})}>Approve</Btn>}{user.role==="admin"&&(s.scopeStatus==="accepted"||s.signedBy)&&<AIScopeDeliverables scope={s} projectId={projectId} userId={user.id} dispatch={dispatch}/>}</div></div>}</div>))}<Modal open={sModal} onClose={()=>setSModal(false)} title={sEdit?"Edit Scope":sTemplateStep==="pick"?"New Scope — Choose Template":"New Scope"} wide>
{!sEdit&&sTemplateStep==="pick"&&<div>
  <p style={{fontSize:13,color:"var(--cream-mute)",marginBottom:20,lineHeight:1.6}}>Select a template to pre-fill sections, or start from a custom blank scope.</p>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
    {SCOPE_TEMPLATES.map(t=>(
      <div key={t.id} onClick={()=>{const filled=t.sections.map(s=>({id:uid(),title:s.title,content:s.content}));setSForm({...sForm,title:t.label,sections:filled});setSTemplateStep("edit");}} style={{padding:"20px 18px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:12,cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--amber)";e.currentTarget.style.background="rgba(196,162,101,0.05)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--ink)";}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:28,height:28,borderRadius:8,background:"rgba(196,162,101,0.08)",border:"1px solid rgba(196,162,101,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name={t.icon} size={13}/></div><div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--amber)",letterSpacing:"0.06em"}}>{t.label}</div></div>
        <div style={{fontSize:12,color:"var(--cream-mute)",lineHeight:1.5}}>{t.sections.length} sections pre-filled</div>
      </div>
    ))}
  </div>
  <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setSModal(false)}>Cancel</Btn></div>
</div>}
{(sEdit||sTemplateStep==="edit")&&<div>
  {!sEdit&&<button onClick={()=>setSTemplateStep("pick")} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"var(--cream-mute)",cursor:"pointer",fontSize:11,fontFamily:"var(--mono)",letterSpacing:"0.08em",marginBottom:16,padding:0}}>← CHANGE TEMPLATE</button>}
  <Field label="Title" value={sForm.title} onChange={v=>setSForm({...sForm,title:v})}/>
  {sForm.sections.map((sec,i)=>(<div key={sec.id||i} style={{padding:18,marginBottom:10,background:"var(--ink)",borderRadius:10,border:"1px solid var(--border)"}}><Field label="Section Title" value={sec.title} onChange={v=>{const s=[...sForm.sections];s[i]={...s[i],title:v};setSForm({...sForm,sections:s});}}/><Field label="Content" value={sec.content} onChange={v=>{const s=[...sForm.sections];s[i]={...s[i],content:v};setSForm({...sForm,sections:s});}} type="textarea" rows={3}/><AIButton label="Rewrite with AI" content={sec.content} onConfirm={v=>{const s=[...sForm.sections];s[i]={...s[i],content:v};setSForm({...sForm,sections:s});}}/></div>))}
  <Btn v="secondary" size="sm" icon="plus" onClick={()=>setSForm({...sForm,sections:[...sForm.sections,{id:uid(),title:"",content:""}]})}>Add Section</Btn>
  <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid var(--border)"}}>
    <label style={{display:"block",fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>Engagement Rate</label>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
      <div>
        <label style={{display:"block",fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",marginBottom:5}}>TYPE</label>
        <select value={sForm.rateType||"project"} onChange={e=>setSForm({...sForm,rateType:e.target.value})} style={{width:"100%",padding:"10px 12px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)"}}>
          <option value="project">Project-based</option>
          <option value="hourly">Hourly rate</option>
          <option value="retainer">Monthly retainer</option>
        </select>
      </div>
      <div>
        <label style={{display:"block",fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",marginBottom:5}}>AMOUNT (USD)</label>
        <input type="number" value={sForm.rateAmount||""} onChange={e=>setSForm({...sForm,rateAmount:e.target.value})} placeholder="12000" style={{width:"100%",padding:"10px 12px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)"}}/>
      </div>
      {sForm.rateType==="hourly"&&<div>
        <label style={{display:"block",fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",marginBottom:5}}>EST. HOURS</label>
        <input type="number" value={sForm.rateHours||""} onChange={e=>setSForm({...sForm,rateHours:e.target.value})} placeholder="40" style={{width:"100%",padding:"10px 12px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)"}}/>
      </div>}
    </div>
  </div>
  <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}><Btn v="secondary" onClick={()=>setSModal(false)}>Cancel</Btn><Btn onClick={()=>{const rate=sForm.rateAmount?{type:sForm.rateType,amount:Number(sForm.rateAmount),currency:"USD",...(sForm.rateHours?{hours:Number(sForm.rateHours)}:{})}:undefined;sEdit?dispatch({type:"UPDATE_SCOPE",payload:{id:sEdit,title:sForm.title,sections:sForm.sections,...(rate?{rate}:{})}}):dispatch({type:"ADD_SCOPE",payload:{...sForm,projectId,...(rate?{rate}:{})},userId:user.id});setSModal(false);}} disabled={!sForm.title}>{sEdit?"Save":"Create"}</Btn></div>
</div>}
</Modal></div>}
{/* Tasks */}
{tab==="tasks"&&<TasksTabContent vis={vis} sel={sel} detail={detail} setDetail={setDetail} data={data} user={user} dispatch={dispatch} projectId={projectId} tModal={tModal} setTModal={setTModal} tEdit={tEdit} setTEdit={setTEdit} tForm={tForm} setTForm={setTForm} comment={comment} setComment={setComment} showMentions={showMentions} setShowMentions={setShowMentions} cRef={cRef} tComments={tComments} tDelivs={tDelivs} counts={counts} filter={filter} setFilter={setFilter} filtered={filtered}/>}
{/* Delivery */}
{tab==="delivery"&&!detail&&<div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontFamily:"var(--serif)",fontSize:20,fontStyle:"italic",color:"var(--cream)",fontWeight:400}}>Delivery Summary</h3>{user.role!=="client"&&<Btn v="ai" size="sm" icon="ai" onClick={async()=>{setSumLoad(true);const r=await callAI(`Generate a delivery summary:\n${done.map(t=>`- ${t.title}`).join("\n")}`,"Create a concise delivery summary.");setSummary(r);setSumLoad(false);}} disabled={sumLoad}>{sumLoad?"...":"Generate"}</Btn>}</div>{summary?<div style={{padding:20,background:"var(--ink)",borderRadius:8,color:"var(--cream-dim)",fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{summary}</div>:<p style={{color:"var(--cream-mute)",fontSize:13,fontStyle:"italic"}}>Not generated</p>}</div><div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",marginBottom:20}}>{done.map(t=>(<div key={t.id} style={{padding:"10px 0",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}><span style={{color:"var(--success)"}}><Icon name="check" size={13}/></span><span style={{fontSize:14,color:"var(--cream-dim)"}}>{t.title}</span></div>))}</div>{user.role==="client"&&done.length>0&&<div style={{padding:24,background:"rgba(107,158,111,0.05)",borderRadius:12,border:"1px solid rgba(107,158,111,0.15)"}}><label style={{display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}><input type="checkbox" checked={ack} onChange={e=>{setAck(e.target.checked);if(e.target.checked)dispatch({type:"ACKNOWLEDGE_DELIVERY",payload:projectId,userId:user.id});}} style={{width:18,height:18,accentColor:"var(--amber)"}}/><span style={{fontSize:14,color:"var(--cream)",fontWeight:500}}>I acknowledge receipt of all deliverables</span></label></div>}</div>}
</div>);};

const ActivityPage=({data})=>{const sorted=[...data.activityLog].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));return(<div><h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginBottom:40}}>Activity Log</h1><div style={{position:"relative",paddingLeft:28}}><div style={{position:"absolute",left:5,top:0,bottom:0,width:1,background:"var(--border)"}}/>{sorted.map(a=>{const au=data.users.find(u=>u.id===a.userId);return(<div key={a.id} style={{padding:"16px 0",position:"relative"}}><div style={{position:"absolute",left:-24,top:20,width:8,height:8,borderRadius:"50%",background:"var(--amber)"}}/><div style={{display:"flex",justifyContent:"space-between"}}><div><p style={{margin:0,fontSize:14,color:"var(--cream-dim)"}}>{a.details}</p><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{au?.name}</span></div><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{new Date(a.timestamp).toLocaleString()}</span></div></div>);})}</div></div>);};

const SettingsPage=({data,dispatch,user})=>{
  const[tab,setTab]=useState("users");
  const[uModal,setUModal]=useState(false);
  const[uForm,setUForm]=useState({name:"",email:"",role:"client",clientId:"",permissions:{canViewTasks:true,canViewDeliverables:true,canApproveScopes:false,canComment:true}});
  const[generatedLink,setGeneratedLink]=useState(null);
  const[editUser,setEditUser]=useState(null);
  const[emailStatus,setEmailStatus]=useState(null); // null | "sending" | "sent" | "error"
  const[emailErr,setEmailErr]=useState("");
  const[pForm,setPForm]=useState({...data.portfolioSettings});

  const createUser=async()=>{
    const avatar=uForm.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    const emailTo=uForm.email; const nameTo=uForm.name;
    dispatch({type:"ADD_USER",payload:{...uForm,avatar}});
    setUForm({name:"",email:"",role:"client",clientId:"",permissions:{canViewTasks:true,canViewDeliverables:true,canApproveScopes:false,canComment:true}});
    setUModal(false);
    setEmailStatus("sending"); setEmailErr("");
    setGeneratedLink({name:nameTo});
    try {
      await sendMagicEmail({to:emailTo,name:nameTo,type:"invite"});
      setEmailStatus("sent");
      setTimeout(()=>{setEmailStatus(null);setGeneratedLink(null);},6000);
    } catch(e) {
      setEmailStatus("error"); setEmailErr(e.message);
    }
  };

  const resendLink=async(u)=>{
    setEmailStatus("sending"); setEmailErr("");
    setGeneratedLink({name:u.name});
    try {
      await sendMagicEmail({to:u.email,name:u.name,type:"login"});
      setEmailStatus("sent");
      setTimeout(()=>{setEmailStatus(null);setGeneratedLink(null);},6000);
    } catch(e) {
      setEmailStatus("error"); setEmailErr(e.message);
    }
  };

  const PERMS=[
    {key:"canViewTasks",label:"View Tasks"},
    {key:"canViewDeliverables",label:"View Deliverables"},
    {key:"canApproveScopes",label:"Approve Scopes"},
    {key:"canComment",label:"Post Comments"},
  ];

  const roleColor={admin:"var(--amber)",internal:"var(--sky)",client:"var(--success)"};

  return(<div>
    <h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginBottom:40}}>Settings</h1>
    <Tabs tabs={[{key:"users",label:"Users & Permissions"},{key:"portfolio",label:"Portfolio"}]} active={tab} onChange={setTab}/>

    {tab==="users"&&<div>
      {/* Email delivery status banner */}
      {generatedLink&&<div style={{marginBottom:24,padding:"18px 22px",background:emailStatus==="error"?"rgba(168,91,91,0.06)":"rgba(107,158,111,0.06)",borderRadius:12,border:`1px solid ${emailStatus==="error"?"rgba(168,91,91,0.25)":"rgba(107,158,111,0.2)"}`,animation:"fadeUp .3s ease-out",display:"flex",alignItems:"center",gap:12}}>
        {emailStatus==="sending"&&<div style={{width:14,height:14,border:"1.5px solid var(--border)",borderTopColor:"var(--success)",borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/>}
        {emailStatus==="sent"&&<span style={{color:"var(--success)",fontSize:16,flexShrink:0}}>✓</span>}
        {emailStatus==="error"&&<span style={{color:"var(--danger)",fontSize:16,flexShrink:0}}>✕</span>}
        <div style={{flex:1}}>
          <div style={{fontFamily:"var(--mono)",fontSize:11,color:emailStatus==="error"?"var(--danger)":"var(--success)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>
            {emailStatus==="sending"&&`Sending magic link to ${generatedLink.name}…`}
            {emailStatus==="sent"&&`Magic link delivered to ${generatedLink.name}`}
            {emailStatus==="error"&&`Delivery failed`}
          </div>
          <div style={{fontSize:12,color:"var(--cream-mute)",lineHeight:1.5}}>
            {emailStatus==="sent"&&"Signed 24-hour link sent via Resend from sahil@revosys.pro"}
            {emailStatus==="error"&&`${emailErr} — check RESEND_API_KEY and MAGIC_SECRET in Vercel env vars`}
          </div>
        </div>
        <button onClick={()=>{setGeneratedLink(null);setEmailStatus(null);}} style={{background:"none",border:"none",color:"var(--cream-mute)",cursor:"pointer",fontSize:18,lineHeight:1,flexShrink:0}}>×</button>
      </div>}

      <Btn icon="plus" onClick={()=>setUModal(true)} style={{marginBottom:24}}>Invite User</Btn>

      {/* User list */}
      <div style={{display:"grid",gap:1,background:"var(--border)",borderRadius:12,overflow:"hidden",marginBottom:8}}>
        {data.users.map(u=>(
          <div key={u.id} style={{padding:"18px 20px",background:"var(--ink-2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:38,height:38,borderRadius:10,background:"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:14,fontStyle:"italic",color:"var(--amber)",flexShrink:0}}>{u.avatar}</div>
                <div>
                  <div style={{fontSize:14,color:"var(--cream)",fontWeight:500}}>{u.name}</div>
                  <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)",marginTop:2}}>{u.email}</div>
                  {u.clientId && data.clients.find(c=>c.id===u.clientId) && (
                    <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--sky)",letterSpacing:"0.06em"}}>
                      {data.clients.find(c=>c.id===u.clientId).company||data.clients.find(c=>c.id===u.clientId).name}
                    </span>
                  )}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {/* Role selector */}
                {u.role==="admin"
                  ? <span style={{fontFamily:"var(--mono)",fontSize:11,color:roleColor.admin,padding:"4px 10px",border:"1px solid rgba(196,162,101,0.2)",borderRadius:6}}>Admin</span>
                  : <select value={u.role} onChange={e=>dispatch({type:"UPDATE_USER",payload:{id:u.id,role:e.target.value}})} style={{background:"var(--ink)",border:"1px solid var(--border)",borderRadius:6,color:roleColor[u.role]||"var(--cream-mute)",fontSize:11,fontFamily:"var(--mono)",padding:"4px 10px",cursor:"pointer"}}>
                      <option value="client">Client</option>
                      <option value="internal">Internal</option>
                    </select>
                }
                {u.role!=="admin"&&<>
                  <button onClick={()=>setEditUser(editUser?.id===u.id?null:u)} style={{background:"none",border:"1px solid var(--border)",borderRadius:6,color:"var(--cream-mute)",cursor:"pointer",fontSize:11,fontFamily:"var(--mono)",padding:"4px 10px",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--amber)";e.currentTarget.style.color="var(--amber)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--cream-mute)";}}>Permissions</button>
                  <button onClick={()=>resendLink(u)} style={{background:"none",border:"1px solid var(--border)",borderRadius:6,color:"var(--cream-mute)",cursor:"pointer",fontSize:11,fontFamily:"var(--mono)",padding:"4px 10px",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--sky)";e.currentTarget.style.color="var(--sky)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--cream-mute)";}}>Resend Link</button>
                  <button onClick={()=>dispatch({type:"REMOVE_USER",payload:u.id})} style={{background:"none",border:"1px solid var(--border)",borderRadius:6,color:"var(--cream-mute)",cursor:"pointer",fontSize:11,fontFamily:"var(--mono)",padding:"4px 10px",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--danger)";e.currentTarget.style.color="var(--danger)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--cream-mute)";}}>Remove</button>
                </>}
              </div>
            </div>
            {/* Permissions panel */}
            {editUser?.id===u.id&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",display:"flex",gap:8,flexWrap:"wrap",animation:"fadeUp .2s ease-out"}}>
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.1em",textTransform:"uppercase",alignSelf:"center",marginRight:4}}>Permissions:</span>
              {PERMS.map(p=>{
                const on=(u.permissions||{})[p.key]!==false;
                return(<button key={p.key} onClick={()=>dispatch({type:"UPDATE_USER",payload:{id:u.id,permissions:{...(u.permissions||{}), [p.key]:!on}}})} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${on?"rgba(107,158,111,0.35)":"var(--border)"}`,background:on?"rgba(107,158,111,0.08)":"transparent",color:on?"var(--success)":"var(--cream-mute)",fontSize:11,fontFamily:"var(--mono)",cursor:"pointer",transition:"all .2s"}}>{on?"✓ ":""}{p.label}</button>);
              })}
            </div>}
          </div>
        ))}
      </div>

      {/* Invite modal */}
      <Modal open={uModal} onClose={()=>setUModal(false)} title="Invite User">
        <p style={{fontSize:13,color:"var(--cream-mute)",marginBottom:20,lineHeight:1.7}}>The user will receive a magic link to access their workspace. No password required.</p>
        <Field label="Full Name" value={uForm.name} onChange={v=>setUForm({...uForm,name:v})} placeholder="Jane Smith"/>
        <Field label="Email" value={uForm.email} onChange={v=>setUForm({...uForm,email:v})} placeholder="jane@company.com"/>
        <Field label="Role" value={uForm.role} onChange={v=>setUForm({...uForm,role:v})} type="select" options={[{value:"client",label:"Client (external)"},{value:"internal",label:"Internal (team)"}]}/>
        <Field label="Company / Account" value={uForm.clientId||""} onChange={v=>setUForm({...uForm,clientId:v})} type="select" options={[{value:"",label:"None"},...data.clients.map(c=>({value:c.id,label:c.company||c.name}))]}/>
        <div style={{marginBottom:18}}>
          <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:10}}>Permissions</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {PERMS.map(p=>{const on=(uForm.permissions||{})[p.key]!==false;return(<button key={p.key} onClick={()=>setUForm({...uForm,permissions:{...uForm.permissions,[p.key]:!on}})} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${on?"rgba(107,158,111,0.35)":"var(--border)"}`,background:on?"rgba(107,158,111,0.08)":"transparent",color:on?"var(--success)":"var(--cream-mute)",fontSize:11,fontFamily:"var(--mono)",cursor:"pointer"}}>{on?"✓ ":""}{p.label}</button>);})}
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn v="secondary" onClick={()=>setUModal(false)}>Cancel</Btn>
          <Btn onClick={createUser} disabled={!uForm.name||!uForm.email}>Generate Magic Link</Btn>
        </div>
      </Modal>
    </div>}

    {tab==="portfolio"&&<div style={{padding:28,background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)"}}>
      <Field label="Headline" value={pForm.headline} onChange={v=>setPForm({...pForm,headline:v})}/>
      <Field label="Subheadline" value={pForm.subheadline} onChange={v=>setPForm({...pForm,subheadline:v})} type="textarea" rows={2}/>
      <AIButton label="Enhance" content={pForm.headline} onConfirm={v=>setPForm({...pForm,headline:v})}/>
      <div style={{marginTop:16}}><Btn onClick={()=>dispatch({type:"UPDATE_PORTFOLIO",payload:pForm})}>Save</Btn></div>
    </div>}
  </div>);
};

// ============================================================
// AI AGENTS — Conversational, multi-step, HubSpot-style
// ============================================================

// Shared conversational agent shell
const AgentChat=({title,color,icon,tag,description,capabilities,data,initialMessage,processMessage})=>{
  const[messages,setMessages]=useState([{role:"agent",content:initialMessage}]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[artifacts,setArtifacts]=useState([]);
  const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  const send=async(text)=>{
    const msg=(text||input).trim();
    if(!msg||loading)return;
    setInput("");
    const newMsgs=[...messages,{role:"user",content:msg}];
    setMessages(newMsgs);
    setLoading(true);
    const{reply,newArtifacts}=await processMessage(msg,newMsgs,artifacts);
    setMessages(prev=>[...prev,{role:"agent",content:reply}]);
    if(newArtifacts)setArtifacts(prev=>[...prev,...newArtifacts]);
    setLoading(false);
  };

  return(<div style={{background:"var(--ink-2)",borderRadius:14,border:`1px solid ${color}30`,animation:"fadeUp .3s ease-out",overflow:"hidden"}}>
    {/* Agent header with description */}
    <div style={{padding:"24px 28px",borderBottom:`1px solid ${color}20`,background:`${color}05`}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
        <div style={{width:40,height:40,borderRadius:10,background:`${color}15`,border:`1px solid ${color}30`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name={icon} size={18}/></div>
        <div><div style={{fontFamily:"var(--mono)",fontSize:9,color:color,letterSpacing:"0.12em",textTransform:"uppercase"}}>{tag}</div><div style={{fontSize:17,color:"var(--cream)",fontWeight:500}}>{title}</div></div>
      </div>
      <p style={{fontSize:13,color:"var(--cream-mute)",lineHeight:1.7,margin:"0 0 14px"}}>{description}</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {capabilities.map((c,i)=><span key={i} style={{padding:"4px 10px",borderRadius:20,background:`${color}10`,border:`1px solid ${color}20`,fontFamily:"var(--mono)",fontSize:9,color:color,letterSpacing:"0.06em"}}>{c}</span>)}
      </div>
    </div>
    {/* Chat area */}
    <div style={{height:380,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:10}}>
      {messages.map((m,i)=>(
        <div key={i} style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",animation:i>0?"fadeUp .3s ease-out":"none"}}>
          {m.role==="agent"&&<div style={{width:26,height:26,borderRadius:8,background:`${color}20`,border:`1px solid ${color}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name={icon} size={11}/></div>}
          <div style={{maxWidth:"75%",padding:"10px 14px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",background:m.role==="user"?color:"var(--ink)",color:m.role==="user"?"var(--ink)":"var(--cream-dim)",fontSize:13,lineHeight:1.7,border:m.role==="user"?"none":"1px solid var(--border)",whiteSpace:"pre-wrap"}}>{m.content}</div>
        </div>
      ))}
      {/* Artifacts display */}
      {artifacts.map((a,i)=>(
        <div key={`art_${i}`} style={{padding:"14px 18px",background:"var(--ink)",borderRadius:10,border:`1px solid ${color}25`,borderLeft:`3px solid ${color}`,animation:"fadeUp .3s ease-out"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:9,color:color,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>{a.type}</div>
          <div style={{fontSize:13,color:"var(--cream-dim)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{a.content}</div>
          {a.actions&&<div style={{display:"flex",gap:6,marginTop:10}}>{a.actions.map((act,ai)=><Btn key={ai} size="sm" v={ai===0?"primary":"secondary"} onClick={act.fn}>{act.label}</Btn>)}</div>}
        </div>
      ))}
      {loading&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:8,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name={icon} size={11}/></div><div style={{padding:"10px 14px",borderRadius:"12px 12px 12px 4px",background:"var(--ink)",border:"1px solid var(--border)"}}><div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:color,animation:`flowPulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div></div></div>}
      <div ref={endRef}/>
    </div>
    {/* Input */}
    <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:8}}>
      <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Type your response..." style={{flex:1,padding:"10px 14px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)"}}/>
      <Btn v="ai" onClick={()=>send()} disabled={!input.trim()||loading}><Icon name="send" size={14}/></Btn>
    </div>
  </div>);
};

const ScopeBuilderAgent=({data,dispatch,user})=>{
  const processMessage=async(msg,history,artifacts)=>{
    const step=history.filter(m=>m.role==="user").length;
    const prevCtx=history.map(m=>`${m.role==="user"?"User":"Agent"}: ${m.content}`).join("\n");
    if(step===1){
      const reply=await callAI(`The user wants to build a scope. They said: "${msg}"\n\nAsk 2-3 clarifying questions about: project type, number of stakeholders, integrations needed, timeline expectations, and budget range. Be conversational and specific based on what they told you.`,"You are a senior GTM consultant at Revo-Sys helping build a project scope. Ask targeted follow-up questions. Be concise.");
      return{reply};
    }
    if(step===2){
      const reply=await callAI(`Conversation so far:\n${prevCtx}\n\nBased on the answers, ask 1-2 more specific questions about: deliverables they expect, success metrics, any compliance/security needs, and who the key stakeholders are. Then tell them you have enough to generate the scope.`,"You are a senior GTM consultant. Gather final details before generating the scope. Be brief and targeted.");
      return{reply};
    }
    // Step 3+: Generate scope
    const raw=await callAI(`Full conversation:\n${prevCtx}\n\nBased on ALL the information gathered, generate a detailed project scope.\n\nReturn ONLY valid JSON: {"title":"scope title","rateSuggestion":"$X,XXX–$XX,XXX","sections":[{"title":"section title","content":"detailed content with specifics from the conversation"}]}`,"You are a senior GTM consultant. Generate 4-6 detailed, specific sections based on the conversation. Include specific details the user mentioned. Return only valid JSON.");
    let result;
    try{result=JSON.parse(raw.replace(/```json?|```/g,"").trim());}
    catch{result={title:"Generated Scope",rateSuggestion:"TBD",sections:[{title:"Scope Overview",content:raw}]};}
    const scopeText=`${result.title}\nEstimated: ${result.rateSuggestion}\n\n${result.sections.map(s=>`[${s.title}]\n${s.content}`).join("\n\n")}`;
    const newArtifacts=[{type:"Generated Scope",content:scopeText,actions:[
      {label:"Save to Project",fn:()=>{const pid=data.projects[0]?.id;if(pid){dispatch({type:"ADD_SCOPE",payload:{projectId:pid,title:result.title,sections:result.sections.map((s,i)=>({id:`sec_${Date.now()}_${i}`,title:s.title,content:s.content})),rate:{type:"project",amount:0,currency:"USD"},scopeStatus:"draft"},userId:user.id});alert("Scope saved!");}}},
      {label:"Copy",fn:()=>navigator.clipboard?.writeText(scopeText)}
    ]}];
    return{reply:`Here's your scope — "${result.title}" with ${result.sections.length} sections. Estimated investment: ${result.rateSuggestion}.\n\nI've generated it as an artifact below. You can save it directly to a project or copy it. Want me to adjust anything?`,newArtifacts};
  };
  return <AgentChat title="Scope Builder" color="var(--amber)" icon="doc" tag="SCOPE AUTOMATION" description="Builds comprehensive project scopes through a guided conversation. Asks about your client's needs, timeline, stakeholders, and budget — then generates a detailed, ready-to-send scope document." capabilities={["Guided Discovery","Auto-Sections","Rate Estimation","Save to Project"]} data={data} initialMessage="Hi! I'm your Scope Builder agent. Tell me about the project you need to scope — what's the client asking for? I'll ask a few targeted questions and then generate a complete scope for you." processMessage={processMessage}/>;
};

const ProspectingAgent=({data,dispatch,user})=>{
  const processMessage=async(msg,history,artifacts)=>{
    const step=history.filter(m=>m.role==="user").length;
    const prevCtx=history.map(m=>`${m.role==="user"?"User":"Agent"}: ${m.content}`).join("\n");
    const clientCtx=data.clients.map(c=>`${c.name} (${c.company}, ${c.industry||"unknown industry"}, status: ${c.status})`).join("; ");
    const projCtx=data.projects.map(p=>{const c=data.clients.find(cl=>cl.id===p.clientId);const tasks=data.tasks.filter(t=>t.projectId===p.id);const overdue=tasks.filter(t=>t.status!=="completed"&&t.dueDate&&new Date(t.dueDate)<new Date());return`${p.name} (client: ${c?.company||"unknown"}, status: ${p.status}, tasks: ${tasks.length}, overdue: ${overdue.length})`;}).join("; ");

    if(step===1){
      const reply=await callAI(`User wants prospecting help. They said: "${msg}"\n\nCurrent clients: ${clientCtx}\nCurrent projects: ${projCtx}\n\nBased on their existing client base, ask them:\n1. What's their ideal customer profile (industry, company size, tech stack)?\n2. Are they looking to expand existing accounts or acquire new ones?\n3. What's their typical deal size and sales cycle?\n\nAlso share 1-2 quick observations about intent signals you notice from their current portfolio (e.g., overdue tasks might mean capacity issues, completed projects might mean upsell opportunities).`,"You are a senior GTM strategist and prospecting expert at Revo-Sys. You help identify ideal prospects and craft personalized outreach. Be conversational and insightful.");
      return{reply};
    }
    if(step===2){
      const reply=await callAI(`Conversation:\n${prevCtx}\n\nExisting clients: ${clientCtx}\nProjects: ${projCtx}\n\nBased on their answers, ask about:\n1. What messaging/value props have worked in past outreach?\n2. Any specific companies or verticals they're targeting?\n3. What channels do they prefer (email, LinkedIn, calls)?\n\nAlso identify 2-3 "intent signals" from their current data — like which clients might be ready for upsell, which projects indicate expertise they can promote.`,"You are a GTM prospecting expert. Gather targeting info and share portfolio insights. Be concise.");
      return{reply};
    }
    // Step 3+: Generate prospecting plan with personalized sequences
    const raw=await callAI(`Full conversation:\n${prevCtx}\n\nClients: ${clientCtx}\nProjects: ${projCtx}\n\nGenerate a prospecting playbook.\n\nReturn ONLY valid JSON: {"icpSummary":"ideal customer profile summary","intentSignals":[{"signal":"what you noticed","implication":"what it means","action":"recommended action"}],"sequences":[{"name":"sequence name","target":"who this targets","steps":[{"channel":"email|linkedin|call","day":"Day X","subject":"subject/hook","content":"full message draft"}]}],"upsellOpportunities":[{"client":"client name","opportunity":"what to offer","reason":"why now"}]}`,"You are a senior prospecting strategist. Create specific, personalized outreach sequences using data from the conversation. Return only valid JSON.");
    let result;
    try{result=JSON.parse(raw.replace(/```json?|```/g,"").trim());}
    catch{result={icpSummary:raw,intentSignals:[],sequences:[],upsellOpportunities:[]};}

    const parts=[];
    if(result.intentSignals?.length>0) parts.push(`INTENT SIGNALS\n${result.intentSignals.map(s=>`• ${s.signal} → ${s.implication} → Action: ${s.action}`).join("\n")}`);
    if(result.upsellOpportunities?.length>0) parts.push(`\nUPSELL OPPORTUNITIES\n${result.upsellOpportunities.map(u=>`• ${u.client}: ${u.opportunity} (${u.reason})`).join("\n")}`);
    const seqText=result.sequences?.map(s=>`\n--- ${s.name} (Target: ${s.target}) ---\n${s.steps?.map(st=>`${st.day} [${st.channel}] ${st.subject||""}\n${st.content}`).join("\n\n")}`).join("\n")||"";

    const newArtifacts=[];
    if(parts.length>0) newArtifacts.push({type:"Intent Signals & Opportunities",content:parts.join("\n")});
    if(seqText) newArtifacts.push({type:"Outreach Sequences",content:seqText,actions:[{label:"Copy All",fn:()=>navigator.clipboard?.writeText(seqText)}]});

    return{reply:`Here's your prospecting playbook!\n\nICP: ${result.icpSummary}\n\nI found ${result.intentSignals?.length||0} intent signals, ${result.upsellOpportunities?.length||0} upsell opportunities, and created ${result.sequences?.length||0} outreach sequences.\n\nCheck the artifacts below. Want me to refine any sequence or draft more personalized messaging?`,newArtifacts};
  };
  return <AgentChat title="Prospecting Agent" color="var(--violet)" icon="target" tag="REVENUE INTELLIGENCE" description="Analyzes your client portfolio for intent signals, identifies upsell opportunities, builds ideal customer profiles, and generates personalized multi-channel outreach sequences — like a dedicated SDR that knows your entire book of business." capabilities={["Intent Signals","ICP Builder","Outreach Sequences","Upsell Detection","Multi-Channel"]} data={data} initialMessage="Hi! I'm your Prospecting Agent. I've already scanned your client portfolio and project data for signals.\n\nTell me — are you looking to:\n• Find new prospects similar to your best clients?\n• Identify upsell opportunities in existing accounts?\n• Build outreach sequences for a specific vertical?\n\nWhat's your prospecting goal right now?" processMessage={processMessage}/>;
};

const FollowUpAgent=({data,dispatch,user})=>{
  const processMessage=async(msg,history,artifacts)=>{
    const step=history.filter(m=>m.role==="user").length;
    const prevCtx=history.map(m=>`${m.role==="user"?"User":"Agent"}: ${m.content}`).join("\n");
    const overdue=data.tasks.filter(t=>t.status!=="completed"&&t.dueDate&&new Date(t.dueDate)<new Date());
    const projSummary=data.projects.filter(p=>p.status==="active").map(p=>{const tasks=data.tasks.filter(t=>t.projectId===p.id);const od=tasks.filter(t=>t.status!=="completed"&&t.dueDate&&new Date(t.dueDate)<new Date());const client=data.clients.find(c=>c.id===p.clientId);const lastActivity=data.activityLog.filter(a=>a.entityId===p.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0];return`${p.name} (client: ${client?.name||"unknown"}, company: ${client?.company||""}, overdue: ${od.length}/${tasks.length} tasks, last activity: ${lastActivity?new Date(lastActivity.timestamp).toLocaleDateString():"unknown"})`;}).join("\n");

    if(step===1){
      const reply=await callAI(`User said: "${msg}"\n\nPortfolio status:\n${projSummary}\nTotal overdue: ${overdue.length}\n\nAnalyze the portfolio and:\n1. Identify which accounts are at risk (overdue tasks, no recent activity)\n2. Ask the user about any context that data doesn't show (recent calls, pending decisions, blockers)\n3. Ask which accounts they want to prioritize for follow-up\n\nBe specific — mention actual project/client names from the data.`,"You are a senior account manager at Revo-Sys. You help maintain client relationships and prevent churn. Analyze data and ask smart questions. Be specific and use real names from the data.");
      return{reply};
    }
    if(step===2){
      const reply=await callAI(`Conversation:\n${prevCtx}\n\nPortfolio:\n${projSummary}\n\nBased on their context, ask:\n1. What tone do they prefer for follow-ups (formal/casual)?\n2. Any specific asks or updates to include per client?\n3. Confirm which channels to use (email, Slack, call)\n\nThen tell them you'll generate the follow-up plan.`,"You are a senior account manager. Gather final details for crafting perfect follow-ups. Be brief.");
      return{reply};
    }
    // Generate follow-up plan
    const raw=await callAI(`Full conversation:\n${prevCtx}\n\nPortfolio:\n${projSummary}\n\nGenerate follow-up actions and draft communications.\n\nReturn ONLY valid JSON: [{"priority":"HIGH|MEDIUM|LOW","client":"client name","project":"project name","riskLevel":"at-risk|healthy|needs-attention","action":"specific action","channel":"email|call|slack","draftMessage":"full draft message ready to send","reason":"why this follow-up matters now"}]`,"You are a senior account manager. Create specific, personalized follow-up actions with ready-to-send messages. Use details from the conversation. Return only valid JSON array.");
    let actions;
    try{actions=JSON.parse(raw.replace(/```json?|```/g,"").trim());if(!Array.isArray(actions))actions=[actions];}
    catch{actions=[{priority:"HIGH",client:"All",project:"All",riskLevel:"needs-attention",action:"Review portfolio",channel:"email",draftMessage:raw,reason:"Unable to parse structured actions"}];}

    const pc={HIGH:"#A85B5B",MEDIUM:"#C4A265",LOW:"#5B8FA8"};
    const newArtifacts=actions.map(a=>({
      type:`${a.priority} — ${a.client} (${a.channel})`,
      content:`${a.action}\n\nReason: ${a.reason}\n\n--- Draft ${a.channel} ---\n${a.draftMessage}`,
      actions:[
        {label:`Copy ${a.channel} Draft`,fn:()=>navigator.clipboard?.writeText(a.draftMessage)},
        ...(a.channel==="email"?[{label:"Send via Inbox",fn:()=>alert(`Navigate to Inbox to send to ${a.client}`)}]:[])
      ]
    }));

    return{reply:`Done! I've generated ${actions.length} follow-up actions prioritized by risk level.\n\n${actions.filter(a=>a.priority==="HIGH").length} high priority, ${actions.filter(a=>a.priority==="MEDIUM").length} medium, ${actions.filter(a=>a.priority==="LOW").length} low.\n\nEach one has a ready-to-send draft below. Want me to adjust the tone or add anything to any of them?`,newArtifacts};
  };
  return <AgentChat title="Follow-up Agent" color="var(--sky)" icon="activity" tag="RELATIONSHIP MANAGEMENT" description="Continuously monitors your portfolio for at-risk accounts, stale projects, and overdue tasks. Asks about context behind the data, then generates prioritized follow-up actions with ready-to-send messages for each client." capabilities={["Risk Detection","Account Health","Draft Messages","Priority Actions","Multi-Channel"]} data={data} initialMessage={`I've scanned your portfolio. Here's what I see:\n\n• ${data.projects.filter(p=>p.status==="active").length} active projects\n• ${data.tasks.filter(t=>t.status!=="completed"&&t.dueDate&&new Date(t.dueDate)<new Date()).length} overdue tasks\n• ${data.clients.filter(c=>c.status==="active").length} active clients\n\nWould you like me to analyze which accounts need attention? Tell me if there's any context I should know — recent meetings, pending decisions, or clients you're worried about.`} processMessage={processMessage}/>;
};

// ============================================================
// JOB FINDER AGENT — Real jobs from Remotive, Himalayas, Jobicy, Arbeitnow
// Results appear in a closeable sidebar panel
// ============================================================
const JOB_SCHEDULE_KEY="rs_job_schedule";
const JOB_CACHE_KEY="rs_job_cache";

// Chip input: tags are first-class items, not a comma-separated string.
// Enter / comma / Tab commits a chip. Backspace on empty removes the last.
const ChipInput=({label,chips,onChange,placeholder,accent="var(--success)"})=>{
  const[draft,setDraft]=useState("");
  const commit=(v)=>{
    const s=(v||draft).trim().replace(/,$/,"").trim();
    if(!s)return;
    if(chips.some(c=>c.toLowerCase()===s.toLowerCase())){setDraft("");return;}
    onChange([...chips,s]);
    setDraft("");
  };
  const remove=(idx)=>onChange(chips.filter((_,i)=>i!==idx));
  return(<div>
    {label&&<label style={{fontFamily:"var(--mono)",fontSize:9,letterSpacing:"0.12em",color:"var(--cream-mute)",display:"block",marginBottom:6}}>{label}</label>}
    <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",padding:"8px 10px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:8,minHeight:40}}>
      {chips.map((c,i)=>(
        <span key={`${c}-${i}`} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 8px 4px 10px",background:`${accent}15`,border:`1px solid ${accent}40`,borderRadius:999,fontFamily:"var(--mono)",fontSize:11,color:accent}}>
          {c}
          <button type="button" onClick={()=>remove(i)} style={{background:"none",border:"none",color:accent,cursor:"pointer",padding:0,fontSize:13,lineHeight:1,opacity:0.7}} aria-label={`Remove ${c}`}>×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={e=>{const v=e.target.value;if(v.endsWith(","))commit(v.slice(0,-1));else setDraft(v);}}
        onKeyDown={e=>{
          if(e.key==="Enter"||e.key==="Tab"){if(draft.trim()){e.preventDefault();commit();}}
          else if(e.key==="Backspace"&&!draft&&chips.length>0){onChange(chips.slice(0,-1));}
        }}
        onBlur={()=>{if(draft.trim())commit();}}
        placeholder={chips.length===0?(placeholder||"Type and press Enter..."):""}
        style={{flex:1,minWidth:120,border:"none",outline:"none",background:"transparent",color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)",padding:"4px 2px"}}
      />
    </div>
  </div>);
};

// Migrate an older string-based filter to an array of chips
const chipify=(v)=>{
  if(Array.isArray(v))return v.map(s=>String(s||"").trim()).filter(Boolean);
  const s=String(v||"").trim();
  if(!s)return[];
  return s.includes(",")?s.split(",").map(t=>t.trim()).filter(Boolean):s.split(/\s+/).map(t=>t.trim()).filter(Boolean);
};

const JobFinderAgent=({data,dispatch,user})=>{
  const[jobs,setJobs]=useState(()=>{try{const c=localStorage.getItem(JOB_CACHE_KEY);return c?JSON.parse(c):[];}catch{return[];}});
  const[topPicks,setTopPicks]=useState(()=>{try{const c=localStorage.getItem("rs_job_top_picks");return c?JSON.parse(c):[];}catch{return[];}});
  const[loading,setLoading]=useState(false);
  const[ranking,setRanking]=useState(false);
  const[searchForm,setSearchForm]=useState(()=>{
    const defaults={keywords:["CRM","HubSpot","Salesforce","marketing operations","revenue operations","automation"],location:"",title:[],datePosted:"month"};
    try{
      const s=localStorage.getItem("rs_job_filters");
      if(!s)return defaults;
      const parsed=JSON.parse(s);
      return{
        keywords:chipify(parsed.keywords),
        location:parsed.location||"",
        title:chipify(parsed.title),
        datePosted:parsed.datePosted||"month",
      };
    }catch{return defaults;}
  });
  // Sources to ACTUALLY FETCH from (sent to backend). Independent from the
  // display-exclude list below.
  const[fetchSources,setFetchSources]=useState(()=>{try{const s=localStorage.getItem("rs_job_fetch_sources");return s?JSON.parse(s):["JSearch","Upwork","Remotive","Jobicy","Arbeitnow","The Muse","RemoteOK"];}catch{return["JSearch","Upwork","Remotive","Jobicy","Arbeitnow","The Muse","RemoteOK"];}});
  const toggleFetchSource=(s)=>{const n=fetchSources.includes(s)?fetchSources.filter(x=>x!==s):[...fetchSources,s];setFetchSources(n);try{localStorage.setItem("rs_job_fetch_sources",JSON.stringify(n));}catch{}};
  const[selectedJob,setSelectedJob]=useState(null);
  const[scope,setScope]=useState(null);
  const[asset,setAsset]=useState(null);
  const[branding,setBranding]=useState(null);
  const[scrapeLoad,setScrapeLoad]=useState(false);
  const[approvalStatus,setApprovalStatus]=useState("pending");
  const[schedule,setSchedule]=useState(()=>{try{const s=localStorage.getItem(JOB_SCHEDULE_KEY);return s?JSON.parse(s):null;}catch{return null;}});
  const[showConfig,setShowConfig]=useState(false);
  const[sidebarOpen,setSidebarOpen]=useState(false);
  const[detailPhase,setDetailPhase]=useState("info");
  const[filterPlatform,setFilterPlatform]=useState("all");
  const[apiSources,setApiSources]=useState([]);
  const[hasRapid,setHasRapid]=useState(false);
  const[apiErrors,setApiErrors]=useState([]);
  const[diagnostics,setDiagnostics]=useState([]);
  const[noResultsReason,setNoResultsReason]=useState("");
  const[lastRun,setLastRun]=useState(()=>{try{return localStorage.getItem("rs_job_last_run")||null;}catch{return null;}});
  const[autoRunStatus,setAutoRunStatus]=useState("");
  const autoRanRef=useRef(false);
  const base=window.location.hostname==="localhost"?"https://www.revosys.pro":"";
  const platCol={LinkedIn:"#0A66C2",Indeed:"#2164F3",Glassdoor:"#0CAA41",ZipRecruiter:"#5BA9A0",Upwork:"#14A800",Remotive:"#14A800",Jobicy:"#7C6FA0",Arbeitnow:"#F76707","The Muse":"#E91E63",RemoteOK:"#FF4742","BeBee":"#F5A623","SimplyHired":"#2164F3","Talent.com":"#5BA9A0"};
  const ALL_PLATFORMS=["LinkedIn","Indeed","Glassdoor","ZipRecruiter","Upwork","Remotive","Jobicy","Arbeitnow","The Muse","RemoteOK"];
  const[excludedSources,setExcludedSources]=useState(()=>{try{const s=localStorage.getItem("rs_job_excl_sources");return s?new Set(JSON.parse(s)):new Set();}catch{return new Set();}});
  const[sortBy,setSortBy]=useState("relevance");
  const toggleSource=(p)=>{const n=new Set(excludedSources);n.has(p)?n.delete(p):n.add(p);setExcludedSources(n);try{localStorage.setItem("rs_job_excl_sources",JSON.stringify([...n]));}catch{}};

  // Persist filters whenever they change
  useEffect(()=>{try{localStorage.setItem("rs_job_filters",JSON.stringify(searchForm));}catch{}},[searchForm]);

  // ── Core search function ──
  const searchJobs=async(silent=false)=>{
    setLoading(true);
    if(!silent){setJobs([]);setSidebarOpen(true);}
    setApiErrors([]);
    try{
      const r=await fetch(`${base}/api/search-jobs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({keywords:searchForm.keywords,location:searchForm.location,title:searchForm.title,datePosted:searchForm.datePosted,sources:fetchSources})});
      const d=await r.json();
      const foundJobs=d.jobs||[];
      setJobs(foundJobs);
      setApiSources(d.sources||[]);
      setHasRapid(!!d.hasRapidAPI);
      setApiErrors(d.errors||[]);
      setDiagnostics(d.diagnostics||[]);
      setNoResultsReason(d.noResultsReason||"");
      try{localStorage.setItem(JOB_CACHE_KEY,JSON.stringify(foundJobs));}catch{}
      // Update last run timestamp
      const now=new Date().toISOString();
      setLastRun(now);
      try{localStorage.setItem("rs_job_last_run",now);}catch{}
      // Update schedule nextRun
      if(schedule?.enabled){
        const updated={...schedule,nextRun:getNextRun(schedule.frequency),lastRun:now};
        setSchedule(updated);
        try{localStorage.setItem(JOB_SCHEDULE_KEY,JSON.stringify(updated));}catch{}
      }
      return foundJobs;
    }catch(e){setJobs([]);setApiErrors([{source:"Network",error:e.message}]);return[];}
    finally{setLoading(false);}
  };

  // ── AI ranking: pick top 5 most relevant jobs ──
  const rankJobs=async(jobList)=>{
    if(!jobList||jobList.length<=5){setTopPicks(jobList||[]);try{localStorage.setItem("rs_job_top_picks",JSON.stringify(jobList||[]));}catch{};return;}
    setRanking(true);
    try{
      const summaries=jobList.slice(0,30).map((j,i)=>`${i}: "${j.title}" at ${j.company} (${j.location}) — ${(j.description||"").substring(0,120)}`).join("\n");
      const raw=await callAI(
        `You are helping Revo-Sys (a boutique GTM/RevOps consultancy) find the best consulting/contract engagements.\n\nOur expertise: CRM implementation (HubSpot, Salesforce), revenue operations, GTM strategy, marketing automation, AI-powered operations, data migration, workflow automation.\n\nFrom these ${jobList.length} jobs, pick the TOP 5 most relevant for consulting/contract work. Consider:\n- Relevance to RevOps/CRM/GTM consulting\n- Likelihood of being a contract/consulting engagement\n- Company size and potential deal value\n- Remote-friendliness\n\nJobs:\n${summaries}\n\nReturn ONLY a JSON array of the indices (0-based): [2, 5, 11, 0, 8]`,
        "You are a job-matching AI. Return ONLY a valid JSON array of 5 integers. No explanation."
      );
      try{
        const indices=JSON.parse(raw.replace(/```json?|```/g,"").trim());
        if(Array.isArray(indices)){
          const picks=indices.filter(i=>typeof i==="number"&&i>=0&&i<jobList.length).slice(0,5).map(i=>jobList[i]);
          if(picks.length>0){setTopPicks(picks);try{localStorage.setItem("rs_job_top_picks",JSON.stringify(picks));}catch{};setRanking(false);return;}
        }
      }catch{}
      // Fallback: just take first 5
      const fallback=jobList.slice(0,5);
      setTopPicks(fallback);try{localStorage.setItem("rs_job_top_picks",JSON.stringify(fallback));}catch{}
    }catch{
      const fallback=jobList.slice(0,5);
      setTopPicks(fallback);try{localStorage.setItem("rs_job_top_picks",JSON.stringify(fallback));}catch{}
    }
    setRanking(false);
  };

  // ── Full autonomous pipeline: search → rank → present ──
  // openSidebar: whether to pop the sidebar open after search
  const runAutonomous=async(openSidebar=true)=>{
    setAutoRunStatus("Searching across platforms...");
    const foundJobs=await searchJobs(!openSidebar);
    if(foundJobs.length>0){
      setAutoRunStatus(`Found ${foundJobs.length} jobs. AI ranking top 5...`);
      await rankJobs(foundJobs);
      setAutoRunStatus("");
    }else{
      setAutoRunStatus("No jobs found — try broadening keywords or changing date filter.");
      setTimeout(()=>setAutoRunStatus(""),5000);
    }
  };

  // ── Auto-run on mount if schedule is due ──
  useEffect(()=>{
    if(autoRanRef.current)return;
    autoRanRef.current=true;
    const shouldAutoRun=()=>{
      if(!schedule?.enabled)return false;
      const nextRun=new Date(schedule.nextRun);
      const now=new Date();
      return now>=nextRun;
    };
    if(shouldAutoRun()){
      // Schedule is due — run autonomously, results on dashboard (no sidebar popup)
      runAutonomous(false);
    }else if(jobs.length===0&&!lastRun){
      // First ever visit — run initial search quietly
      runAutonomous(false);
    }
  },[]);// eslint-disable-line

  // Scrape company website for branding
  const scrapeCompany=async(url)=>{
    setScrapeLoad(true);setBranding(null);
    try{
      const r=await fetch(`${base}/api/scrape-url`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
      const d=await r.json();setBranding(d);
    }catch(e){setBranding({error:e.message});}
    setScrapeLoad(false);
  };

  // AUTO-scrape branding whenever a job is selected (Pomelli-style: pick up
  // the client's visual identity before we personalize anything).
  useEffect(()=>{
    if(!selectedJob)return;
    const tryUrl=selectedJob.companyWebsite
      ||(selectedJob.companyLogo?(()=>{try{const u=new URL(selectedJob.companyLogo);return `${u.protocol}//${u.hostname}`;}catch{return null;}})():null);
    if(tryUrl&&!branding)scrapeCompany(tryUrl);
  },[selectedJob?.id]);// eslint-disable-line

  // Pull the dominant brand colors we'll thread through scope/asset UI
  const brandColor=branding?.brand?.primary||branding?.brand?.themeColor||"var(--amber)";
  const brandAccent=branding?.brand?.accent||branding?.brand?.primary||"var(--violet)";

  // Generate scope for selected job
  const generateScope=async(job)=>{
    setLoading(true);setScope(null);setDetailPhase("scope");
    const palette=branding?.brand?`\nBrand palette: primary ${branding.brand.primary||"unknown"}, accent ${branding.brand.accent||"unknown"}, full palette [${(branding.brand.palette||[]).join(", ")}]`:"";
    const brandCtx=branding?`\n\nCompany branding/website info:\nTitle: ${branding.title}\nDescription: ${branding.description}${palette}\nContent excerpt: ${branding.text?.substring(0,800)}`:"";
    const raw=await callAI(`Create a tailored project scope/proposal for this job, written in the consultancy's voice (we, our). Reference the client's own language, positioning, and any visual brand cues where it feels natural:\n\nJob: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description}\nTags: ${(job.tags||[]).join(", ")}\nSalary: ${job.salary}${brandCtx}\n\nReturn ONLY valid JSON: {"title":"scope title","executive_summary":"2-3 sentences tailored to this company in our voice","sections":[{"title":"section","content":"detailed content"}],"timeline":"proposed timeline","investment":"proposed rate/budget","differentiators":["why Revo-Sys is the best fit"]}`,"You are Revo-Sys, a boutique GTM/RevOps consultancy. Write in the first-person plural (we, our). Return only valid JSON.");
    try{const p=JSON.parse(raw.replace(/```json?|```/g,"").trim());setScope(p);}
    catch{setScope({title:"Tailored Scope",executive_summary:raw,sections:[{title:"Overview",content:raw}],timeline:"TBD",investment:"TBD",differentiators:["Deep RevOps expertise"]});}
    setLoading(false);
  };

  // Generate work asset
  const generateAsset=async(job)=>{
    setLoading(true);setAsset(null);setDetailPhase("asset");
    const palette=branding?.brand?`\nClient brand palette: ${branding.brand.primary||"?"} (primary), ${branding.brand.accent||"?"} (accent). Subtly reference visual/brand alignment in the relevance field.`:"";
    const raw=await callAI(`Create a case study demonstrating Revo-Sys expertise relevant to this job:\n\nJob: ${job.title} at ${job.company}\nDescription: ${job.description}\nTags: ${(job.tags||[]).join(", ")}${palette}\n\nReturn ONLY valid JSON: {"title":"case study title","subtitle":"one line","client_type":"anonymized","challenge":"problem","approach":[{"phase":"Phase 1","title":"step","detail":"what was done"}],"results":[{"metric":"40%","label":"improvement"}],"technologies":["tech1"],"testimonial":"quote","relevance":"why this matters for the target job"}`,"You are Revo-Sys, creating a portfolio case study written in first-person plural (we, our). Return only valid JSON.");
    try{const p=JSON.parse(raw.replace(/```json?|```/g,"").trim());setAsset(p);}
    catch{setAsset({title:"Case Study",subtitle:raw,client_type:"B2B SaaS",challenge:raw,approach:[{phase:"Phase 1",title:"Discovery",detail:raw}],results:[{metric:"40%",label:"efficiency gain"}],technologies:["HubSpot"],testimonial:"Excellent work.",relevance:"Directly relevant."});}
    setLoading(false);
  };

  // Schedule management
  const saveSchedule=(freq)=>{
    const s={frequency:freq,createdAt:new Date().toISOString(),nextRun:getNextRun(freq),enabled:true,lastRun:lastRun};
    setSchedule(s);
    try{localStorage.setItem(JOB_SCHEDULE_KEY,JSON.stringify(s));}catch{}
  };
  const clearSchedule=()=>{setSchedule(null);try{localStorage.removeItem(JOB_SCHEDULE_KEY);}catch{}};
  const getNextRun=(freq)=>{const now=new Date();if(freq==="daily")now.setDate(now.getDate()+1);else if(freq==="weekly")now.setDate(now.getDate()+7);else if(freq==="biweekly")now.setDate(now.getDate()+14);else now.setMonth(now.getMonth()+1);now.setHours(9,0,0,0);return now.toISOString();};

  const platforms=[...new Set(jobs.map(j=>j.platform))];
  const platformCounts=ALL_PLATFORMS.reduce((m,p)=>{m[p]=jobs.filter(j=>j.platform===p).length;return m;},{});
  const sortFn=(a,b)=>{if(sortBy==="newest"){const da=new Date(a.postedAt||0).getTime();const db=new Date(b.postedAt||0).getTime();return db-da;}if(sortBy==="company")return(a.company||"").localeCompare(b.company||"");return 0;};
  const filtered=jobs.filter(j=>!excludedSources.has(j.platform)&&(filterPlatform==="all"||j.platform===filterPlatform)).slice().sort(sortFn);
  const closeDetail=()=>{setSelectedJob(null);setScope(null);setAsset(null);setBranding(null);setApprovalStatus("pending");setDetailPhase("info");};

  // ═══════════════════════════════════════════════════════
  // CLAY-STYLE LAYOUT: sticky left filters | inline results
  // ═══════════════════════════════════════════════════════
  return(<div style={{display:"flex",height:"calc(100vh - 140px)",animation:"fadeUp .3s ease-out",overflow:"hidden",position:"relative"}}>
    {/* ── LEFT SIDEBAR: Persistent filter panel ── */}
    <aside style={{width:272,flexShrink:0,background:"var(--ink-2)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <div style={{padding:"18px 18px 14px",borderBottom:"1px solid var(--border)"}}>
        <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",letterSpacing:"0.14em",marginBottom:3}}>JOB SEARCH</div>
        <div style={{fontSize:11,color:"var(--cream-dim)"}}>{lastRun?`Scanned ${new Date(lastRun).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})} at ${new Date(lastRun).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:schedule?.enabled?"Scheduled run active":"Not yet run"}</div>
        {autoRunStatus&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}><div style={{width:8,height:8,border:"1.5px solid var(--success)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/><span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--success)"}}>{autoRunStatus}</span></div>}
      </div>

      <div style={{padding:"16px 18px",flex:1,display:"flex",flexDirection:"column",gap:16,overflowY:"auto"}}>

        {/* Keywords */}
        <ChipInput label="KEYWORDS" chips={searchForm.keywords} onChange={v=>setSearchForm({...searchForm,keywords:v})} placeholder="HubSpot, then Enter…" accent="var(--success)"/>

        {/* Location */}
        <div>
          <label style={{fontFamily:"var(--mono)",fontSize:9,letterSpacing:"0.12em",color:"var(--cream-mute)",display:"block",marginBottom:6}}>LOCATION</label>
          <input value={searchForm.location} onChange={e=>setSearchForm({...searchForm,location:e.target.value})} placeholder="Remote · Canada · New York…" style={{width:"100%",padding:"8px 10px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:7,color:"var(--cream)",fontSize:12,fontFamily:"var(--sans)",boxSizing:"border-box"}}/>
        </div>

        {/* Title filter */}
        <ChipInput label="TITLE FILTER (any match)" chips={searchForm.title} onChange={v=>setSearchForm({...searchForm,title:v})} placeholder="consultant…" accent="var(--amber)"/>

        {/* Date */}
        <div>
          <label style={{fontFamily:"var(--mono)",fontSize:9,letterSpacing:"0.12em",color:"var(--cream-mute)",display:"block",marginBottom:6}}>DATE POSTED</label>
          <select value={searchForm.datePosted} onChange={e=>setSearchForm({...searchForm,datePosted:e.target.value})} style={{width:"100%",padding:"8px 10px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:7,color:"var(--cream)",fontSize:12,fontFamily:"var(--sans)"}}>
            <option value="today">Today</option><option value="3days">Last 3 days</option><option value="week">Last week</option><option value="month">Last month</option><option value="all">All time</option>
          </select>
        </div>

        {/* Fetch Sources */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",letterSpacing:"0.12em"}}>SOURCES</span>
            <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--sky)",cursor:"pointer"}} onClick={()=>{const a=["JSearch","Upwork","Remotive","Jobicy","Arbeitnow","The Muse","RemoteOK"];setFetchSources(a);try{localStorage.setItem("rs_job_fetch_sources",JSON.stringify(a));}catch{}}}>All</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {[{k:"JSearch",label:"LinkedIn · Indeed · Glassdoor",c:"#0A66C2"},{k:"Upwork",label:"Upwork",c:"#14A800"},{k:"Remotive",label:"Remotive",c:"#14A800"},{k:"Jobicy",label:"Jobicy",c:"#7C6FA0"},{k:"Arbeitnow",label:"Arbeitnow",c:"#F76707"},{k:"The Muse",label:"The Muse",c:"#E91E63"},{k:"RemoteOK",label:"RemoteOK",c:"#FF4742"}].map(s=>{
              const on=fetchSources.includes(s.k);
              const cnt=platformCounts[s.k]||0;
              return(<label key={s.k} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 6px",borderRadius:5,background:on?`${s.c}10`:"transparent",cursor:"pointer"}}>
                <input type="checkbox" checked={on} onChange={()=>toggleFetchSource(s.k)} style={{accentColor:s.c,flexShrink:0}}/>
                <span style={{flex:1,fontFamily:"var(--mono)",fontSize:10,color:on?s.c:"var(--cream-mute)"}}>{s.label}</span>
                {cnt>0&&<span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",background:"var(--ink)",padding:"0 5px",borderRadius:10,lineHeight:"18px"}}>{cnt}</span>}
              </label>);
            })}
          </div>
          {!hasRapid&&<p style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--danger)",margin:"6px 0 0",lineHeight:1.5}}>Add RevoSys_RapidAPI to unlock LinkedIn/Indeed/Glassdoor</p>}
        </div>

        {/* Schedule */}
        <div style={{paddingTop:12,borderTop:"1px solid var(--border)"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",letterSpacing:"0.12em",marginBottom:8}}>AUTO-RUN SCHEDULE</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {["daily","weekly","biweekly","monthly"].map(f=>(
              <button key={f} onClick={()=>saveSchedule(f)} style={{padding:"5px 0",borderRadius:5,background:schedule?.frequency===f&&schedule?.enabled?"rgba(107,158,111,0.12)":"var(--ink)",border:`1px solid ${schedule?.frequency===f&&schedule?.enabled?"rgba(107,158,111,0.3)":"var(--border)"}`,color:schedule?.frequency===f&&schedule?.enabled?"var(--success)":"var(--cream-mute)",fontSize:10,fontFamily:"var(--mono)",cursor:"pointer",textTransform:"capitalize"}}>{f}</button>
            ))}
          </div>
          {schedule?.enabled&&<div style={{marginTop:6}}>
            <p style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--success)",margin:"0 0 2px"}}>Next: {new Date(schedule.nextRun).toLocaleString()}</p>
            <button onClick={clearSchedule} style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--danger)",background:"none",border:"none",cursor:"pointer",padding:0}}>Disable</button>
          </div>}
        </div>

        {/* Diagnostics */}
        {diagnostics.length>0&&<div style={{paddingTop:12,borderTop:"1px solid var(--border)"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",letterSpacing:"0.12em",marginBottom:6}}>LAST RUN RESULTS</div>
          {diagnostics.map((d,i)=>(
            <div key={i} title={`dropped: ${d.dropped_location} loc · ${d.dropped_title} title · ${d.dropped_date} date`} style={{display:"flex",justifyContent:"space-between",marginBottom:3,cursor:"help"}}>
              <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)"}}>{d.source}</span>
              <span style={{fontFamily:"var(--mono)",fontSize:9,color:d.kept>0?"var(--success)":"var(--cream-mute)"}}>{d.kept}/{d.raw}</span>
            </div>
          ))}
          {noResultsReason&&<p style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--amber)",margin:"4px 0 0",lineHeight:1.5}}>{noResultsReason}</p>}
          {apiErrors.length>0&&apiErrors.map((e,i)=><p key={i} style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--danger)",margin:"2px 0 0"}}>{e.source}: {e.error}</p>)}
        </div>}
      </div>

      {/* Search button */}
      <div style={{padding:"14px 18px",borderTop:"1px solid var(--border)",flexShrink:0}}>
        <button onClick={()=>runAutonomous(true)} disabled={loading||ranking} style={{width:"100%",padding:"11px 0",borderRadius:8,background:loading||ranking?"rgba(107,158,111,0.06)":"rgba(107,158,111,0.12)",border:"1px solid rgba(107,158,111,0.3)",color:loading||ranking?"var(--cream-mute)":"var(--success)",fontSize:12,fontFamily:"var(--mono)",cursor:loading||ranking?"not-allowed":"pointer",letterSpacing:"0.08em",transition:"all .15s"}}>
          {loading?"◌  Scanning…":ranking?"◌  AI Ranking…":"⌕  Search Jobs"}
        </button>
      </div>
    </aside>

    {/* ── MAIN AREA ── */}
    <main style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",minWidth:0}}>

      {/* ── AI TOP PICKS strip ── */}
      <section style={{padding:"18px 24px 0",borderBottom:"1px solid var(--border)",paddingBottom:18,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--success)",letterSpacing:"0.14em"}}>✦ AI TOP PICKS</span>
            <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)"}}>{lastRun?`· ${new Date(lastRun).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})} ${new Date(lastRun).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:""}{schedule?.enabled?` · auto ${schedule.frequency}`:""}</span>
          </div>
          {topPicks.length>0&&!ranking&&jobs.length>0&&<button onClick={()=>rankJobs(filtered.length?filtered:jobs)} style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",background:"none",border:"1px solid var(--border)",borderRadius:4,padding:"3px 8px",cursor:"pointer"}}>Re-rank</button>}
        </div>

        {(ranking||(loading&&topPicks.length===0))?
          <div style={{display:"flex",gap:10}}>{[0,1,2,3,4].map(i=>(<div key={i} style={{minWidth:200,height:108,borderRadius:10,background:"var(--ink-2)",border:"1px solid var(--border)",opacity:0.5+i*0.05}}/>))}</div>
        :topPicks.length>0?
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
            {topPicks.map((job,idx)=>(
              <div key={job.id} onClick={()=>{setSelectedJob(job);setDetailPhase("info");setScope(null);setAsset(null);setBranding(null);setApprovalStatus("pending");}} style={{minWidth:200,maxWidth:216,padding:"12px 14px",background:selectedJob?.id===job.id?"rgba(107,158,111,0.08)":"var(--ink-2)",borderRadius:10,border:`1px solid ${selectedJob?.id===job.id?"rgba(107,158,111,0.45)":"var(--border)"}`,cursor:"pointer",transition:"all .15s",flexShrink:0}} onMouseEnter={e=>{if(selectedJob?.id!==job.id)e.currentTarget.style.borderColor="rgba(107,158,111,0.3)";}} onMouseLeave={e=>{if(selectedJob?.id!==job.id)e.currentTarget.style.borderColor="var(--border)";}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:8,color:platCol[job.platform]||"var(--cream-mute)",padding:"2px 6px",borderRadius:3,background:`${platCol[job.platform]||"#888"}15`}}>{job.platform}</span>
                  <span style={{fontFamily:"var(--serif)",fontSize:12,fontStyle:"italic",color:"var(--success)",lineHeight:1}}>{idx+1}</span>
                </div>
                <div style={{fontSize:12,color:"var(--cream)",fontWeight:500,lineHeight:1.4,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{job.title}</div>
                <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--amber)",marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.company}</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {job.salary&&job.salary!=="Not listed"&&<span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--success)",flex:1}}>{job.salary}</span>}
                  <button onClick={e=>{e.stopPropagation();const u=job.applyUrl||job.url;if(u)window.open(u,"_blank","noopener,noreferrer");}} style={{padding:"4px 8px",borderRadius:4,background:"rgba(107,158,111,0.1)",border:"1px solid rgba(107,158,111,0.2)",color:"var(--success)",fontSize:9,fontFamily:"var(--mono)",cursor:"pointer",whiteSpace:"nowrap"}}>Apply →</button>
                </div>
              </div>
            ))}
          </div>
        :!loading&&<div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)",padding:"8px 0"}}>No picks yet — run a search to get AI-ranked suggestions.</div>
        }
      </section>

      {/* ── ALL RESULTS table ── */}
      <section style={{flex:1,padding:"0 24px 24px",minHeight:0}}>
        {/* Table header */}
        <div style={{display:"grid",gridTemplateColumns:"3fr 1.4fr 1fr 1fr 80px",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"var(--ink-2)",zIndex:2}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",letterSpacing:"0.1em"}}>ROLE</span>
            <span style={{fontFamily:"var(--mono)",fontSize:9,color:loading||ranking?"var(--amber)":"var(--cream-dim)",fontWeight:500}}>{loading||ranking?"":`${filtered.length} results`}</span>
            {apiSources.length>0&&<span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--cream-mute)"}}>from {apiSources.join(" · ")}</span>}
          </div>
          <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",letterSpacing:"0.1em"}}>COMPANY</span>
          <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",letterSpacing:"0.1em"}}>LOCATION</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"3px 6px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:4,color:"var(--cream)",fontSize:9,fontFamily:"var(--mono)"}}>
              <option value="relevance">Relevance</option><option value="newest">Newest</option><option value="company">A-Z</option>
            </select>
          </div>
          <select value={filterPlatform} onChange={e=>setFilterPlatform(e.target.value)} style={{padding:"3px 6px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:4,color:"var(--cream)",fontSize:9,fontFamily:"var(--mono)"}}>
            <option value="all">All</option>{platforms.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Rows */}
        {loading?
          <div>{[0,1,2,3,4,5,6].map(i=>(<div key={i} style={{height:60,borderBottom:"1px solid var(--border)",opacity:0.4+(i*0.04),background:i%2===0?"var(--ink-2)":"transparent"}}/>))}</div>
        :filtered.length===0&&jobs.length===0?
          <div style={{padding:"64px 0",textAlign:"center"}}>
            <div style={{fontFamily:"var(--serif)",fontSize:22,fontStyle:"italic",color:"var(--cream-mute)",marginBottom:12}}>No results yet</div>
            <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)",marginBottom:20}}>Add keywords and click Search Jobs to begin</div>
            <button onClick={()=>runAutonomous(true)} style={{padding:"10px 20px",borderRadius:8,background:"rgba(107,158,111,0.1)",border:"1px solid rgba(107,158,111,0.3)",color:"var(--success)",fontSize:12,fontFamily:"var(--mono)",cursor:"pointer"}}>Run search →</button>
          </div>
        :filtered.length===0?
          <div style={{padding:"40px 0",textAlign:"center",fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)"}}>No results match current filters. Try adjusting keywords or sources.</div>
        :filtered.map((job,i)=>{
          const isSel=selectedJob?.id===job.id;
          return(
            <div key={job.id} onClick={()=>{setSelectedJob(job);setDetailPhase("info");setScope(null);setAsset(null);setBranding(null);setApprovalStatus("pending");}} style={{display:"grid",gridTemplateColumns:"3fr 1.4fr 1fr 1fr 80px",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid var(--border)",cursor:"pointer",borderLeft:isSel?"2px solid var(--success)":"2px solid transparent",paddingLeft:isSel?8:0,background:isSel?"rgba(107,158,111,0.04)":i%2===0?"transparent":"rgba(255,255,255,0.01)",transition:"all .1s"}} onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.03)";}} onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,0.01)";}}>
              <div style={{minWidth:0}}>
                <div style={{display:"flex",gap:5,marginBottom:3,alignItems:"center"}}>
                  <span style={{fontFamily:"var(--mono)",fontSize:8,color:platCol[job.platform]||"var(--cream-mute)",padding:"1px 5px",borderRadius:2,background:`${platCol[job.platform]||"#888"}18`,whiteSpace:"nowrap"}}>{job.platform}</span>
                  {job.type&&job.type!=="Not listed"&&<span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--cream-mute)",opacity:0.7}}>{job.type}</span>}
                </div>
                <div style={{fontSize:13,color:isSel?"var(--cream)":"var(--cream-dim)",fontWeight:isSel?500:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.title}</div>
              </div>
              <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--amber)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.company}</div>
              <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.location}</div>
              <div style={{fontFamily:"var(--mono)",fontSize:10,color:job.salary&&job.salary!=="Not listed"?"var(--success)":"var(--cream-mute)",whiteSpace:"nowrap"}}>{job.salary&&job.salary!=="Not listed"?job.salary:job.posted}</div>
              <button onClick={e=>{e.stopPropagation();const u=job.applyUrl||job.url;if(u)window.open(u,"_blank","noopener,noreferrer");}} style={{padding:"5px 10px",borderRadius:5,background:"rgba(107,158,111,0.08)",border:"1px solid rgba(107,158,111,0.2)",color:"var(--success)",fontSize:10,fontFamily:"var(--mono)",cursor:"pointer"}}>Apply</button>
            </div>
          );
        })}
      </section>
    </main>

    {/* ── DETAIL PANEL: fixed right overlay ── */}
    {selectedJob&&<>
      <div onClick={closeDetail} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:998}}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:490,background:"var(--ink)",borderLeft:"1px solid var(--border)",zIndex:999,display:"flex",flexDirection:"column",animation:"slideIn .2s ease-out"}}>
        {/* Header */}
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:5,marginBottom:6}}>
                <span style={{fontFamily:"var(--mono)",fontSize:8,color:platCol[selectedJob.platform]||"var(--cream-mute)",padding:"2px 7px",borderRadius:3,background:`${platCol[selectedJob.platform]||"#888"}15`}}>{selectedJob.platform}</span>
                <span style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--cream-mute)",padding:"2px 7px",borderRadius:3,background:"var(--ink-2)"}}>{selectedJob.posted}</span>
              </div>
              <h2 style={{fontFamily:"var(--serif)",fontSize:19,fontStyle:"italic",color:"var(--cream)",fontWeight:400,margin:"0 0 4px",lineHeight:1.3}}>{selectedJob.title}</h2>
              <p style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--amber)",margin:0}}>{selectedJob.company} · {selectedJob.location}</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
              {selectedJob.companyLogo&&<img src={selectedJob.companyLogo} alt="" style={{width:38,height:38,borderRadius:7,border:"1px solid var(--border)",objectFit:"contain",background:"#fff"}} onError={e=>e.target.style.display="none"}/>}
              <button onClick={closeDetail} style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",background:"none",border:"1px solid var(--border)",borderRadius:4,padding:"3px 8px",cursor:"pointer"}}>✕ close</button>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid var(--border)",flexShrink:0}}>
          {[{k:"info",l:"Details"},{k:"scope",l:"Scope",d:!scope},{k:"asset",l:"Asset",d:!asset},{k:"approve",l:"Apply",d:!scope||!asset}].map(t=>(
            <button key={t.k} onClick={()=>!t.d&&setDetailPhase(t.k)} style={{flex:1,padding:"9px 4px",background:"none",border:"none",borderBottom:detailPhase===t.k?"2px solid var(--cream)":"2px solid transparent",color:t.d?"var(--ink-4)":detailPhase===t.k?"var(--cream)":"var(--cream-mute)",fontSize:11,cursor:t.d?"default":"pointer",fontFamily:"var(--mono)",opacity:t.d?0.3:1,letterSpacing:"0.05em"}}>{t.l}</button>
          ))}
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 22px"}}>
          {detailPhase==="info"&&<div>
            <div style={{fontSize:13,color:"var(--cream-dim)",lineHeight:1.8,marginBottom:16,whiteSpace:"pre-wrap"}}>{selectedJob.description}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {[["Salary",selectedJob.salary],["Type",selectedJob.type],["Location",selectedJob.location],["Source",selectedJob.source]].map(([l,v])=>(<div key={l} style={{padding:"9px 11px",background:"var(--ink-2)",borderRadius:6}}><div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--cream-mute)",letterSpacing:"0.1em",marginBottom:2}}>{l}</div><div style={{fontSize:11,color:"var(--cream-dim)"}}>{v||"—"}</div></div>))}
            </div>
            {selectedJob.tags?.length>0&&<div style={{marginBottom:14}}><div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--cream-mute)",letterSpacing:"0.1em",marginBottom:5}}>TAGS</div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{selectedJob.tags.map((t,i)=><span key={i} style={{padding:"3px 8px",borderRadius:4,background:"var(--ink-2)",border:"1px solid var(--border)",fontSize:11,color:"var(--cream-dim)"}}>{t}</span>)}</div></div>}
            {(selectedJob.companyWebsite||branding)&&<div style={{padding:11,background:"var(--ink-2)",borderRadius:7,border:"1px solid var(--border)",marginBottom:14}}>
              <div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--cream-mute)",letterSpacing:"0.1em",marginBottom:5}}>COMPANY BRANDING {scrapeLoad&&<span style={{color:"var(--amber)"}}>— scraping…</span>}</div>
              {selectedJob.companyWebsite&&<a href={selectedJob.companyWebsite} target="_blank" rel="noopener" style={{fontSize:11,color:"var(--sky)",textDecoration:"none",display:"block",marginBottom:6}}>{selectedJob.companyWebsite}</a>}
              {branding&&!branding.error&&<div>
                <div style={{fontSize:11,color:"var(--cream-mute)",marginBottom:6}}><span style={{color:"var(--success)"}}>✓ </span>{(branding.title||branding.ogTitle||"").substring(0,60)} — {(branding.description||branding.ogDesc||"").substring(0,100)}</div>
                {branding.brand?.palette?.length>0&&<div style={{display:"flex",gap:5,alignItems:"center"}}>
                  {branding.brand.palette.slice(0,5).map((c,i)=>(<div key={i} title={c} style={{width:15,height:15,borderRadius:3,background:c,border:"1px solid var(--border)"}}/>))}
                  {branding.brand.logo&&<img src={branding.brand.logo} alt="" style={{marginLeft:"auto",width:20,height:20,borderRadius:3,objectFit:"contain",background:"#fff"}} onError={e=>e.target.style.display="none"}/>}
                </div>}
              </div>}
            </div>}
            <div style={{display:"flex",gap:8}}>
              <Btn v="ai" icon="doc" onClick={()=>generateScope(selectedJob)} disabled={loading}>Generate Scope</Btn>
              <Btn v="secondary" onClick={()=>window.open(selectedJob.applyUrl||selectedJob.url,"_blank")}>View Listing</Btn>
            </div>
          </div>}

          {detailPhase==="scope"&&<div>
            {loading?<div style={{padding:40,textAlign:"center"}}><div style={{width:18,height:18,border:"2px solid var(--border)",borderTopColor:"var(--amber)",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block",marginBottom:10}}/><p style={{color:"var(--cream-mute)",fontSize:12}}>Generating scope for {selectedJob.company}…</p></div>
            :scope?<div style={{animation:"fadeUp .3s ease-out"}}>
              {branding?.brand?.primary&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",marginBottom:10,background:`${brandColor}10`,border:`1px solid ${brandColor}30`,borderRadius:6}}>
                {branding.brand.logo&&<img src={branding.brand.logo} alt="" style={{width:18,height:18,borderRadius:3,objectFit:"contain",background:"#fff"}} onError={e=>e.target.style.display="none"}/>}
                <span style={{fontFamily:"var(--mono)",fontSize:8,color:brandColor}}>BRAND ALIGNED — {selectedJob.company}</span>
                <div style={{display:"flex",gap:3,marginLeft:"auto"}}>{(branding.brand.palette||[]).slice(0,4).map((c,i)=>(<div key={i} style={{width:11,height:11,borderRadius:2,background:c}}/>))}</div>
              </div>}
              <div style={{fontFamily:"var(--mono)",fontSize:8,color:brandColor,letterSpacing:"0.1em",marginBottom:5}}>TAILORED SCOPE</div>
              <h3 style={{fontSize:15,color:"var(--cream)",fontWeight:500,margin:"0 0 5px"}}>{scope.title}</h3>
              <p style={{fontSize:12,color:"var(--cream-dim)",lineHeight:1.7,marginBottom:12}}>{scope.executive_summary}</p>
              {scope.sections?.map((s,i)=>(<div key={i} style={{padding:"9px 11px",marginBottom:4,background:"var(--ink-2)",borderRadius:6,borderLeft:`2px solid ${brandColor}`}}><div style={{fontFamily:"var(--mono)",fontSize:8,color:brandColor,marginBottom:3}}>{s.title}</div><p style={{fontSize:11,color:"var(--cream-mute)",lineHeight:1.6,margin:0}}>{s.content}</p></div>))}
              <div style={{display:"flex",gap:14,marginTop:10,fontSize:11}}>
                <span><span style={{color:"var(--cream-mute)"}}>Investment: </span><span style={{color:"var(--success)"}}>{scope.investment}</span></span>
                <span><span style={{color:"var(--cream-mute)"}}>Timeline: </span><span style={{color:brandColor}}>{scope.timeline}</span></span>
              </div>
              <div style={{display:"flex",gap:6,marginTop:12}}>
                <Btn v="ai" icon="star" onClick={()=>generateAsset(selectedJob)} size="sm">Create Asset</Btn>
                <Btn v="secondary" size="sm" onClick={()=>{setScope(null);generateScope(selectedJob);}}>Regenerate</Btn>
                <Btn v="secondary" size="sm" onClick={()=>navigator.clipboard?.writeText(JSON.stringify(scope,null,2))}>Copy</Btn>
              </div>
            </div>:null}
          </div>}

          {detailPhase==="asset"&&<div>
            {loading?<div style={{padding:40,textAlign:"center"}}><div style={{width:18,height:18,border:"2px solid var(--border)",borderTopColor:"var(--violet)",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block",marginBottom:10}}/><p style={{color:"var(--cream-mute)",fontSize:12}}>Creating case study…</p></div>
            :asset?<div style={{animation:"fadeUp .3s ease-out"}}>
              {branding?.brand?.primary&&<div style={{padding:"7px 10px",marginBottom:10,background:`${brandAccent}10`,border:`1px solid ${brandAccent}30`,borderRadius:6}}>
                <span style={{fontFamily:"var(--mono)",fontSize:8,color:brandAccent}}>STYLED FOR {selectedJob.company.toUpperCase()}</span>
              </div>}
              <div style={{fontFamily:"var(--mono)",fontSize:8,color:brandAccent,letterSpacing:"0.1em",marginBottom:5}}>CASE STUDY</div>
              <h3 style={{fontSize:15,color:"var(--cream)",fontWeight:500,margin:"0 0 3px"}}>{asset.title}</h3>
              <p style={{fontSize:11,color:brandAccent,margin:"0 0 10px"}}>{asset.subtitle} · {asset.client_type}</p>
              <div style={{padding:10,background:"var(--ink-2)",borderRadius:6,marginBottom:8}}><div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--danger)",marginBottom:3}}>CHALLENGE</div><p style={{fontSize:11,color:"var(--cream-dim)",lineHeight:1.6,margin:0}}>{asset.challenge}</p></div>
              {asset.approach?.map((p,i)=>(<div key={i} style={{display:"flex",gap:8,marginBottom:7}}><div style={{width:20,height:20,borderRadius:4,background:`${brandAccent}15`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--mono)",fontSize:8,color:brandAccent,flexShrink:0}}>{i+1}</div><div><div style={{fontSize:12,color:"var(--cream)",fontWeight:500}}>{p.title}</div><p style={{fontSize:11,color:"var(--cream-mute)",lineHeight:1.5,margin:0}}>{p.detail}</p></div></div>))}
              <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(asset.results?.length||1,3)},1fr)`,gap:6,marginTop:8}}>
                {asset.results?.map((r,i)=>(<div key={i} style={{textAlign:"center",padding:8,background:"var(--ink-2)",borderRadius:5}}><div style={{fontFamily:"var(--serif)",fontSize:17,fontStyle:"italic",color:"var(--success)"}}>{r.metric}</div><div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--cream-mute)"}}>{r.label}</div></div>))}
              </div>
              {asset.testimonial&&<div style={{marginTop:8,padding:8,background:"var(--ink-2)",borderRadius:5,borderLeft:`2px solid ${brandColor}`}}><p style={{fontSize:11,color:"var(--cream-dim)",fontStyle:"italic",margin:0}}>"{asset.testimonial}"</p></div>}
              <div style={{display:"flex",gap:6,marginTop:12}}>
                <Btn icon="check" onClick={()=>setDetailPhase("approve")} size="sm">Submit for Approval</Btn>
                <Btn v="secondary" size="sm" onClick={()=>{setAsset(null);generateAsset(selectedJob);}}>Regenerate</Btn>
              </div>
            </div>:null}
          </div>}

          {detailPhase==="approve"&&<div>
            {approvalStatus==="pending"&&<div style={{animation:"fadeUp .3s ease-out"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{width:34,height:34,borderRadius:8,background:"rgba(196,162,101,0.1)",border:"1px solid rgba(196,162,101,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:12,fontStyle:"italic",color:"var(--amber)"}}>SB</div>
                <div><div style={{fontSize:13,color:"var(--cream)",fontWeight:500}}>Approval Required</div><p style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",margin:0}}>Sahil Bahri · Founder, Revo-Sys</p></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                <div style={{padding:10,background:"var(--ink-2)",borderRadius:6}}><div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--amber)",marginBottom:3}}>SCOPE</div><div style={{fontSize:11,color:"var(--cream-dim)"}}>{scope?.title||"Not generated"}</div></div>
                <div style={{padding:10,background:"var(--ink-2)",borderRadius:6}}><div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--violet)",marginBottom:3}}>ASSET</div><div style={{fontSize:11,color:"var(--cream-dim)"}}>{asset?.title||"Not generated"}</div></div>
              </div>
              <div style={{display:"flex",gap:8,flexDirection:"column"}}>
                <Btn onClick={()=>{const u=selectedJob.applyUrl||selectedJob.url;if(u){const w=window.open(u,"_blank","noopener,noreferrer");if(!w)alert("Pop-up blocked — please allow pop-ups.");}setApprovalStatus("approved");try{const k="rs_job_applications";const p=JSON.parse(localStorage.getItem(k)||"[]");p.unshift({jobId:selectedJob.id,title:selectedJob.title,company:selectedJob.company,url:u,platform:selectedJob.platform,appliedAt:new Date().toISOString(),scope:scope?.title,asset:asset?.title});localStorage.setItem(k,JSON.stringify(p.slice(0,200)));}catch{}}}>Approve & Open Application →</Btn>
                <Btn v="danger" onClick={()=>{setApprovalStatus("rejected");setDetailPhase("info");}}>Reject</Btn>
              </div>
              <p style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--cream-mute)",margin:"10px 0 0",lineHeight:1.5}}>Opens the listing in a new tab for direct application. Use your generated scope & asset as reference.</p>
            </div>}
            {approvalStatus==="approved"&&<div style={{textAlign:"center",padding:"32px 0",animation:"fadeUp .3s ease-out"}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(107,158,111,0.12)",border:"2px solid rgba(107,158,111,0.3)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:10}}><Icon name="check" size={20}/></div>
              <p style={{fontFamily:"var(--serif)",fontSize:17,fontStyle:"italic",color:"var(--success)",margin:"0 0 4px"}}>Application Sent</p>
              <p style={{fontSize:12,color:"var(--cream-mute)",margin:"0 0 14px"}}>{selectedJob.title} at {selectedJob.company}</p>
              <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                <Btn v="secondary" size="sm" onClick={()=>window.open(selectedJob.applyUrl||selectedJob.url,"_blank")}>View Listing</Btn>
                <Btn v="secondary" size="sm" onClick={closeDetail}>Back to Results</Btn>
              </div>
            </div>}
          </div>}
        </div>
      </div>
    </>}
  </div>);
};

const JobsPage=({data,dispatch,user})=>(
  <div style={{margin:"0 -48px",marginTop:-36}}>
    <div style={{padding:"28px 48px 16px",borderBottom:"1px solid var(--border)",background:"var(--ink-2)"}}>
      <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--cream-mute)",letterSpacing:"0.2em",textTransform:"uppercase"}}>Intelligence</span>
      <h1 style={{fontFamily:"var(--serif)",fontSize:30,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginTop:6,marginBottom:4}}>Job Finder</h1>
      <p style={{fontSize:13,color:"var(--cream-mute)",lineHeight:1.6,margin:0}}>Daily autonomous scan across Upwork, LinkedIn, Indeed, Glassdoor, Remotive and more — AI-ranked top picks with brand-aligned scope &amp; asset generation, ready to apply.</p>
    </div>
    <JobFinderAgent data={data} dispatch={dispatch} user={user}/>
  </div>
);

const AgentsPage=({data,dispatch,user})=>{
  const[activeAgent,setActiveAgent]=useState(null);
  const agents=[
    {id:"scope",title:"Scope Builder",desc:"Guided conversation to build detailed project scopes — asks about requirements, stakeholders, timeline, then generates a complete scope document.",icon:"doc",color:"var(--amber)",tag:"SCOPE AUTOMATION",capabilities:["Guided Discovery","4-6 Sections","Rate Estimation"]},
    {id:"prospect",title:"Prospecting Agent",desc:"Analyzes your client data for intent signals, identifies upsell opportunities, and crafts personalized multi-channel outreach sequences.",icon:"target",color:"var(--violet)",tag:"REVENUE INTELLIGENCE",capabilities:["Intent Signals","ICP Builder","Outreach Sequences"]},
    {id:"followup",title:"Follow-up Agent",desc:"Monitors portfolio health, detects at-risk accounts, and drafts prioritized follow-up messages ready to send.",icon:"activity",color:"var(--sky)",tag:"RELATIONSHIP MANAGEMENT",capabilities:["Risk Detection","Draft Messages","Priority Actions"]},
  ];
  return(<div>
    <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.2em",textTransform:"uppercase"}}>Automation</span>
    <h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginTop:8,marginBottom:12}}>AI Agents</h1>
    <p style={{fontSize:14,color:"var(--cream-mute)",lineHeight:1.7,marginBottom:32,maxWidth:600}}>Conversational agents that ask the right questions, analyze your data, and deliver actionable outputs — not just text generation.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,marginBottom:24}}>
      {agents.map(a=>(
        <div key={a.id} onClick={()=>setActiveAgent(activeAgent===a.id?null:a.id)} style={{padding:"24px",background:activeAgent===a.id?`${a.color}08`:"var(--ink-2)",borderRadius:14,border:`1px solid ${activeAgent===a.id?a.color+"40":"var(--border)"}`,cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>{if(activeAgent!==a.id)e.currentTarget.style.borderColor=`${a.color}25`;}} onMouseLeave={e=>{if(activeAgent!==a.id)e.currentTarget.style.borderColor="var(--border)";}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:40,height:40,borderRadius:10,background:`${a.color}12`,border:`1px solid ${a.color}25`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name={a.icon} size={18}/></div>
            <div><div style={{fontFamily:"var(--mono)",fontSize:9,color:a.color,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:2}}>{a.tag}</div><div style={{fontSize:15,color:"var(--cream)",fontWeight:500}}>{a.title}</div></div>
          </div>
          <p style={{fontSize:12,color:"var(--cream-mute)",lineHeight:1.7,margin:"0 0 12px"}}>{a.desc}</p>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:12}}>
            {a.capabilities.map((c,i)=><span key={i} style={{padding:"3px 8px",borderRadius:12,background:`${a.color}08`,fontFamily:"var(--mono)",fontSize:8,color:a.color,letterSpacing:"0.06em"}}>{c}</span>)}
          </div>
          <span style={{fontFamily:"var(--mono)",fontSize:10,color:a.color,letterSpacing:"0.06em"}}>{activeAgent===a.id?"▲ CLOSE":"▼ OPEN AGENT"}</span>
        </div>
      ))}
    </div>
    {activeAgent==="scope"&&<ScopeBuilderAgent data={data} dispatch={dispatch} user={user}/>}
    {activeAgent==="prospect"&&<ProspectingAgent data={data} dispatch={dispatch} user={user}/>}
    {activeAgent==="followup"&&<FollowUpAgent data={data} dispatch={dispatch} user={user}/>}
  </div>);
};

// ============================================================
// INBOX PAGE
// ============================================================
const InboxPage=({data,dispatch,user})=>{
  const[selected,setSelected]=useState(null);
  const[replyText,setReplyText]=useState("");
  const[composing,setComposing]=useState(false);
  const[composeForm,setComposeForm]=useState({to:"",subject:"",body:""});
  const[aiDrafting,setAiDrafting]=useState(false);
  const messages=(user.role==="client"?(data.inbox||[]).filter(m=>m.clientId===user.clientId):(data.inbox||[]));
  const threads=messages.reduce((acc,m)=>{if(!acc[m.threadId])acc[m.threadId]=[];acc[m.threadId].push(m);return acc;},{});
  const threadList=Object.entries(threads).map(([id,msgs])=>{const sorted=[...msgs].sort((a,b)=>new Date(b.date)-new Date(a.date));return{id,latest:sorted[0],count:msgs.length,unread:msgs.filter(m=>!m.read).length,messages:sorted};}).sort((a,b)=>new Date(b.latest.date)-new Date(a.latest.date));
  const selThread=selected?threadList.find(t=>t.id===selected):null;
  const openThread=(tid)=>{setSelected(tid);(threads[tid]||[]).forEach(m=>{if(!m.read)dispatch({type:"MARK_READ",payload:m.id});});};
  const sendReply=()=>{if(!replyText.trim()||!selThread)return;dispatch({type:"ADD_MESSAGE",payload:{threadId:selected,from:"sahil@revosys.pro",fromName:"Sahil — Revo-Sys",to:selThread.latest.direction==="inbound"?selThread.latest.from:selThread.latest.to,subject:selThread.latest.subject,body:replyText,clientId:selThread.latest.clientId,direction:"outbound"}});setReplyText("");};
  const aiDraftReply=async()=>{if(!selThread)return;setAiDrafting(true);const ctx=selThread.messages.slice(0,3).map(m=>`${m.fromName}: ${m.body}`).join("\n\n---\n\n");const draft=await callAI(`Draft a professional reply to this email thread:\n\n${ctx}`,"You are Sahil from Revo-Sys. Write a concise professional reply — email body only, no subject line.");setReplyText(draft);setAiDrafting(false);};
  const totalUnread=(data.inbox||[]).filter(m=>!m.read).length;
  return(<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)"}}>
    <div style={{marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
      <div><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",letterSpacing:"0.2em",textTransform:"uppercase"}}>Communications</span><h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginTop:8}}>Inbox{totalUnread>0&&<span style={{marginLeft:12,fontFamily:"var(--mono)",fontSize:14,color:"var(--amber)"}}>{totalUnread} unread</span>}</h1></div>
      {user.role!=="client"&&<Btn icon="edit" onClick={()=>setComposing(true)}>Compose</Btn>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:16,flex:1,minHeight:0}}>
      <div style={{background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",overflowY:"auto"}}>
        {threadList.length===0?<div style={{padding:"48px 20px",textAlign:"center",color:"var(--cream-mute)",fontSize:13,fontStyle:"italic"}}>No messages</div>
        :threadList.map(t=>{const client=data.clients.find(c=>c.id===t.latest.clientId);return(<div key={t.id} onClick={()=>openThread(t.id)} style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",cursor:"pointer",background:selected===t.id?"rgba(196,162,101,0.06)":"transparent",borderLeft:selected===t.id?"3px solid var(--amber)":"3px solid transparent",transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--ink-3)"}
          onMouseLeave={e=>e.currentTarget.style.background=selected===t.id?"rgba(196,162,101,0.06)":"transparent"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
            <span style={{fontSize:13,color:"var(--cream)",fontWeight:t.unread>0?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{t.latest.direction==="inbound"?t.latest.fromName:t.latest.to}</span>
            <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",flexShrink:0}}>{new Date(t.latest.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</span>
          </div>
          <div style={{fontSize:12,color:t.unread>0?"var(--cream-dim)":"var(--cream-mute)",fontWeight:t.unread>0?500:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:3}}>{t.latest.subject}</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {client&&<span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--amber)",letterSpacing:"0.06em"}}>{client.company}</span>}
            {t.unread>0&&<span style={{marginLeft:"auto",minWidth:18,height:18,borderRadius:9,background:"var(--amber)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--mono)",fontSize:9,color:"var(--ink)",fontWeight:700,padding:"0 5px"}}>{t.unread}</span>}
          </div>
        </div>);})}
      </div>
      {selThread?(<div style={{background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",display:"flex",flexDirection:"column",minHeight:0}}>
        <div style={{padding:"18px 24px",borderBottom:"1px solid var(--border)"}}><h3 style={{fontFamily:"var(--serif)",fontSize:18,fontStyle:"italic",color:"var(--cream)",margin:"0 0 2px"}}>{selThread.latest.subject}</h3><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{selThread.count} message{selThread.count!==1?"s":""}</span></div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
          {[...selThread.messages].reverse().map(m=>(<div key={m.id} style={{padding:"16px 20px",borderRadius:10,background:m.direction==="outbound"?"rgba(196,162,101,0.04)":"var(--ink)",border:`1px solid ${m.direction==="outbound"?"rgba(196,162,101,0.15)":"var(--border)"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div><span style={{fontSize:13,color:"var(--cream)",fontWeight:500}}>{m.fromName}</span><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",marginLeft:8}}>{m.from}</span></div>
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{new Date(m.date).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p style={{fontSize:13,color:"var(--cream-dim)",lineHeight:1.8,margin:0,whiteSpace:"pre-wrap"}}>{m.body}</p>
          </div>))}
        </div>
        {user.role!=="client"&&<div style={{padding:"14px 24px 18px",borderTop:"1px solid var(--border)"}}>
          <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Write a reply..." rows={3} style={{width:"100%",padding:"11px 16px",background:"var(--ink)",border:"1px solid var(--border)",borderRadius:10,color:"var(--cream)",fontSize:13,fontFamily:"var(--sans)",resize:"none",marginBottom:8}}/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ai" size="sm" icon="ai" onClick={aiDraftReply} disabled={aiDrafting}>{aiDrafting?"Drafting...":"AI Draft"}</Btn>
            <Btn size="sm" icon="send" onClick={sendReply} disabled={!replyText.trim()}>Send Reply</Btn>
          </div>
        </div>}
      </div>)
      :<div style={{background:"var(--ink-2)",borderRadius:12,border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center",color:"var(--cream-mute)"}}><div style={{opacity:0.15,marginBottom:16}}><Icon name="send" size={48}/></div><p style={{fontFamily:"var(--serif)",fontSize:15,fontStyle:"italic"}}>Select a conversation</p></div></div>}
    </div>
    <Modal open={composing} onClose={()=>setComposing(false)} title="New Message" wide>
      <Field label="To" value={composeForm.to} onChange={v=>setComposeForm({...composeForm,to:v})} placeholder="client@company.com"/>
      <Field label="Subject" value={composeForm.subject} onChange={v=>setComposeForm({...composeForm,subject:v})}/>
      <Field label="Message" value={composeForm.body} onChange={v=>setComposeForm({...composeForm,body:v})} type="textarea" rows={7}/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn v="secondary" onClick={()=>setComposing(false)}>Cancel</Btn>
        <Btn icon="send" onClick={()=>{dispatch({type:"ADD_MESSAGE",payload:{threadId:uid(),from:"sahil@revosys.pro",fromName:"Sahil — Revo-Sys",to:composeForm.to,subject:composeForm.subject,body:composeForm.body,clientId:"",direction:"outbound"}});setComposing(false);setComposeForm({to:"",subject:"",body:""}); }} disabled={!composeForm.to||!composeForm.subject}>Send</Btn>
      </div>
    </Modal>
  </div>);
};

// ============================================================
// MAIN APP
// ============================================================
export default function App(){
  const[data,dispatch]=useReducer(reducer,SEED);
  // Restore user from localStorage on load
  const[user,setUserRaw]=useState(()=>{try{const s=localStorage.getItem("rs_user");return s?JSON.parse(s):null;}catch{return null;}});
  const setUser=(u)=>{setUserRaw(u);try{if(u)localStorage.setItem("rs_user",JSON.stringify(u));else localStorage.removeItem("rs_user");}catch{}};
  const isPortalPath=window.location.pathname.startsWith("/portal");
  const[page,setPage]=useState(()=>{
    if(user) return "dashboard";
    return isPortalPath?"login":"portfolio";
  });
  const[detailId,setDetailId]=useState(null);
  const[sidebar,setSidebar]=useState(true);

  // Login state machine: "email" | "sent"
  const[loginStep,setLoginStep]=useState("email");
  const[loginEmail,setLoginEmail]=useState("");
  const[loginErr,setLoginErr]=useState("");
  const[loginSending,setLoginSending]=useState(false);

  const nav=(p,id=null)=>{
    setPage(p);setDetailId(id);
    if(p==="portfolio"){window.history.pushState({},"","/");}
    else{window.history.pushState({},"","/portal");}
  };
  const resetLogin=()=>{setLoginStep("email");setLoginEmail("");setLoginErr("");setLoginSending(false);};
  const logout=()=>{setUser(null);setPage("portfolio");setDetailId(null);resetLogin();window.history.pushState({},"","/");try{localStorage.removeItem("rs_user");}catch{}};

  // Submit email — same flow for everyone, no reveal of whether account exists
  const submitEmail=async()=>{
    const email=loginEmail.trim().toLowerCase();
    if(!email){setLoginErr("Please enter your email address.");return;}
    setLoginErr("");
    setLoginSending(true);
    setLoginStep("sent");
    // Always show "check inbox" regardless of whether user exists (prevent enumeration).
    // Server generates and signs the token — nothing is stored in React state.
    const match=data.users.find(u=>u.email.toLowerCase()===email);
    if(match){
      if(match.status === "invited") {
        setLoginStep("email");
        setLoginSending(false);
        setLoginErr("Your account hasn't been activated yet. Please check your email for the invitation link sent by Revo-Sys.");
        return;
      }
      try {
        await sendMagicEmail({to:match.email,name:match.name,type:"login"});
      } catch(err) {
        console.error("Magic link send failed:",err);
        setLoginStep("email");
        setLoginErr("Email failed to send: "+err.message+" — check Vercel function logs.");
      }
    }
    setLoginSending(false);
  };

  // Token from URL (magic link click) — verified server-side, matched by email
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const t=params.get("token");
    if(t){
      window.history.replaceState({},"",window.location.pathname);
      verifyMagicToken(t).then(email=>{
        if(email){
          const u=data.users.find(u=>u.email.toLowerCase()===email.toLowerCase());
          if(u){
            if(u.status === "invited") {
              dispatch({type:"UPDATE_USER", payload:{id:u.id, status:"active", lastLoginAt: new Date().toISOString()}});
            }
            setUser({...u, status:"active"});nav("dashboard");
          }
          else{setLoginErr("No account found for this link. Contact the Revo-Sys team to be added.");nav("login");}
        } else {
          setLoginErr("This link has expired or is invalid. Request a new one below.");
          nav("login");
        }
      });
    }
    if(!document.querySelector('link[href*="Instrument"]')){const l=document.createElement("link");l.rel="stylesheet";l.href=FONTS;document.head.appendChild(l);}
  },[]);

  // Visibility filter — clients see only their data, filtered by permissions
  const getVis=()=>{
    if(!user||user.role==="admin"||user.role==="internal") return data;
    const perms=user.permissions||{canViewTasks:true,canViewDeliverables:true,canApproveScopes:false,canComment:true};
    return {
      ...data,
      clients: data.clients.filter(c=>c.id===user.clientId),
      projects: data.projects.filter(p=>p.clientId===user.clientId),
      proposals: data.proposals.filter(p=>{const proj=data.projects.find(pr=>pr.id===p.projectId);return proj?.clientId===user.clientId;}),
      scopes: data.scopes.filter(s=>{const proj=data.projects.find(p=>p.id===s.projectId);return proj?.clientId===user.clientId;}),
      tasks: perms.canViewTasks ? data.tasks.filter(t=>{const p=data.projects.find(p=>p.id===t.projectId);return p?.clientId===user.clientId&&t.visibility==="client";}) : [],
      deliverables: perms.canViewDeliverables ? data.deliverables.filter(d=>{const t=data.tasks.find(t=>t.id===d.taskId);const p=data.projects.find(p=>p.id===t?.projectId);return p?.clientId===user.clientId;}) : [],
      activityLog: data.activityLog.filter(a=>{const proj=data.projects.find(p=>p.id===a.entityId);return proj?.clientId===user.clientId;}),
    };
  };
  const vd=getVis();

  // Nav items — admin/internal get full suite, clients get their slice
  const adminNav=[{key:"dashboard",label:"Dashboard",icon:"dash"},{key:"clients",label:"Clients",icon:"users",roles:["admin","internal"]},{key:"projects",label:"Projects",icon:"folder"},{key:"activity",label:"Activity",icon:"activity",roles:["admin","internal"]},{key:"agents",label:"Agents",icon:"ai",roles:["admin","internal"]},{key:"jobs",label:"Jobs",icon:"search",roles:["admin","internal"]},{key:"inbox",label:"Inbox",icon:"send"},{key:"settings",label:"Settings",icon:"settings",roles:["admin"]}];
  const clientNav=[{key:"dashboard",label:"Dashboard",icon:"dash"},{key:"projects",label:"My Projects",icon:"folder"},{key:"inbox",label:"Inbox",icon:"send"}];
  const navItems=user?.role==="client" ? clientNav : adminNav;

  if(!user){
    return (
      <div style={{fontFamily:"var(--sans)",color:"var(--cream)"}}>
        <style>{CSS}</style>
        <AnimatePresence mode="wait">
          <motion.div key={page} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.35,ease:"easeInOut"}} style={{minHeight:"100vh"}}>
            {page==="login" ? (
              <div style={{minHeight:"100vh",background:"var(--ink)",display:"flex"}}>
                {/* Left: login form */}
                <div style={{flex:"0 0 480px",display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 64px"}}>
                  <div style={{animation:"fadeUp .5s ease-out"}}>
                    <span style={{display:"block",marginBottom:52}}><span style={{fontFamily:"var(--serif)",fontSize:22,fontStyle:"italic",color:"var(--cream)"}}>Revo</span><span style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--amber)",letterSpacing:"0.1em"}}>-Sys</span></span>

                    {loginStep==="email"&&<>
                      <h1 style={{fontFamily:"var(--serif)",fontSize:38,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginBottom:8}}>Sign in</h1>
                      <p style={{color:"var(--cream-mute)",fontSize:14,marginBottom:36,fontWeight:300,lineHeight:1.6}}>Enter your email to receive a secure login link.</p>
                      {loginErr&&<div style={{padding:"10px 14px",borderRadius:8,background:"rgba(168,91,91,0.1)",color:"var(--danger)",fontSize:13,marginBottom:20}}>{loginErr}</div>}
                      <Field label="Email Address" value={loginEmail} onChange={v=>setLoginEmail(v)} placeholder="you@company.com"/>
                      <Btn onClick={submitEmail} style={{width:"100%",justifyContent:"center",marginTop:4}} size="lg">Send Login Link</Btn>
                    </>}

                    {loginStep==="sent"&&<>
                      <div style={{width:48,height:48,borderRadius:14,background:"rgba(107,158,111,0.08)",border:"1px solid rgba(107,158,111,0.2)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:28}}>
                        {loginSending
                          ? <div style={{width:18,height:18,border:"2px solid var(--border)",borderTopColor:"var(--success)",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                          : <Icon name="send" size={20}/>}
                      </div>
                      <h1 style={{fontFamily:"var(--serif)",fontSize:32,fontWeight:400,fontStyle:"italic",color:"var(--cream)",marginBottom:12}}>Check your inbox</h1>
                      <p style={{color:"var(--cream-mute)",fontSize:14,lineHeight:1.8,fontWeight:300}}>If you have an account, you will receive a login link shortly.<br/><br/>Click the link in the email to access your workspace — no password required.</p>
                      <button onClick={()=>{setLoginStep("email");setLoginErr("");}} style={{display:"block",margin:"32px 0 0",background:"none",border:"none",color:"var(--cream-mute)",cursor:"pointer",fontSize:11,fontFamily:"var(--mono)",letterSpacing:"0.08em",padding:0}}>← TRY A DIFFERENT EMAIL</button>
                    </>}

                    <button onClick={()=>nav("portfolio")} style={{display:"block",margin:"28px auto 0",background:"none",border:"none",color:"var(--cream-mute)",cursor:"pointer",fontSize:11,fontFamily:"var(--mono)",letterSpacing:"0.08em"}}>← BACK TO REVOSYS.PRO</button>
                  </div>
                </div>

                {/* Right: branded panel */}
                <div style={{flex:1,background:"var(--ink-2)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderLeft:"1px solid var(--border)",padding:"60px 80px",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:-120,right:-120,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(196,162,101,0.04) 0%,transparent 70%)",pointerEvents:"none"}}/>
                  <div style={{animation:"fadeIn .8s ease-out .3s both",maxWidth:340,textAlign:"center"}}>
                    <div style={{width:56,height:56,borderRadius:16,background:"rgba(196,162,101,0.06)",border:"1px solid rgba(196,162,101,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 32px",fontFamily:"var(--serif)",fontSize:22,fontStyle:"italic",color:"var(--amber)"}}>R</div>
                    <h2 style={{fontFamily:"var(--serif)",fontSize:28,fontWeight:400,fontStyle:"italic",color:"var(--cream)",lineHeight:1.3,marginBottom:16}}>Your project workspace, in one place.</h2>
                    <p style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cream-mute)",lineHeight:1.9,letterSpacing:"0.03em"}}>Track progress, review proposals, approve scopes, and access deliverables — all within your private workspace.</p>
                    <div style={{marginTop:40,display:"grid",gap:10}}>
                      {[["Projects & Tasks","Live status on every deliverable"],["Proposals & Scopes","Review, approve, and sign off"],["Deliverables","Download files and assets"]].map(([t,s])=>(
                        <div key={t} style={{padding:"14px 18px",background:"var(--ink)",borderRadius:10,border:"1px solid var(--border)",textAlign:"left"}}>
                          <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--amber)",letterSpacing:"0.06em",marginBottom:3}}>{t}</div>
                          <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)"}}>{s}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <PortfolioPage data={data} onLogin={()=>{window.history.pushState({},"","/portal");setPage("login");}}/>
            )}
          </motion.div>
        </AnimatePresence>
        <Analytics />
      </div>
    );
  }


  return(<div style={{display:"flex",minHeight:"100vh",background:"var(--ink)",fontFamily:"var(--sans)",color:"var(--cream)"}}><style>{CSS}</style><aside style={{width:sidebar?220:56,background:"var(--ink-2)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",transition:"width .25s ease",overflow:"hidden",flexShrink:0}}><div style={{padding:sidebar?"20px 16px":"20px 12px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid var(--border)"}}><button onClick={()=>setSidebar(!sidebar)} className="ghost-btn"><Icon name="menu" size={18}/></button>{sidebar&&<span style={{whiteSpace:"nowrap"}}><span style={{fontFamily:"var(--serif)",fontSize:18,fontStyle:"italic",color:"var(--cream)"}}>Revo</span><span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--amber)",letterSpacing:"0.1em"}}>-Sys</span></span>}</div><nav style={{flex:1,padding:"12px 8px"}}>{navItems.filter(n=>!n.roles||n.roles.includes(user.role)).map(n=>(<button key={n.key} onClick={()=>nav(n.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:sidebar?"10px 12px":"10px 6px",marginBottom:2,background:(page===n.key||(n.key==="projects"&&page==="project_detail"))?"rgba(196,162,101,0.08)":"transparent",border:"none",borderRadius:6,color:(page===n.key||(n.key==="projects"&&page==="project_detail"))?"var(--amber)":"var(--cream-mute)",cursor:"pointer",fontSize:13,fontFamily:"var(--sans)",justifyContent:sidebar?"flex-start":"center"}}><Icon name={n.icon} size={16}/>{sidebar&&<span>{n.label}</span>}</button>))}</nav><div style={{padding:"12px 8px",borderTop:"1px solid var(--border)"}}><div style={{display:"flex",alignItems:"center",gap:10,padding:sidebar?"10px 12px":"10px 6px",marginBottom:6}}><div style={{width:32,height:32,borderRadius:8,background:"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:12,fontStyle:"italic",color:"var(--amber)",flexShrink:0}}>{user.avatar}</div>{sidebar&&<div><p style={{margin:0,fontSize:13,color:"var(--cream-dim)"}}>{user.name}</p><span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--cream-mute)",textTransform:"capitalize"}}>{user.role}</span></div>}</div><button onClick={logout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:sidebar?"10px 12px":"10px 6px",background:"none",border:"none",borderRadius:6,color:"var(--cream-mute)",cursor:"pointer",fontSize:13,fontFamily:"var(--sans)",justifyContent:sidebar?"flex-start":"center"}}><Icon name="logout" size={16}/>{sidebar&&<span>Sign Out</span>}</button></div></aside><main style={{flex:1,overflow:"auto",padding:"36px 48px"}}><AnimatePresence mode="wait"><motion.div key={page} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.3}} style={{minHeight:"100%"}}>{page==="dashboard"&&<DashboardPage data={vd} user={user} onNav={nav}/>}{page==="clients"&&<ClientsPage data={vd} dispatch={dispatch} user={user} onNav={nav}/>}{page==="projects"&&<ProjectsPage data={vd} dispatch={dispatch} user={user} onNav={nav}/>}{page==="project_detail"&&<ProjectDetail data={vd} dispatch={dispatch} user={user} projectId={detailId} onNav={nav}/>}{page==="activity"&&<ActivityPage data={vd}/>}{page==="settings"&&<SettingsPage data={data} dispatch={dispatch} user={user}/>}{page==="agents"&&<AgentsPage data={vd} dispatch={dispatch} user={user}/>}{page==="jobs"&&<JobsPage data={vd} dispatch={dispatch} user={user}/>}{page==="inbox"&&<InboxPage data={vd} dispatch={dispatch} user={user}/>}</motion.div></AnimatePresence></main><Analytics /></div>);

}
