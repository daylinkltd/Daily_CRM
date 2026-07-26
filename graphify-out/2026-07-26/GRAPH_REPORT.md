# Graph Report - Daily_CRM  (2026-07-26)

## Corpus Check
- 446 files · ~1,217,045 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2122 nodes · 7717 edges · 96 communities (82 shown, 14 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `65982786`
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
- [[_COMMUNITY_Community 67|Community 67]]
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
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 104|Community 104]]

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 213 edges
2. `cn()` - 197 edges
3. `useWorkspace()` - 170 edges
4. `Button()` - 158 edges
5. `createClient()` - 117 edges
6. `Input()` - 109 edges
7. `Label()` - 80 edges
8. `useAuth()` - 75 edges
9. `Card()` - 62 edges
10. `CardContent()` - 61 edges

## Surprising Connections (you probably didn't know these)
- `EmployeeProfilePage()` --calls--> `useWorkspace()`  [INFERRED]
  src/app/(dashboard)/employees/[id]/page.tsx → src/hooks/use-workspace.tsx
- `SignupPageInner()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(auth)/signup/page.tsx → src/lib/supabase/client.ts
- `DashboardPage()` --calls--> `useAuth()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/hooks/use-auth.tsx
- `DashboardPage()` --calls--> `useWorkspace()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/hooks/use-workspace.tsx
- `DashboardPage()` --calls--> `formatCurrency()`  [INFERRED]
  src/app/(dashboard)/dashboard/page.tsx → src/lib/currency.ts

## Import Cycles
- None detected.

## Communities (96 total, 14 thin omitted)

### Community 0 - "Automations UI & Config"
Cohesion: 0.12
Nodes (51): AudienceConfig, Step4Props, Step4ScheduleSend(), ContactForm(), ContactFormProps, CustomFieldsManager(), CustomFieldsManagerProps, ImportModal() (+43 more)

### Community 1 - "Dashboard Charts & Activity Feed"
Cohesion: 0.25
Nodes (19): GET(), PATCH(), GET(), POST(), getCurrentAccount(), requireRole(), toErrorResponse(), GET() (+11 more)

### Community 2 - "Project Package Dependencies"
Cohesion: 0.33
Nodes (6): url, bugs, url, repository, type, url

### Community 3 - "API Routes & Step Trees"
Cohesion: 0.12
Nodes (30): appendResults(), AutomationContext, DispatchInput, evaluateCondition(), executeAutomation(), executeStepsFrom(), finalizeLog(), interpolate() (+22 more)

### Community 4 - "Automation Execution Engine"
Cohesion: 0.12
Nodes (32): GET(), POST(), BuilderStepInput, BuilderStepNode, DbStep, InsertRow, insertSteps(), loadStepsTree() (+24 more)

### Community 5 - "Automation Visual Builder UI"
Cohesion: 0.12
Nodes (32): ADDABLE_STEPS, AddButton(), ApiStep, AutomationBuilder(), blankConfig(), BranchColumn(), cid(), ConditionBranches() (+24 more)

### Community 6 - "Shared Design System Components"
Cohesion: 0.14
Nodes (27): RealtimeEvent, useRealtime(), ContactSidebar(), ContactSidebarProps, ConversationItem(), ConversationItemProps, ConversationList(), ConversationListProps (+19 more)

### Community 7 - "Broadcast Campaigns & Analytics"
Cohesion: 0.22
Nodes (22): IntegrationsPage(), EmailConfig(), FormsConfig(), ConnectionStatus, InstagramConfig(), MessengerConfig(), SheetsConfig(), SmsConfig() (+14 more)

### Community 8 - "WhatsApp Integration Providers"
Cohesion: 0.17
Nodes (8): ApiAutoProvider, MetaProvider, MockProvider, formatTwilioNumber(), TwilioProvider, sendTemplateMessage(), sendTextMessage(), WhatsAppProvider

### Community 9 - "Webhook Processing & Security"
Cohesion: 0.11
Nodes (34): dedupeByPhone(), ExistingContact, findExistingContact(), isExactMatch(), normalizeKey(), POST(), corsHeaders(), OPTIONS() (+26 more)

### Community 10 - "Workspace Tooling Configurations"
Cohesion: 0.06
Nodes (57): AdminClient, advanceCurrentNodeKey(), advanceFromNodeKey(), dispatchInboundToFlows(), endRun(), evaluateConditionNode(), evaluateConditionPredicate(), executeHandoff() (+49 more)

### Community 11 - "Contribution Documentation"
Cohesion: 0.09
Nodes (22): Dev-loop reference, Fork and run, If you maintain a public fork, Keeping your fork up to date, Licensing, Reporting bugs in the upstream template, Reporting security issues, Upstream pull requests (+14 more)

### Community 12 - "TypeScript & Build Configs"
Cohesion: 0.11
Nodes (34): AdminLoginPage(), LoginPage(), PageProps, SectionWithItems, PlanningView(), PlanningViewProps, ProjectInvoicesProps, ProjectTimesheet() (+26 more)

### Community 13 - "Real-time Chat UI Components"
Cohesion: 0.06
Nodes (35): templateStatusConfig, TemplateStatusDisplay, Account, Attendance, AutomationLogStatus, ConditionSubject, ContentType, CustomFormSubmission (+27 more)

### Community 14 - "Contacts & Deals Management"
Cohesion: 0.10
Nodes (32): collectVariableSlots(), TemplateFormData, TemplateButton, TemplateSampleValues, buildBodyComponent(), buildButtonsComponent(), buildFooterComponent(), buildHeaderComponent() (+24 more)

### Community 15 - "DealCard / DealCardProps"
Cohesion: 0.08
Nodes (52): AssignAssetFormProps, DOCUMENT_TYPES, UploadDocumentFormProps, EmployeeProfileOverviewProps, OnboardEmployeeFormProps, CustomFieldDef, PipelineDef, PipelineStageDef (+44 more)

### Community 16 - "contactFields / SAMPLE CONTACT"
Cohesion: 0.08
Nodes (32): categoryColors, Step1ChooseTemplate(), Step1Props, AudienceConfig, audienceOptions, AudienceType, CustomFieldFilter, CustomFieldOperator (+24 more)

### Community 17 - "BroadcastResult / NewRecipient"
Cohesion: 0.14
Nodes (34): supabaseAdmin(), resolveConversationId(), runStep(), engineSendTemplate(), engineSendText(), resolveWorkspaceId(), SendInput, SendTemplateArgs (+26 more)

### Community 18 - "AdminDashboard / UserProfile"
Cohesion: 0.43
Nodes (6): hashInviteToken(), GET(), getClientIp(), getClientIp(), POST(), rpcErrorToResponse()

### Community 19 - "AuthContext / AuthContextValue"
Cohesion: 0.05
Nodes (70): AssignAssetForm(), AssetsPage(), AttendancePage(), PunchAction(), PolicyAuditPage(), CustomFieldsPanel(), ContactsPage(), ProjectDashboardPage() (+62 more)

### Community 20 - "engineSendTemplate / engineSendText"
Cohesion: 0.05
Nodes (56): SendInput, SendInteractiveButtonsEngineArgs, SendInteractiveListEngineArgs, SendMediaEngineArgs, SendTextEngineArgs, EDITABLE_STATUSES, isDryRun(), getWorkspaceUsageAndLimits() (+48 more)

### Community 21 - "buckets / Entry"
Cohesion: 0.36
Nodes (5): DashboardShell(), DashboardShellInner(), DashboardLayout(), metadata, WorkspaceProvider()

### Community 22 - "BuilderStep / AUTOMATION TEMPLATES"
Cohesion: 0.14
Nodes (12): NextNodeRow(), TextRow(), ConditionCfg, ConditionForm(), MEDIA_ACCEPT, SendButtonsCfg, SendListCfg, SendMediaCfg (+4 more)

### Community 23 - "AudienceConfig / BroadcastApiResult"
Cohesion: 0.16
Nodes (18): EditQuotationPage(), AuthProvider(), useAuth(), usePresence(), OnboardingPage(), QuotationPreviewPage(), QuotationsPage(), AdminLayout() (+10 more)

### Community 24 - "RealtimeEvent / UseRealtimeOptions"
Cohesion: 0.17
Nodes (14): ComposerMediaKind, formatDuration(), MediaDraft, MediaDraftPreview(), MessageComposer(), MessageComposerProps, PICKER_ACCEPT, ReplyDraft (+6 more)

### Community 25 - "encryption.test / a"
Cohesion: 0.17
Nodes (10): a, b, bogusTag, ct, [, ctHex, tagHex], [ivHex, ctHex], legacy, modern (+2 more)

### Community 26 - "isTabValue / SettingsPage"
Cohesion: 0.16
Nodes (15): ROLE_META, ChipVariant, SettingsChip(), StatusDot(), VARIANTS, OverviewCounts, WhatsAppStatus, SettingsRail() (+7 more)

### Community 27 - "AutomationCard / formatRelative"
Cohesion: 0.07
Nodes (34): POST(), computeSHA256(), POST(), DELETE(), GET(), POST(), GET(), GET() (+26 more)

### Community 28 - "POST / route"
Cohesion: 0.17
Nodes (21): AccountContext, RequireRole(), RequireRoleProps, ACCOUNT_ROLES, AccountRole, canDeleteAccount(), canEditSettings(), canManageMembers() (+13 more)

### Community 29 - "AudienceConfig / audienceOptions"
Cohesion: 0.10
Nodes (31): generateApiKey(), GeneratedApiKey, hashApiKey(), looksLikeApiKey(), API_SCOPES, ApiScope, hasScope(), isApiScope() (+23 more)

### Community 30 - "scripts / build"
Cohesion: 0.06
Nodes (32): dependencies, bcryptjs, jspdf, jspdf-autotable, mongoose, next, next-auth, react (+24 more)

### Community 31 - "ContactSidebar / ContactSidebarProps"
Cohesion: 0.14
Nodes (14): buckets, Entry, RateLimitOptions, RateLimitResult, __resetRateLimitForTests(), sweepExpired(), body, OPTS (+6 more)

### Community 32 - "inter / metadata"
Cohesion: 0.12
Nodes (24): inter, metadata, RootLayout(), viewport, ThemedToaster(), useIsClient(), readInitialMode(), readInitialTheme() (+16 more)

### Community 33 - "linked-project.json / name"
Cohesion: 0.40
Nodes (4): name, organization_id, organization_slug, ref

### Community 36 - "DashboardLayout / metadata"
Cohesion: 0.09
Nodes (23): BarChart, BarChartEventProps, BarChartProps, BaseEventProps, ChartLegend(), ChartTooltipProps, deepEqual(), HasScrollProps (+15 more)

### Community 38 - "AGENTS.md / This is NOT the Next.js y..."
Cohesion: 0.07
Nodes (38): applyEdgeConnection(), CanvasEdge, deriveCanvasEdges(), OutgoingSlot, unlinkNodeReferences(), FlowBuilder(), NodeCard(), CanvasAddNodeButton() (+30 more)

### Community 41 - "SECURITY HEADERS / next.config"
Cohesion: 0.07
Nodes (35): channels, features, LandingPage(), stats, testimonials, Plan, PLANS, POST() (+27 more)

### Community 43 - "config / postcss.config.mjs"
Cohesion: 0.08
Nodes (33): DeltaRow(), MetricCard(), MetricCardProps, NodeEditSheet(), UseRealtimeOptions, MessageActions(), MessageActionsProps, QUICK_EMOJIS (+25 more)

### Community 44 - "LandingPage / page"
Cohesion: 0.19
Nodes (21): formatCurrency(), DealCard(), DealCardProps, formatDate(), initials(), DealFormProps, computeStageProbability(), Metric() (+13 more)

### Community 45 - "next-env.d"
Cohesion: 0.33
Nodes (7): ExecuteArgs, AutomationLogsPage(), StatusBadge(), StepRow(), Automation, AutomationLog, AutomationLogStepResult

### Community 46 - "vitest.config"
Cohesion: 0.29
Nodes (7): CreatedInvite, EXPIRY_OPTIONS, InviteMemberDialog(), InviteMemberDialogProps, InviteRole, ROLE_DESCRIPTIONS, buttonVariants

### Community 47 - "CLAUDE.md"
Cohesion: 0.15
Nodes (16): PresenceMap, UsePresenceResult, derivePresence(), formatLastSeen(), presenceLabel(), PresenceRow, PresenceStatus, StoredPresence (+8 more)

### Community 48 - "Community 48"
Cohesion: 0.08
Nodes (24): dependencies, @base-ui/react, class-variance-authority, clsx, @dagrejs/dagre, date-fns, @dnd-kit/core, @dnd-kit/sortable (+16 more)

### Community 49 - "Community 49"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 50 - "Community 50"
Cohesion: 0.38
Nodes (4): CustomFieldsSettings(), FieldsAndTagsPanel(), SecurityPanel(), SettingsPanelHead()

### Community 52 - "Community 52"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

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
Cohesion: 0.07
Nodes (61): ActivityFeed(), ActivityFeedProps, KIND_THEME, KindTheme, PAGE_SIZES, PageSize, relativeTime(), ConversationsChart() (+53 more)

### Community 58 - "Community 58"
Cohesion: 0.09
Nodes (31): ContactDetailView(), ContactDetailViewProps, LocalLineItem, LocalSection, PageProps, outgoingSlots(), ADD_NODE_TYPES, FlowNodeCard() (+23 more)

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
Cohesion: 0.24
Nodes (11): POST(), supabaseAdmin(), GET(), POST(), requireUser(), getFlowTemplate(), PutBody, requireOwnership() (+3 more)

### Community 63 - "Community 63"
Cohesion: 0.12
Nodes (24): POST(), buildUpsertRow(), upsertTemplateRow(), extractSampleValues(), MetaButton, MetaTemplate, MetaTemplateComponent, normalizeCategory() (+16 more)

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (7): { createClient }, envContent, envPath, envVars, fs, path, supabase

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 69 - "Community 69"
Cohesion: 0.18
Nodes (21): BuilderInitial, BuilderStep, AutomationCard(), AutomationsPage(), TEMPLATE_ICON, TEMPLATE_ORDER, AUTOMATION_TEMPLATES, AutomationTemplateDefinition (+13 more)

### Community 70 - "Community 70"
Cohesion: 0.47
Nodes (5): parseContactCsv(), ParseContactCsvResult, parseCsvLine(), ParsedContactRow, parseTagCell()

### Community 71 - "Community 71"
Cohesion: 0.18
Nodes (13): MediaImage(), MediaUnavailable(), MessageBubble(), MessageBubbleProps, MessageContent(), StatusIcon(), MessageReactions(), MessageReactionsProps (+5 more)

### Community 72 - "Community 72"
Cohesion: 0.36
Nodes (10): clampExpiryDays(), GeneratedToken, generateInviteToken(), inviteExpiresAt(), inviteUrl(), isAccountRole(), getBaseUrl(), isHostAllowed() (+2 more)

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (5): overrides, fast-uri, hono, ip-address, postcss

### Community 78 - "Community 78"
Cohesion: 0.22
Nodes (8): describeTrigger(), FlowCard(), FlowRow, FlowsPage(), STATUS_COLORS, STATUS_LABELS, TEMPLATE_ICONS, TemplateSummary

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

### Community 94 - "Community 94"
Cohesion: 0.25
Nodes (7): EVENT_COLOR, EventLine(), EventRow, RunCard(), RunRow, STATUS_META, summarizePayload()

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (8): FlowInput, NodeInput, outgoingEdges(), reachableFromEntry(), validateFlowForActivation(), validateNode(), validateTrigger(), INTERACTIVE_LIMITS

### Community 99 - "Community 99"
Cohesion: 0.06
Nodes (78): BroadcastsPage(), percent(), RateCell(), AdminDashboard(), ALL_CHANNELS, DealLostReason, DealSource, GROWTH_LIMITS (+70 more)

### Community 104 - "Community 104"
Cohesion: 0.67
Nodes (3): getAdminClient(), PageProps, SharedFormPage()

## Knowledge Gaps
- **533 isolated node(s):** `{ createClient }`, `dotenv`, `path`, `supabase`, `{ createClient }` (+528 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `config / postcss.config.mjs` to `Automations UI & Config`, `Automation Visual Builder UI`, `Shared Design System Components`, `Broadcast Campaigns & Analytics`, `TypeScript & Build Configs`, `DealCard / DealCardProps`, `BuilderStep / AUTOMATION TEMPLATES`, `RealtimeEvent / UseRealtimeOptions`, `isTabValue / SettingsPage`, `inter / metadata`, `DashboardLayout / metadata`, `AGENTS.md / This is NOT the Next.js y...`, `LandingPage / page`, `next-env.d`, `CLAUDE.md`, `Community 50`, `Community 57`, `Community 58`, `Community 69`, `Community 71`, `Community 78`, `Community 94`, `Community 99`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `createClient()` connect `AuthContext / AuthContextValue` to `Automations UI & Config`, `Community 99`, `isTabValue / SettingsPage`, `Community 69`, `Shared Design System Components`, `SECURITY HEADERS / next.config`, `TypeScript & Build Configs`, `next-env.d`, `DealCard / DealCardProps`, `contactFields / SAMPLE CONTACT`, `CLAUDE.md`, `AudienceConfig / BroadcastApiResult`, `RealtimeEvent / UseRealtimeOptions`, `Community 57`, `Community 58`, `POST / route`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `createClient()` connect `AutomationCard / formatRelative` to `Dashboard Charts & Activity Feed`, `API Routes & Step Trees`, `Automation Execution Engine`, `SECURITY HEADERS / next.config`, `BroadcastResult / NewRecipient`, `AdminDashboard / UserProfile`, `engineSendTemplate / engineSendText`, `Community 55`, `Community 58`, `Community 62`, `Community 63`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `useWorkspace()` (e.g. with `DashboardPage()` and `ProjectDashboardPage()`) actually correct?**
  _`useWorkspace()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ createClient }`, `dotenv`, `path` to the rest of the system?**
  _533 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Automations UI & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.11989421099030267 - nodes in this community are weakly interconnected._
- **Should `API Routes & Step Trees` be split into smaller, more focused modules?**
  _Cohesion score 0.12063492063492064 - nodes in this community are weakly interconnected._