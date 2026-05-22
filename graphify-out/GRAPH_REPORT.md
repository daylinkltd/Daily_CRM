# Graph Report - .  (2026-05-20)

## Corpus Check
- 171 files · ~91,298 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 824 nodes · 2061 edges · 48 communities (39 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_config  postcss.config.mjs|config / postcss.config.mjs]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 125 edges
2. `AutomationBuilder()` - 51 edges
3. `Button()` - 46 edges
4. `TemplateManager()` - 42 edges
5. `ContactDetailView()` - 39 edges
6. `createClient()` - 38 edges
7. `WhatsAppConfig` - 30 edges
8. `Input()` - 30 edges
9. `MessageThread()` - 30 edges
10. `TagManager()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `cn()` --calls--> `clsx`  [INFERRED]
  src/lib/utils.ts → package.json
- `MessageBubble()` --calls--> `format`  [INFERRED]
  src/components/inbox/message-bubble.tsx → package.json
- `formatDateSeparator()` --calls--> `format`  [INFERRED]
  src/components/inbox/message-thread.tsx → package.json
- `groupMessagesByDate()` --calls--> `format`  [INFERRED]
  src/components/inbox/message-thread.tsx → package.json
- `AdminDashboard()` --calls--> `useAuth()`  [EXTRACTED]
  src/app/saas-admin/dashboard/page.tsx → src/hooks/use-auth.tsx

## Communities (48 total, 9 thin omitted)

### Community 0 - "Automations UI & Config"
Cohesion: 0.07
Nodes (82): TEMPLATE_ICON, TEMPLATE_ORDER, categoryColors, Step1Props, AudienceConfig, Step4Props, Step4ScheduleSend(), ContactForm() (+74 more)

### Community 1 - "Dashboard Charts & Activity Feed"
Cohesion: 0.06
Nodes (52): ActivityFeed(), ActivityFeedProps, KIND_THEME, KindTheme, PAGE_SIZES, PageSize, LineSvg(), longDayLabel() (+44 more)

### Community 2 - "Project Package Dependencies"
Cohesion: 0.04
Nodes (47): author, bugs, url, dependencies, @base-ui/react, class-variance-authority, clsx, date-fns (+39 more)

### Community 3 - "API Routes & Step Trees"
Cohesion: 0.10
Nodes (30): supabaseAdmin(), AutomationContext, POST(), BuilderStepInput, BuilderStepNode, DbStep, InsertRow, insertSteps() (+22 more)

### Community 4 - "Automation Execution Engine"
Cohesion: 0.09
Nodes (34): appendResults(), DispatchInput, evaluateCondition(), ExecuteArgs, executeAutomation(), executeStepsFrom(), finalizeLog(), interpolate() (+26 more)

### Community 5 - "Automation Visual Builder UI"
Cohesion: 0.06
Nodes (17): ADDABLE_STEPS, ApiStep, AutomationBuilder(), BranchColumn(), BuilderInitial, fromServerSteps(), ParentScope, previewFor() (+9 more)

### Community 6 - "Shared Design System Components"
Cohesion: 0.10
Nodes (20): DeltaRow(), MetricCard(), MetricCardProps, cn(), AlertAction(), CardAction(), CardFooter(), DialogOverlay() (+12 more)

### Community 7 - "Broadcast Campaigns & Analytics"
Cohesion: 0.12
Nodes (21): percent(), RateCell(), BroadcastDetailPage(), FunnelStep, RECIPIENT_STATUSES, StatCardProps, broadcastStatusConfig, getBroadcastStatus() (+13 more)

### Community 8 - "WhatsApp Integration Providers"
Cohesion: 0.13
Nodes (17): GET(), MetaProvider, MockProvider, formatTwilioNumber(), TwilioProvider, downloadMedia(), DownloadMediaArgs, getMediaUrl() (+9 more)

### Community 9 - "Webhook Processing & Security"
Cohesion: 0.14
Nodes (22): ContactOutcome, ContactRow, findOrCreateContact(), findOrCreateConversation(), flagBroadcastReplyIfAny(), GET(), handleStatusUpdate(), isValidStatusTransition() (+14 more)

### Community 10 - "Workspace Tooling Configurations"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "Contribution Documentation"
Cohesion: 0.10
Nodes (19): code:bash (# 1. Fork on GitHub: https://github.com/ArnasDon/wacrm → For), code:bash (git remote add upstream https://github.com/ArnasDon/wacrm.gi), Dev-loop reference, Fork and run, If you maintain a public fork, Keeping your fork up to date, Licensing, Reporting bugs in the upstream template (+11 more)

### Community 12 - "TypeScript & Build Configs"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 13 - "Real-time Chat UI Components"
Cohesion: 0.15
Nodes (12): format, MessageBubble(), MessageComposer(), MessageComposerProps, formatDateSeparator(), groupMessagesByDate(), MessageThread(), MessageThreadProps (+4 more)

### Community 14 - "Contacts & Deals Management"
Cohesion: 0.18
Nodes (13): ContactDetailView(), ContactDetailViewProps, DealFormProps, ContactCustomValue, DealStatus, Sheet(), SheetContent(), SheetDescription() (+5 more)

### Community 15 - "DealCard / DealCardProps"
Cohesion: 0.14
Nodes (11): DealCard(), DealCardProps, PipelineAnalytics(), formatCurrency(), PipelineBoard(), StageColumn(), PipelineStage, Tooltip() (+3 more)

### Community 16 - "contactFields / SAMPLE CONTACT"
Cohesion: 0.15
Nodes (18): contactFields, SAMPLE_CONTACT, Step3Personalize(), Step3Props, VariableMapping, VariableType, MemberWithProfile, ProfileDetail (+10 more)

### Community 17 - "BroadcastResult / NewRecipient"
Cohesion: 0.28
Nodes (15): BroadcastResult, NewRecipient, POST(), checkRateLimit(), RATE_LIMITS, rateLimitResponse(), POST(), isRecipientNotAllowedError() (+7 more)

### Community 18 - "AdminDashboard / UserProfile"
Cohesion: 0.17
Nodes (13): AdminDashboard(), UserProfile, WorkspaceDetail, bottomNavItems, navItems, Sidebar(), SidebarProps, Avatar() (+5 more)

### Community 19 - "AuthContext / AuthContextValue"
Cohesion: 0.22
Nodes (11): AuthContext, AuthContextValue, AuthProvider(), Profile, useAuth(), WorkspaceProvider(), getPageTitle(), Header() (+3 more)

### Community 20 - "engineSendTemplate / engineSendText"
Cohesion: 0.24
Nodes (13): engineSendTemplate(), engineSendText(), resolveWorkspaceId(), SendInput, SendTemplateArgs, SendTextArgs, sendViaProvider(), DELETE() (+5 more)

### Community 21 - "buckets / Entry"
Cohesion: 0.13
Nodes (13): buckets, Entry, RateLimitOptions, RateLimitResult, sweepExpired(), body, OPTS, other (+5 more)

### Community 22 - "BuilderStep / AUTOMATION TEMPLATES"
Cohesion: 0.18
Nodes (8): BuilderStep, AUTOMATION_TEMPLATES, AutomationTemplateDefinition, TemplateSlug, TemplateStepSeed, SeedRow, AutomationStepConfig, AutomationTriggerConfig

### Community 23 - "AudienceConfig / BroadcastApiResult"
Cohesion: 0.15
Nodes (9): AudienceConfig, BroadcastApiResult, BroadcastPayload, CustomFieldFilter, CustomFieldOperator, CustomValueIndex, UseBroadcastSendingReturn, VariableMapping (+1 more)

### Community 24 - "RealtimeEvent / UseRealtimeOptions"
Cohesion: 0.23
Nodes (10): RealtimeEvent, UseRealtimeOptions, ConversationItem(), ConversationListProps, FILTER_OPTIONS, STATUS_COLORS, InboxPage(), Conversation (+2 more)

### Community 25 - "encryption.test / a"
Cohesion: 0.17
Nodes (10): a, b, bogusTag, ct, [, ctHex, tagHex], [ivHex, ctHex], legacy, modern (+2 more)

### Community 26 - "isTabValue / SettingsPage"
Cohesion: 0.29
Nodes (9): isTabValue(), SettingsPage(), TAB_VALUES, TabValue, Tabs(), TabsContent(), TabsList(), tabsListVariants (+1 more)

### Community 27 - "AutomationCard / formatRelative"
Cohesion: 0.24
Nodes (7): AutomationCard(), formatRelative(), StatusBadge(), StepRow(), Automation, AutomationLogStepResult, AutomationTriggerType

### Community 28 - "POST / route"
Cohesion: 0.29
Nodes (6): createClient(), MetaTemplate, MetaTemplateComponent, normalizeCategory(), normalizeStatus(), POST()

### Community 29 - "AudienceConfig / audienceOptions"
Cohesion: 0.22
Nodes (8): AudienceConfig, audienceOptions, AudienceType, CustomFieldFilter, CustomFieldOperator, OPERATOR_OPTIONS, Step2Props, CustomField

### Community 30 - "scripts / build"
Cohesion: 0.22
Nodes (9): scripts, build, dev, format:check, lint, start, test, test:watch (+1 more)

### Community 31 - "ContactSidebar / ContactSidebarProps"
Cohesion: 0.25
Nodes (7): ContactSidebar(), ContactSidebarProps, Contact, ContactNote, Deal, ScrollArea(), ScrollBar()

### Community 32 - "inter / metadata"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 33 - "linked-project.json / name"
Cohesion: 0.40
Nodes (4): name, organization_id, organization_slug, ref

## Knowledge Gaps
- **286 isolated node(s):** `config`, `name`, `version`, `private`, `description` (+281 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Shared Design System Components` to `Automations UI & Config`, `Dashboard Charts & Activity Feed`, `Project Package Dependencies`, `Automation Visual Builder UI`, `Broadcast Campaigns & Analytics`, `Real-time Chat UI Components`, `Contacts & Deals Management`, `DealCard / DealCardProps`, `contactFields / SAMPLE CONTACT`, `AdminDashboard / UserProfile`, `RealtimeEvent / UseRealtimeOptions`, `isTabValue / SettingsPage`, `AutomationCard / formatRelative`, `ContactSidebar / ContactSidebarProps`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Why does `AutomationBuilder()` connect `Automation Visual Builder UI` to `Automations UI & Config`, `Automation Execution Engine`, `Shared Design System Components`, `Real-time Chat UI Components`, `Contacts & Deals Management`, `BuilderStep / AUTOMATION TEMPLATES`, `AutomationCard / formatRelative`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `config`, `name`, `version` to the rest of the system?**
  _286 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Automations UI & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.07412319481284999 - nodes in this community are weakly interconnected._
- **Should `Dashboard Charts & Activity Feed` be split into smaller, more focused modules?**
  _Cohesion score 0.06299603174603174 - nodes in this community are weakly interconnected._
- **Should `Project Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `API Routes & Step Trees` be split into smaller, more focused modules?**
  _Cohesion score 0.09986504723346828 - nodes in this community are weakly interconnected._