# Graph Report - Daily_CRM  (2026-07-18)

## Corpus Check
- 348 files · ~1,159,332 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1882 nodes · 6040 edges · 93 communities (80 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9d01a103`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Automations UI & Config|Automations UI & Config]]
- [[_COMMUNITY_Dashboard Charts & Activity Feed|Dashboard Charts & Activity Feed]]
- [[_COMMUNITY_Project Package Dependencies|Project Package Dependencies]]
- [[_COMMUNITY_API Routes & Step Trees|API Routes & Step Trees]]
- [[_COMMUNITY_Automation Execution Engine|Automation Execution Engine]]
- [[_COMMUNITY_Automation Visual Builder UI|Automation Visual Builder UI]]
- [[_COMMUNITY_Shared Design System Components|Shared Design System Components]]
- [[_COMMUNITY_Broadcast Campaigns & Analytics|Broadcast Campaigns & Analytics]]
- [[_COMMUNITY_WhatsApp Integration Providers|WhatsApp Integration Providers]]
- [[_COMMUNITY_Webhook Processing & Security|Webhook Processing & Security]]
- [[_COMMUNITY_Workspace Tooling Configurations|Workspace Tooling Configurations]]
- [[_COMMUNITY_Contribution Documentation|Contribution Documentation]]
- [[_COMMUNITY_TypeScript & Build Configs|TypeScript & Build Configs]]
- [[_COMMUNITY_Real-time Chat UI Components|Real-time Chat UI Components]]
- [[_COMMUNITY_Contacts & Deals Management|Contacts & Deals Management]]
- [[_COMMUNITY_DealCard  DealCardProps|DealCard / DealCardProps]]
- [[_COMMUNITY_contactFields  SAMPLE CONTACT|contactFields / SAMPLE CONTACT]]
- [[_COMMUNITY_BroadcastResult  NewRecipient|BroadcastResult / NewRecipient]]
- [[_COMMUNITY_AdminDashboard  UserProfile|AdminDashboard / UserProfile]]
- [[_COMMUNITY_AuthContext  AuthContextValue|AuthContext / AuthContextValue]]
- [[_COMMUNITY_engineSendTemplate  engineSendText|engineSendTemplate / engineSendText]]
- [[_COMMUNITY_buckets  Entry|buckets / Entry]]
- [[_COMMUNITY_BuilderStep  AUTOMATION TEMPLATES|BuilderStep / AUTOMATION TEMPLATES]]
- [[_COMMUNITY_AudienceConfig  BroadcastApiResult|AudienceConfig / BroadcastApiResult]]
- [[_COMMUNITY_RealtimeEvent  UseRealtimeOptions|RealtimeEvent / UseRealtimeOptions]]
- [[_COMMUNITY_encryption.test  a|encryption.test / a]]
- [[_COMMUNITY_isTabValue  SettingsPage|isTabValue / SettingsPage]]
- [[_COMMUNITY_AutomationCard  formatRelative|AutomationCard / formatRelative]]
- [[_COMMUNITY_POST  route|POST / route]]
- [[_COMMUNITY_AudienceConfig  audienceOptions|AudienceConfig / audienceOptions]]
- [[_COMMUNITY_scripts  build|scripts / build]]
- [[_COMMUNITY_ContactSidebar  ContactSidebarProps|ContactSidebar / ContactSidebarProps]]
- [[_COMMUNITY_inter  metadata|inter / metadata]]
- [[_COMMUNITY_linked-project.json  name|linked-project.json / name]]
- [[_COMMUNITY_AuthLayout  metadata|AuthLayout / metadata]]
- [[_COMMUNITY_Icon  size|Icon / size]]
- [[_COMMUNITY_DashboardLayout  metadata|DashboardLayout / metadata]]
- [[_COMMUNITY_config  proxy|config / proxy]]
- [[_COMMUNITY_AGENTS.md  This is NOT the Next.js y...|AGENTS.md / This is NOT the Next.js y...]]
- [[_COMMUNITY_graphify.md  graphify|graphify.md / graphify]]
- [[_COMMUNITY_graphify.md  Workflow graphify|graphify.md / Workflow: graphify]]
- [[_COMMUNITY_SECURITY HEADERS  next.config|SECURITY HEADERS / next.config]]
- [[_COMMUNITY_DocsPage  page|DocsPage / page]]
- [[_COMMUNITY_config  postcss.config.mjs|config / postcss.config.mjs]]
- [[_COMMUNITY_LandingPage  page|LandingPage / page]]
- [[_COMMUNITY_next-env.d|next-env.d]]
- [[_COMMUNITY_vitest.config|vitest.config]]
- [[_COMMUNITY_CLAUDE|CLAUDE.md]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 187 edges
2. `Button()` - 103 edges
3. `createClient()` - 96 edges
4. `createClient()` - 81 edges
5. `useAuth()` - 74 edges
6. `Input()` - 72 edges
7. `useWorkspace()` - 69 edges
8. `AutomationBuilder()` - 55 edges
9. `Label()` - 55 edges
10. `TemplateManager()` - 45 edges

## Surprising Connections (you probably didn't know these)
- `DashboardPage()` --calls--> `useAuth()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/hooks/use-auth.tsx
- `DashboardPage()` --calls--> `useWorkspace()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/hooks/use-workspace.tsx
- `DashboardPage()` --calls--> `formatCurrency()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/lib/currency.ts
- `RunCard()` --calls--> `cn()`  [EXTRACTED]
  src/app/(dashboard)/flows/[id]/runs/page.tsx → src/lib/utils.ts
- `FlowsPage()` --calls--> `useCan()`  [EXTRACTED]
  src/app/(dashboard)/flows/page.tsx → src/hooks/use-can.ts

## Import Cycles
- None detected.

## Communities (93 total, 13 thin omitted)

### Community 0 - "Automations UI & Config"
Cohesion: 0.11
Nodes (54): AutomationCard(), AutomationsPage(), TEMPLATE_ICON, TEMPLATE_ORDER, formatRelative(), AudienceConfig, Step4Props, Step4ScheduleSend() (+46 more)

### Community 1 - "Dashboard Charts & Activity Feed"
Cohesion: 0.07
Nodes (59): ActivityFeed(), ActivityFeedProps, KIND_THEME, KindTheme, PAGE_SIZES, PageSize, relativeTime(), ConversationsChart() (+51 more)

### Community 2 - "Project Package Dependencies"
Cohesion: 0.33
Nodes (6): url, bugs, url, repository, type, url

### Community 3 - "API Routes & Step Trees"
Cohesion: 0.17
Nodes (25): GET(), POST(), BuilderStepInput, BuilderStepNode, DbStep, InsertRow, insertSteps(), loadStepsTree() (+17 more)

### Community 4 - "Automation Execution Engine"
Cohesion: 0.10
Nodes (40): supabaseAdmin(), appendResults(), AutomationContext, DispatchInput, evaluateCondition(), ExecuteArgs, executeAutomation(), executeStepsFrom() (+32 more)

### Community 5 - "Automation Visual Builder UI"
Cohesion: 0.12
Nodes (33): ADDABLE_STEPS, AddButton(), ApiStep, AutomationBuilder(), blankConfig(), BranchColumn(), BuilderInitial, cid() (+25 more)

### Community 6 - "Shared Design System Components"
Cohesion: 0.15
Nodes (28): usePresence(), RealtimeEvent, useRealtime(), UseRealtimeOptions, ContactSidebar(), ContactSidebarProps, ConversationItem(), ConversationItemProps (+20 more)

### Community 7 - "Broadcast Campaigns & Analytics"
Cohesion: 0.07
Nodes (53): BroadcastsPage(), percent(), RateCell(), BroadcastDetailPage(), downloadBlob(), FunnelChart(), FunnelStep, getAdminClient() (+45 more)

### Community 8 - "WhatsApp Integration Providers"
Cohesion: 0.17
Nodes (8): ApiAutoProvider, MetaProvider, MockProvider, formatTwilioNumber(), TwilioProvider, sendTemplateMessage(), sendTextMessage(), WhatsAppProvider

### Community 9 - "Webhook Processing & Security"
Cohesion: 0.13
Nodes (29): dedupeByPhone(), ExistingContact, findExistingContact(), isExactMatch(), normalizeKey(), ContactOutcome, ContactRow, findOrCreateContact() (+21 more)

### Community 10 - "Workspace Tooling Configurations"
Cohesion: 0.09
Nodes (30): FAQ_BOT, FlowTemplate, FlowTemplateNode, FlowTemplateNodeType, LEAD_CAPTURE, listFlowTemplates(), TEMPLATES, WELCOME_MENU (+22 more)

### Community 11 - "Contribution Documentation"
Cohesion: 0.09
Nodes (22): Dev-loop reference, Fork and run, If you maintain a public fork, Keeping your fork up to date, Licensing, Reporting bugs in the upstream template, Reporting security issues, Upstream pull requests (+14 more)

### Community 12 - "TypeScript & Build Configs"
Cohesion: 0.17
Nodes (40): IntegrationsPage(), AdminLoginPage(), LoginPage(), ApiKey, ALLOWED_MIME, BrandingData, EmailConfig(), FormsConfig() (+32 more)

### Community 13 - "Real-time Chat UI Components"
Cohesion: 0.17
Nodes (16): renderBodyPreview(), TemplatePickerProps, TemplateSendValues, UrlButtonSlot, CATEGORIES, categoryColors, COMMON_LANGUAGE_CODES, emptyForm (+8 more)

### Community 14 - "Contacts & Deals Management"
Cohesion: 0.09
Nodes (33): ContactDetailView(), ContactDetailViewProps, applyEdgeConnection(), CanvasEdge, deriveCanvasEdges(), OutgoingSlot, outgoingSlots(), unlinkNodeReferences() (+25 more)

### Community 15 - "DealCard / DealCardProps"
Cohesion: 0.19
Nodes (14): CURRENCIES, CurrencyOption, formatCurrency(), DealCard(), DealCardProps, formatDate(), initials(), computeStageProbability() (+6 more)

### Community 16 - "contactFields / SAMPLE CONTACT"
Cohesion: 0.24
Nodes (18): DealForm(), DealFormProps, SPEC_DEFAULT_STAGES, PipelineAnalyticsProps, DraggableDealCard(), formatCurrency(), PipelineBoard(), PipelineBoardProps (+10 more)

### Community 17 - "BroadcastResult / NewRecipient"
Cohesion: 0.17
Nodes (32): sendViaProvider(), BroadcastResult, NewRecipient, POST(), engineSendInteractiveButtons(), engineSendInteractiveList(), engineSendMedia(), engineSendText() (+24 more)

### Community 18 - "AdminDashboard / UserProfile"
Cohesion: 0.08
Nodes (23): AdminDashboard(), ALL_CHANNELS, DealLostReason, DealSource, GROWTH_LIMITS, Prospect, STATUS_CONFIG, UserProfile (+15 more)

### Community 19 - "AuthContext / AuthContextValue"
Cohesion: 0.20
Nodes (10): DashboardShell(), DashboardShellInner(), DashboardLayout(), metadata, useTotalUnread(), WorkspacePermissions, bottomNavItems, navItems (+2 more)

### Community 20 - "engineSendTemplate / engineSendText"
Cohesion: 0.07
Nodes (36): GET(), GET(), DeleteMessageTemplateArgs, downloadMedia(), DownloadMediaArgs, EditMessageTemplateArgs, EditMessageTemplateResult, getMediaUrl() (+28 more)

### Community 21 - "buckets / Entry"
Cohesion: 0.17
Nodes (22): AdminClient, advanceCurrentNodeKey(), advanceFromNodeKey(), dispatchInboundToFlows(), endRun(), evaluateConditionNode(), evaluateConditionPredicate(), executeHandoff() (+14 more)

### Community 22 - "BuilderStep / AUTOMATION TEMPLATES"
Cohesion: 0.09
Nodes (34): contactFields, SAMPLE_CONTACT, Step3Personalize(), Step3Props, VariableMapping, VariableType, NextNodeRow(), NodeKeySelect() (+26 more)

### Community 23 - "AudienceConfig / BroadcastApiResult"
Cohesion: 0.07
Nodes (30): categoryColors, Step1ChooseTemplate(), Step1Props, AudienceConfig, audienceOptions, AudienceType, CustomFieldFilter, CustomFieldOperator (+22 more)

### Community 24 - "RealtimeEvent / UseRealtimeOptions"
Cohesion: 0.16
Nodes (14): AccountContext, RequireRole(), RequireRoleProps, AccountRole, AccountSummary, AuthContext, AuthContextValue, AuthProvider() (+6 more)

### Community 25 - "encryption.test / a"
Cohesion: 0.17
Nodes (10): a, b, bogusTag, ct, [, ctHex, tagHex], [ivHex, ctHex], legacy, modern (+2 more)

### Community 26 - "isTabValue / SettingsPage"
Cohesion: 0.17
Nodes (20): useAuth(), useTheme(), OnboardingPage(), ApiKeysSettings(), AppearancePanel(), BrandingSettings(), ChatbotConfig(), DealsSettings() (+12 more)

### Community 27 - "AutomationCard / formatRelative"
Cohesion: 0.31
Nodes (6): TRIGGER_META, triggerMeta, AutomationLogsPage(), StatusBadge(), StepRow(), AutomationLog

### Community 28 - "POST / route"
Cohesion: 0.05
Nodes (64): EDITABLE_STATUSES, isDryRun(), collectVariableSlots(), DELETE(), PATCH(), POST(), buildUpsertRow(), upsertTemplateRow() (+56 more)

### Community 29 - "AudienceConfig / audienceOptions"
Cohesion: 0.15
Nodes (22): generateApiKey(), GeneratedApiKey, hashApiKey(), looksLikeApiKey(), ApiKeyRow, findActiveKeyByHash(), getAccountName(), touchLastUsed() (+14 more)

### Community 30 - "scripts / build"
Cohesion: 0.06
Nodes (32): dependencies, bcryptjs, jspdf, jspdf-autotable, mongoose, next, next-auth, react (+24 more)

### Community 31 - "ContactSidebar / ContactSidebarProps"
Cohesion: 0.09
Nodes (49): GET(), PATCH(), GET(), POST(), ForbiddenError, getCurrentAccount(), requireRole(), toErrorResponse() (+41 more)

### Community 32 - "inter / metadata"
Cohesion: 0.13
Nodes (21): inter, metadata, RootLayout(), viewport, ThemedToaster(), useIsClient(), readInitialMode(), readInitialTheme() (+13 more)

### Community 33 - "linked-project.json / name"
Cohesion: 0.40
Nodes (4): name, organization_id, organization_slug, ref

### Community 36 - "DashboardLayout / metadata"
Cohesion: 0.09
Nodes (23): BarChart, BarChartEventProps, BarChartProps, BaseEventProps, ChartLegend(), ChartTooltipProps, deepEqual(), HasScrollProps (+15 more)

### Community 38 - "AGENTS.md / This is NOT the Next.js y..."
Cohesion: 0.19
Nodes (16): ACCOUNT_ROLES, canDeleteAccount(), canEditSettings(), canManageMembers(), canSendMessages(), canTransferOwnership(), canViewOnly(), hasMinRole() (+8 more)

### Community 41 - "SECURITY HEADERS / next.config"
Cohesion: 0.07
Nodes (35): channels, features, LandingPage(), stats, testimonials, Plan, PLANS, POST() (+27 more)

### Community 43 - "config / postcss.config.mjs"
Cohesion: 0.08
Nodes (39): DeltaRow(), MetricCard(), MetricCardProps, NodeEditSheet(), ToggleButton(), StatusBadge(), MessageActions(), MessageActionsProps (+31 more)

### Community 44 - "LandingPage / page"
Cohesion: 0.17
Nodes (14): ComposerMediaKind, formatDuration(), MediaDraft, MediaDraftPreview(), MessageComposer(), MessageComposerProps, PICKER_ACCEPT, ReplyDraft (+6 more)

### Community 45 - "next-env.d"
Cohesion: 0.26
Nodes (13): BuilderStep, StepListProps, AUTOMATION_TEMPLATES, AutomationTemplateDefinition, TemplateSlug, TemplateStepSeed, expandFromSeeds(), NewAutomationPage() (+5 more)

### Community 46 - "vitest.config"
Cohesion: 0.15
Nodes (18): DELETE(), GET(), POST(), DELETE(), GET(), POST(), getWorkspaceUsageAndLimits(), WorkspaceUsageInfo (+10 more)

### Community 47 - "CLAUDE.md"
Cohesion: 0.16
Nodes (15): PresenceMap, UsePresenceResult, derivePresence(), formatLastSeen(), presenceLabel(), PresenceRow, PresenceStatus, StoredPresence (+7 more)

### Community 48 - "Community 48"
Cohesion: 0.08
Nodes (24): dependencies, @base-ui/react, class-variance-authority, clsx, @dagrejs/dagre, date-fns, @dnd-kit/core, @dnd-kit/sortable (+16 more)

### Community 49 - "Community 49"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 50 - "Community 50"
Cohesion: 0.08
Nodes (35): FlowBuilder(), NodeCard(), CanvasAddNodeButton(), FlowCanvas(), FlowCanvasInner(), NodeData, FlowEditorShell(), Props (+27 more)

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (13): MediaImage(), MediaUnavailable(), MessageBubble(), MessageBubbleProps, MessageContent(), StatusIcon(), MessageReactions(), MessageReactionsProps (+5 more)

### Community 52 - "Community 52"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 53 - "Community 53"
Cohesion: 0.14
Nodes (11): EditQuotationPage(), LocalLineItem, LocalSection, PageProps, PageProps, QuotationPreviewPage(), SectionWithItems, Quotation (+3 more)

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (18): args, askQuestion(), { createClient }, envContent, envPath, envVars, extractContactName(), fs (+10 more)

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (7): ChatMessage, generateChatbotResponse(), getFallbackApiKey(), processChatbotReply(), ProcessChatbotReplyArgs, supabaseAdmin(), POST()

### Community 56 - "Community 56"
Cohesion: 0.13
Nodes (14): eslintConfig, devDependencies, eslint, eslint-config-next, prettier, prettier-plugin-tailwindcss, tailwindcss, @tailwindcss/postcss (+6 more)

### Community 57 - "Community 57"
Cohesion: 0.70
Nodes (4): POST(), corsHeaders(), OPTIONS(), supabaseAdmin()

### Community 58 - "Community 58"
Cohesion: 0.31
Nodes (7): ROLE_META, ChipVariant, SettingsChip(), StatusDot(), VARIANTS, OverviewCounts, WhatsAppStatus

### Community 59 - "Community 59"
Cohesion: 0.20
Nodes (11): args, { createClient }, envContent, envPath, envVars, fs, parseDate(), parseWhatsAppChat() (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.18
Nodes (10): author, description, engines, node, homepage, keywords, license, name (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.20
Nodes (10): scripts, build, dev, format, format:check, lint, start, test (+2 more)

### Community 62 - "Community 62"
Cohesion: 0.25
Nodes (7): EVENT_COLOR, EventLine(), EventRow, RunCard(), RunRow, STATUS_META, summarizePayload()

### Community 63 - "Community 63"
Cohesion: 0.25
Nodes (7): garbage, good, issues, noUrl, roundRobinNoAgent, specificMissingAgent, wrongProtocol

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (7): { createClient }, envContent, envPath, envVars, fs, path, supabase

### Community 66 - "Community 66"
Cohesion: 0.38
Nodes (5): FallbackAction, resolveFallbackPolicy(), DEFAULT_FALLBACK_POLICY, FlowFallbackPolicy, GET()

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 68 - "Community 68"
Cohesion: 0.18
Nodes (10): describeTrigger(), FlowCard(), FlowRow, FlowsPage(), STATUS_COLORS, STATUS_LABELS, TEMPLATE_ICONS, TemplateSummary (+2 more)

### Community 69 - "Community 69"
Cohesion: 0.33
Nodes (6): API_SCOPES, ApiScope, hasScope(), isApiScope(), normalizeScopes(), SCOPE_DESCRIPTIONS

### Community 70 - "Community 70"
Cohesion: 0.47
Nodes (5): parseContactCsv(), ParseContactCsvResult, parseCsvLine(), ParsedContactRow, parseTagCell()

### Community 72 - "Community 72"
Cohesion: 0.24
Nodes (11): POST(), supabaseAdmin(), GET(), POST(), requireUser(), getFlowTemplate(), PUT(), PutBody (+3 more)

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (5): overrides, fast-uri, hono, ip-address, postcss

### Community 78 - "Community 78"
Cohesion: 0.29
Nodes (5): FAIL_COPY, PeekFail, PeekOk, PeekResult, ROLE_LABEL

### Community 79 - "Community 79"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 85 - "Community 85"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 86 - "Community 86"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 87 - "Community 87"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 89 - "Community 89"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

## Knowledge Gaps
- **474 isolated node(s):** `{ createClient }`, `dotenv`, `path`, `supabase`, `{ createClient }` (+469 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `config / postcss.config.mjs` to `Automations UI & Config`, `Dashboard Charts & Activity Feed`, `Automation Visual Builder UI`, `Shared Design System Components`, `Broadcast Campaigns & Analytics`, `TypeScript & Build Configs`, `Real-time Chat UI Components`, `Contacts & Deals Management`, `DealCard / DealCardProps`, `contactFields / SAMPLE CONTACT`, `AdminDashboard / UserProfile`, `AuthContext / AuthContextValue`, `BuilderStep / AUTOMATION TEMPLATES`, `isTabValue / SettingsPage`, `AutomationCard / formatRelative`, `inter / metadata`, `DashboardLayout / metadata`, `AGENTS.md / This is NOT the Next.js y...`, `LandingPage / page`, `CLAUDE.md`, `Community 50`, `Community 51`, `Community 58`, `Community 62`, `Community 68`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `createClient()` connect `vitest.config` to `API Routes & Step Trees`, `Automation Execution Engine`, `Community 72`, `SECURITY HEADERS / next.config`, `Workspace Tooling Configurations`, `BroadcastResult / NewRecipient`, `engineSendTemplate / engineSendText`, `Community 55`, `POST / route`, `ContactSidebar / ContactSidebarProps`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `Button()` connect `contactFields / SAMPLE CONTACT` to `Automations UI & Config`, `Automation Visual Builder UI`, `Shared Design System Components`, `Broadcast Campaigns & Analytics`, `TypeScript & Build Configs`, `Real-time Chat UI Components`, `Contacts & Deals Management`, `AdminDashboard / UserProfile`, `BuilderStep / AUTOMATION TEMPLATES`, `AudienceConfig / BroadcastApiResult`, `RealtimeEvent / UseRealtimeOptions`, `AutomationCard / formatRelative`, `config / postcss.config.mjs`, `LandingPage / page`, `CLAUDE.md`, `Community 50`, `Community 53`, `Community 68`, `Community 78`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useAuth()` (e.g. with `DashboardPage()` and `EditQuotationPage()`) actually correct?**
  _`useAuth()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ createClient }`, `dotenv`, `path` to the rest of the system?**
  _474 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Automations UI & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.106544901065449 - nodes in this community are weakly interconnected._
- **Should `Dashboard Charts & Activity Feed` be split into smaller, more focused modules?**
  _Cohesion score 0.07298245614035087 - nodes in this community are weakly interconnected._