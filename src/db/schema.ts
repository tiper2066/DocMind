import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  vector,
  primaryKey,
  index,
  real,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: text("role"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slackTeamId: text("slack_team_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    url: text("url"),
    fileKey: text("file_key"),
    title: text("title"),
    summary: text("summary"),
    tags: text("tags").array(),
    status: text("status").notNull().default("crawling"),
    lastCrawledAt: timestamp("last_crawled_at", { mode: "date" }),
    contentHash: text("content_hash"),
    fingerprint: text("fingerprint"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("sources_workspace_status_idx").on(t.workspaceId, t.status)],
);

export const sourceChunks = pgTable("source_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  ord: integer("ord").notNull(),
  text: text("text").notNull(),
  tokenCount: integer("token_count"),
  embedding: vector("embedding", { dimensions: 1024 }),
});

export const brandTemplates = pgTable("brand_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokensJson: jsonb("tokens_json").notNull(),
  coverLayoutId: text("cover_layout_id"),
  slideLayoutsJson: jsonb("slide_layouts_json"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  reader: text("reader"),
  cta: text("cta"),
  objection: text("objection"),
  lengthPages: integer("length_pages"),
  brandTemplateId: uuid("brand_template_id").references(() => brandTemplates.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const documentVersions = pgTable("document_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  slidesJson: jsonb("slides_json").notNull(),
  pptxObjectKey: text("pptx_object_key"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const documentSources = pgTable(
  "document_sources",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    importance: real("importance").default(1).notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.sourceId] })],
);

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  currentStep: text("current_step").notNull().default("type"),
  answersJson: jsonb("answers_json").notNull().default({}),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("active"),
  autoRun: boolean("auto_run").notNull().default(true),
  configJson: jsonb("config_json").notNull().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { mode: "date" }),
  trigger: text("trigger"),
  status: text("status").notNull().default("running"),
  stepsJson: jsonb("steps_json"),
  summary: text("summary"),
});

export const agentEvents = pgTable(
  "agent_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { mode: "date" }).defaultNow().notNull(),
    phase: text("phase").notNull(),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json"),
  },
  (t) => [index("agent_events_run_ts_idx").on(t.runId, t.ts.desc())],
);

export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => agentRuns.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  kind: text("kind").notNull(),
  payload: jsonb("payload"),
  decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  decision: text("decision"),
  decidedAt: timestamp("decided_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const schedules = pgTable("schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  cron: text("cron").notNull(),
  documentTemplateJson: jsonb("document_template_json").notNull(),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  target: text("target").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  relatedRunId: uuid("related_run_id").references(() => agentRuns.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target"),
  ts: timestamp("ts", { mode: "date" }).defaultNow().notNull(),
});
