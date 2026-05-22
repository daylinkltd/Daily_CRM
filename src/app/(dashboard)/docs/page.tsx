export default function DocsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Documentation & Manuals</h1>
        <p className="text-sm text-slate-400 mt-1">
          Guides for integrating Daily CRM into your organization.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">Quick Start Guides</h2>
          <ul className="mt-4 space-y-2 text-slate-300">
            <li><a href="#" className="text-[#00aef0] hover:underline">Connecting WhatsApp Business API</a></li>
            <li><a href="#" className="text-[#00aef0] hover:underline">Linking Instagram DMs</a></li>
            <li><a href="#" className="text-[#00aef0] hover:underline">Setting up Team Members and Workspaces</a></li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">Platform Manuals</h2>
          <p className="text-sm text-slate-400 mt-2">More extensive API and webhook documentation is currently being written by our team. Check back here for comprehensive guides on Google Workspace, Zoho, Microsoft Outlook, and Meta integrations.</p>
        </div>
      </div>
    </div>
  );
}
