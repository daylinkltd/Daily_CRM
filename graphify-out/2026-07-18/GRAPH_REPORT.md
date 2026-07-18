# Graph Report - Daily_CRM  (2026-07-18)

## Corpus Check
- 321 files · ~1,140,259 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1781 nodes · 5730 edges · 85 communities (70 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1245fa55`
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

## God Nodes (most connected - your core abstractions)
1. `cn()` - 187 edges
2. `Button()` - 96 edges
3. `createClient()` - 85 edges
4. `createClient()` - 75 edges
5. `Input()` - 66 edges
6. `useAuth()` - 59 edges
7. `AutomationBuilder()` - 55 edges
8. `useWorkspace()` - 53 edges
9. `Label()` - 50 edges
10. `TemplateManager()` - 45 edges

## Surprising Connections (you probably didn't know these)
- `DashboardPage()` --calls--> `useAuth()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/hooks/use-auth.tsx
- `DashboardPage()` --calls--> `useWorkspace()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/hooks/use-workspace.tsx
- `DashboardPage()` --calls--> `formatCurrency()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/lib/currency.ts
- `GET()` --calls--> `resumePendingExecution()`  [INFERRED]
  src/app/api/automations/cron/route.ts → src/lib/automations/engine.ts
- `GET()` --calls--> `resolveFallbackPolicy()`  [INFERRED]
  src/app/api/flows/cron/route.ts → src/lib/flows/fallback.ts

## Import Cycles
- None detected.

## Communities (85 total, 15 thin omitted)

### Community 0 - "Automations UI & Config"
Cohesion: 0.12
Nodes (48): AutomationsPage(), TEMPLATE_ICON, TEMPLATE_ORDER, AudienceConfig, Step4Props, Step4ScheduleSend(), ContactForm(), ContactFormProps (+40 more)

### Community 1 - "Dashboard Charts & Activity Feed"
Cohesion: 0.07
Nodes (62): ActivityFeed(), ActivityFeedProps, KIND_THEME, KindTheme, PAGE_SIZES, PageSize, relativeTime(), ConversationsChart() (+54 more)

### Community 2 - "Project Package Dependencies"
Cohesion: 0.33
Nodes (6): url, bugs, url, repository, type, url

### Community 3 - "API Routes & Step Trees"
Cohesion: 0.16
Nodes (23): loadStepsTree(), replaceSteps(), nonEmpty(), StepLike, garbage, good, issues, noUrl (+15 more)

### Community 4 - "Automation Execution Engine"
Cohesion: 0.14
Nodes (28): appendResults(), AutomationContext, evaluateCondition(), executeAutomation(), executeStepsFrom(), finalizeLog(), interpolate(), markPending() (+20 more)

### Community 5 - "Automation Visual Builder UI"
Cohesion: 0.12
Nodes (33): ADDABLE_STEPS, AddButton(), ApiStep, AutomationBuilder(), blankConfig(), BranchColumn(), BuilderInitial, cid() (+25 more)

### Community 6 - "Shared Design System Components"
Cohesion: 0.05
Nodes (74): RealtimeEvent, useRealtime(), UseRealtimeOptions, ContactSidebar(), ContactSidebarProps, ConversationItem(), ConversationItemProps, ConversationList() (+66 more)

### Community 7 - "Broadcast Campaigns & Analytics"
Cohesion: 0.16
Nodes (28): BroadcastsPage(), percent(), RateCell(), BroadcastDetailPage(), downloadBlob(), FunnelChart(), FunnelStep, RECIPIENT_STATUSES (+20 more)

### Community 8 - "WhatsApp Integration Providers"
Cohesion: 0.17
Nodes (8): ApiAutoProvider, MetaProvider, MockProvider, formatTwilioNumber(), TwilioProvider, sendTemplateMessage(), sendTextMessage(), WhatsAppProvider

### Community 9 - "Webhook Processing & Security"
Cohesion: 0.18
Nodes (23): ContactOutcome, ContactRow, findOrCreateContact(), findOrCreateConversation(), flagBroadcastReplyIfAny(), GET(), handleStatusUpdate(), isValidStatusTransition() (+15 more)

### Community 10 - "Workspace Tooling Configurations"
Cohesion: 0.06
Nodes (57): AdminClient, advanceCurrentNodeKey(), advanceFromNodeKey(), dispatchInboundToFlows(), endRun(), evaluateConditionNode(), evaluateConditionPredicate(), executeHandoff() (+49 more)

### Community 11 - "Contribution Documentation"
Cohesion: 0.09
Nodes (22): Dev-loop reference, Fork and run, If you maintain a public fork, Keeping your fork up to date, Licensing, Reporting bugs in the upstream template, Reporting security issues, Upstream pull requests (+14 more)

### Community 12 - "TypeScript & Build Configs"
Cohesion: 0.17
Nodes (37): IntegrationsPage(), ApiKey, EmailConfig(), FormsConfig(), ConnectionStatus, InstagramConfig(), MessengerConfig(), ALLOWED_MIME (+29 more)

### Community 13 - "Real-time Chat UI Components"
Cohesion: 0.11
Nodes (20): describeTrigger(), FlowCard(), FlowRow, STATUS_COLORS, STATUS_LABELS, TEMPLATE_ICONS, TemplateSummary, CATEGORIES (+12 more)

### Community 14 - "Contacts & Deals Management"
Cohesion: 0.15
Nodes (22): ContactDetailView(), ContactDetailViewProps, ADD_NODE_TYPES, NODE_TYPES, isTabValue(), TAB_VALUES, TabValue, ContactCustomValue (+14 more)

### Community 15 - "DealCard / DealCardProps"
Cohesion: 0.17
Nodes (23): CURRENCIES, CurrencyOption, formatCurrency(), DealCard(), DealCardProps, formatDate(), initials(), DealFormProps (+15 more)

### Community 16 - "contactFields / SAMPLE CONTACT"
Cohesion: 0.10
Nodes (23): NextNodeRow(), NodeKeySelect(), TextRow(), ConditionCfg, ConditionForm(), MEDIA_ACCEPT, SendButtonsCfg, SendListCfg (+15 more)

### Community 17 - "BroadcastResult / NewRecipient"
Cohesion: 0.27
Nodes (21): resolveWorkspaceId(), SendInput, SendTemplateArgs, SendTextArgs, sendViaProvider(), BroadcastResult, NewRecipient, POST() (+13 more)

### Community 18 - "AdminDashboard / UserProfile"
Cohesion: 0.12
Nodes (18): AdminDashboard(), ALL_CHANNELS, DealLostReason, DealSource, GROWTH_LIMITS, Prospect, STATUS_CONFIG, UserProfile (+10 more)

### Community 19 - "AuthContext / AuthContextValue"
Cohesion: 0.14
Nodes (17): DashboardShell(), DashboardShellInner(), DashboardLayout(), metadata, AuthProvider(), useAuth(), useTotalUnread(), WorkspacePermissions (+9 more)

### Community 20 - "engineSendTemplate / engineSendText"
Cohesion: 0.07
Nodes (39): GET(), GET(), DeleteMessageTemplateArgs, downloadMedia(), DownloadMediaArgs, EditMessageTemplateArgs, EditMessageTemplateResult, getMediaUrl() (+31 more)

### Community 21 - "buckets / Entry"
Cohesion: 0.15
Nodes (13): buckets, Entry, RateLimitOptions, __resetRateLimitForTests(), sweepExpired(), body, OPTS, other (+5 more)

### Community 22 - "BuilderStep / AUTOMATION TEMPLATES"
Cohesion: 0.25
Nodes (15): BuilderStep, StepListProps, DispatchInput, AUTOMATION_TEMPLATES, AutomationTemplateDefinition, TemplateSlug, TemplateStepSeed, expandFromSeeds() (+7 more)

### Community 23 - "AudienceConfig / BroadcastApiResult"
Cohesion: 0.08
Nodes (30): categoryColors, Step1ChooseTemplate(), Step1Props, AudienceConfig, audienceOptions, AudienceType, CustomFieldFilter, CustomFieldOperator (+22 more)

### Community 24 - "RealtimeEvent / UseRealtimeOptions"
Cohesion: 0.10
Nodes (21): applyEdgeConnection(), CanvasEdge, deriveCanvasEdges(), OutgoingSlot, outgoingSlots(), unlinkNodeReferences(), NodeCard(), FlowNodeCard() (+13 more)

### Community 25 - "encryption.test / a"
Cohesion: 0.15
Nodes (14): DELETE(), GET(), POST(), encrypt(), a, b, bogusTag, ct (+6 more)

### Community 26 - "isTabValue / SettingsPage"
Cohesion: 0.19
Nodes (13): CustomFieldsSettings(), FieldsAndTagsPanel(), SettingsPage(), SecurityPanel(), SettingsPanelHead(), SettingsRail(), isSection(), RAIL_GROUPS (+5 more)

### Community 27 - "AutomationCard / formatRelative"
Cohesion: 0.23
Nodes (11): ExecuteArgs, AutomationCard(), formatRelative(), TRIGGER_META, triggerMeta, AutomationLogsPage(), StatusBadge(), StepRow() (+3 more)

### Community 28 - "POST / route"
Cohesion: 0.05
Nodes (64): EDITABLE_STATUSES, isDryRun(), collectVariableSlots(), DELETE(), PATCH(), POST(), buildUpsertRow(), upsertTemplateRow() (+56 more)

### Community 29 - "AudienceConfig / audienceOptions"
Cohesion: 0.13
Nodes (23): POST(), generateApiKey(), GeneratedApiKey, hashApiKey(), looksLikeApiKey(), hasScope(), ApiKeyRow, findActiveKeyByHash() (+15 more)

### Community 30 - "scripts / build"
Cohesion: 0.06
Nodes (32): dependencies, bcryptjs, jspdf, jspdf-autotable, mongoose, next, next-auth, react (+24 more)

### Community 31 - "ContactSidebar / ContactSidebarProps"
Cohesion: 0.24
Nodes (20): GET(), PATCH(), GET(), POST(), getCurrentAccount(), requireRole(), toErrorResponse(), GET() (+12 more)

### Community 32 - "inter / metadata"
Cohesion: 0.12
Nodes (25): inter, metadata, RootLayout(), viewport, ThemedToaster(), useIsClient(), readInitialMode(), readInitialTheme() (+17 more)

### Community 33 - "linked-project.json / name"
Cohesion: 0.40
Nodes (4): name, organization_id, organization_slug, ref

### Community 36 - "DashboardLayout / metadata"
Cohesion: 0.09
Nodes (23): BarChart, BarChartEventProps, BarChartProps, BaseEventProps, ChartLegend(), ChartTooltipProps, deepEqual(), HasScrollProps (+15 more)

### Community 38 - "AGENTS.md / This is NOT the Next.js y..."
Cohesion: 0.15
Nodes (23): AccountContext, RequireRole(), RequireRoleProps, ACCOUNT_ROLES, AccountRole, canDeleteAccount(), canEditSettings(), canManageMembers() (+15 more)

### Community 41 - "SECURITY HEADERS / next.config"
Cohesion: 0.14
Nodes (21): DELETE(), GET(), isSuperAdmin(), DELETE(), GET(), isSuperAdmin(), PATCH(), POST() (+13 more)

### Community 43 - "config / postcss.config.mjs"
Cohesion: 0.09
Nodes (23): NodeEditSheet(), StatusBadge(), cn(), EVENT_COLOR, EventLine(), EventRow, RunCard(), RunRow (+15 more)

### Community 44 - "LandingPage / page"
Cohesion: 0.12
Nodes (14): channels, features, LandingPage(), stats, testimonials, Plan, PLANS, POST() (+6 more)

### Community 45 - "next-env.d"
Cohesion: 0.22
Nodes (17): ForgotPasswordPage(), AdminLoginPage(), LoginPage(), DealForm(), PipelinesPage(), SPEC_DEFAULT_STAGES, ColorSwatch(), PipelineSettings() (+9 more)

### Community 46 - "vitest.config"
Cohesion: 0.14
Nodes (16): GET(), listFlowTemplates(), PUT(), PutBody, requireOwnership(), DELETE(), GET(), POST() (+8 more)

### Community 47 - "CLAUDE.md"
Cohesion: 0.14
Nodes (18): PresenceMap, usePresence(), UsePresenceResult, derivePresence(), formatLastSeen(), presenceLabel(), PresenceRow, PresenceStatus (+10 more)

### Community 48 - "Community 48"
Cohesion: 0.08
Nodes (24): dependencies, @base-ui/react, class-variance-authority, clsx, @dagrejs/dagre, date-fns, @dnd-kit/core, @dnd-kit/sortable (+16 more)

### Community 49 - "Community 49"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 50 - "Community 50"
Cohesion: 0.15
Nodes (17): FlowBuilder(), CanvasAddNodeButton(), FlowCanvas(), FlowCanvasInner(), FlowEditorShell(), Props, ToggleButton(), useMatchMedia() (+9 more)

### Community 51 - "Community 51"
Cohesion: 0.11
Nodes (17): templateStatusConfig, TemplateStatusDisplay, Account, AutomationLogStatus, AutomationStep, ConditionSubject, ContentType, CustomFormSubmission (+9 more)

### Community 52 - "Community 52"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 53 - "Community 53"
Cohesion: 0.24
Nodes (11): supabaseAdmin(), GET(), POST(), BuilderStepInput, BuilderStepNode, DbStep, InsertRow, insertSteps() (+3 more)

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (18): args, askQuestion(), { createClient }, envContent, envPath, envVars, extractContactName(), fs (+10 more)

### Community 55 - "Community 55"
Cohesion: 0.15
Nodes (12): CustomFieldDef, getAdminClient(), PageProps, PipelineDef, PipelineStageDef, SharedFormPage(), SharedFormClientProps, CustomForm (+4 more)

### Community 56 - "Community 56"
Cohesion: 0.13
Nodes (14): eslintConfig, devDependencies, eslint, eslint-config-next, prettier, prettier-plugin-tailwindcss, tailwindcss, @tailwindcss/postcss (+6 more)

### Community 57 - "Community 57"
Cohesion: 0.24
Nodes (11): dedupeByPhone(), ExistingContact, findExistingContact(), isExactMatch(), normalizeKey(), POST(), corsHeaders(), OPTIONS() (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.36
Nodes (10): clampExpiryDays(), GeneratedToken, generateInviteToken(), inviteExpiresAt(), inviteUrl(), isAccountRole(), getBaseUrl(), isHostAllowed() (+2 more)

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
Cohesion: 0.31
Nodes (7): ROLE_META, ChipVariant, SettingsChip(), StatusDot(), VARIANTS, OverviewCounts, WhatsAppStatus

### Community 63 - "Community 63"
Cohesion: 0.31
Nodes (8): SendInput, SendInteractiveButtonsEngineArgs, SendInteractiveListEngineArgs, SendMediaEngineArgs, SendTextEngineArgs, InteractiveButton, InteractiveListSection, MediaKind

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (8): FlowInput, NodeInput, outgoingEdges(), reachableFromEntry(), validateFlowForActivation(), validateNode(), validateTrigger(), INTERACTIVE_LIMITS

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (7): { createClient }, envContent, envPath, envVars, fs, path, supabase

### Community 66 - "Community 66"
Cohesion: 0.43
Nodes (6): hashInviteToken(), GET(), getClientIp(), getClientIp(), POST(), rpcErrorToResponse()

### Community 67 - "Community 67"
Cohesion: 0.25
Nodes (7): autoLayout(), DEFAULTS, LayoutEdge, LayoutNode, LayoutOptions, LayoutPosition, shouldAutoLayout()

### Community 68 - "Community 68"
Cohesion: 0.29
Nodes (7): CreatedInvite, EXPIRY_OPTIONS, InviteMemberDialog(), InviteMemberDialogProps, InviteRole, ROLE_DESCRIPTIONS, buttonVariants

### Community 69 - "Community 69"
Cohesion: 0.40
Nodes (5): API_SCOPES, ApiScope, isApiScope(), normalizeScopes(), SCOPE_DESCRIPTIONS

### Community 70 - "Community 70"
Cohesion: 0.47
Nodes (5): parseContactCsv(), ParseContactCsvResult, parseCsvLine(), ParsedContactRow, parseTagCell()

### Community 72 - "Community 72"
Cohesion: 0.70
Nodes (4): GET(), POST(), requireUser(), getFlowTemplate()

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (5): overrides, fast-uri, hono, ip-address, postcss

## Knowledge Gaps
- **430 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+425 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `config / postcss.config.mjs` to `Automations UI & Config`, `Dashboard Charts & Activity Feed`, `Automation Visual Builder UI`, `Shared Design System Components`, `Broadcast Campaigns & Analytics`, `TypeScript & Build Configs`, `Real-time Chat UI Components`, `Contacts & Deals Management`, `DealCard / DealCardProps`, `contactFields / SAMPLE CONTACT`, `AdminDashboard / UserProfile`, `AuthContext / AuthContextValue`, `RealtimeEvent / UseRealtimeOptions`, `isTabValue / SettingsPage`, `AutomationCard / formatRelative`, `inter / metadata`, `DashboardLayout / metadata`, `next-env.d`, `CLAUDE.md`, `Community 50`, `Community 55`, `Community 62`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `createClient()` connect `vitest.config` to `Community 66`, `API Routes & Step Trees`, `Automation Execution Engine`, `Community 72`, `SECURITY HEADERS / next.config`, `LandingPage / page`, `BroadcastResult / NewRecipient`, `engineSendTemplate / engineSendText`, `Community 53`, `encryption.test / a`, `POST / route`, `AudienceConfig / audienceOptions`, `ContactSidebar / ContactSidebarProps`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `Button()` connect `TypeScript & Build Configs` to `Automations UI & Config`, `Community 68`, `Automation Visual Builder UI`, `Shared Design System Components`, `Broadcast Campaigns & Analytics`, `config / postcss.config.mjs`, `Real-time Chat UI Components`, `Contacts & Deals Management`, `next-env.d`, `contactFields / SAMPLE CONTACT`, `DealCard / DealCardProps`, `CLAUDE.md`, `AuthContext / AuthContextValue`, `AdminDashboard / UserProfile`, `Community 55`, `AudienceConfig / BroadcastApiResult`, `RealtimeEvent / UseRealtimeOptions`, `AutomationCard / formatRelative`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _430 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Automations UI & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.12302125734961555 - nodes in this community are weakly interconnected._
- **Should `Dashboard Charts & Activity Feed` be split into smaller, more focused modules?**
  _Cohesion score 0.06835443037974684 - nodes in this community are weakly interconnected._
- **Should `Automation Execution Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.1443850267379679 - nodes in this community are weakly interconnected._