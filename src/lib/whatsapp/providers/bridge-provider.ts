// ============================================================
// Bridge provider — the Dailybuz WhatsApp Bridge (whatsapp-bridge/),
// our own service speaking the WhatsApp Web multi-device protocol.
//
// No Meta account, no per-conversation charges, no template approvals:
// the tenant pairs by QR (Settings → WhatsApp → "WhatsApp Web"), and
// this provider relays sends to the bridge's REST API.
//
// Divergences from the Cloud API providers, all deliberate:
//   • `phoneId` is the BRIDGE INSTANCE id (the workspace id), not a
//     Meta phone_number_id, and `token` is ignored — the bridge trusts
//     one server-side key (WHATSAPP_BRIDGE_API_KEY), never per-tenant
//     credentials.
//   • `sendTemplate` renders the template's body text locally and sends
//     it as a plain message. The unofficial protocol has no template
//     registry and no 24-hour window, so "a template" is just words.
// ============================================================

import type { MessageTemplate } from "@/types";
import type { ProviderMediaKind, WhatsAppProvider } from "../provider-interface";
import type { SendTimeParams } from "../template-send-builder";

function bridgeEnv(): { url: string; key: string } {
  const url = (process.env.WHATSAPP_BRIDGE_URL || "").replace(/\/+$/, "");
  const key = process.env.WHATSAPP_BRIDGE_API_KEY || "";
  if (!url || !key) {
    throw new Error(
      "The WhatsApp Bridge is not configured on the server (WHATSAPP_BRIDGE_URL / WHATSAPP_BRIDGE_API_KEY).",
    );
  }
  return { url, key };
}

async function bridgeFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Record<string, unknown>> {
  const { url, key } = bridgeEnv();
  const res = await fetch(`${url}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "X-Bridge-Key": key,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : `Bridge request failed (${res.status})`,
    );
  }
  return json;
}

/** {{1}}, {{2}}… replaced positionally — how Meta renders the same body. */
export function renderTemplateBody(body: string, params: string[] = []): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n) => {
    const idx = Number(n) - 1;
    return params[idx] !== undefined ? params[idx] : whole;
  });
}

export class BridgeProvider implements WhatsAppProvider {
  async verifyConfig(credentials: { phoneId: string }): Promise<{ verifiedName: string; quality?: string }> {
    const status = await bridgeFetch(`/instances/${encodeURIComponent(credentials.phoneId)}`);
    if (status.status !== "connected") {
      throw new Error(
        "This workspace's WhatsApp Web instance is not connected — scan the QR in Settings → WhatsApp.",
      );
    }
    const name = (status.push_name as string) || (status.phone as string) || "WhatsApp Web";
    return { verifiedName: name, quality: "unofficial" };
  }

  async sendMessage(args: {
    phoneId: string;
    to: string;
    text: string;
    contextMessageId?: string;
  }): Promise<{ messageId: string }> {
    const json = await bridgeFetch(
      `/instances/${encodeURIComponent(args.phoneId)}/send/text`,
      {
        method: "POST",
        body: { to: args.to, text: args.text, quoted_id: args.contextMessageId },
      },
    );
    return { messageId: String(json.message_id ?? "") };
  }

  async sendTemplate(args: {
    phoneId: string;
    to: string;
    templateName: string;
    params?: string[];
    template?: MessageTemplate;
    messageParams?: SendTimeParams;
    contextMessageId?: string;
  }): Promise<{ messageId: string }> {
    // Body params may arrive as the legacy positional array or inside
    // the structured send-time params; positional wins when both exist.
    const params =
      args.params && args.params.length > 0
        ? args.params
        : (args.messageParams?.body ?? []);
    const body = args.template?.body_text;
    const text = body
      ? renderTemplateBody(body, params)
      : [args.templateName.replaceAll("_", " "), ...params].join(" — ");
    const footer = args.template?.footer_text;
    return this.sendMessage({
      phoneId: args.phoneId,
      to: args.to,
      text: footer ? `${text}\n\n${footer}` : text,
      contextMessageId: args.contextMessageId,
    });
  }

  async sendMedia(args: {
    phoneId: string;
    to: string;
    kind: ProviderMediaKind;
    link: string;
    caption?: string;
    filename?: string;
    contextMessageId?: string;
  }): Promise<{ messageId: string }> {
    const json = await bridgeFetch(
      `/instances/${encodeURIComponent(args.phoneId)}/send/media`,
      {
        method: "POST",
        body: {
          to: args.to,
          url: args.link,
          kind: args.kind,
          caption: args.caption ?? "",
          filename: args.filename ?? "",
        },
      },
    );
    return { messageId: String(json.message_id ?? "") };
  }
}

// Instance-lifecycle helpers for the settings flow (not part of the
// send interface): pairing, live status, unlinking.
export async function bridgePair(instanceId: string) {
  return bridgeFetch(`/instances/${encodeURIComponent(instanceId)}/pair`, { method: "POST" });
}
export async function bridgeStatus(instanceId: string) {
  return bridgeFetch(`/instances/${encodeURIComponent(instanceId)}`);
}
export async function bridgeLogout(instanceId: string) {
  return bridgeFetch(`/instances/${encodeURIComponent(instanceId)}/logout`, { method: "POST" });
}
