import type { MessageTemplate } from "@/types";
import type { SendTimeParams } from "./template-send-builder";

/** Media kinds an agent can send from the inbox composer. */
export type ProviderMediaKind = "image" | "video" | "document" | "audio";

export interface WhatsAppProvider {
  /**
   * Validates the provider configuration and credentials.
   * Returns details about the verified account.
   */
  verifyConfig(credentials: {
    phoneId: string;
    wabaId?: string;
    token: string;
  }): Promise<{ verifiedName: string; quality?: string }>;

  /**
   * Sends a free-form outbound text message.
   * `contextMessageId` (the provider's id of the message being replied
   * to) renders the send as a quoted reply where supported; providers
   * without reply support simply ignore it.
   */
  sendMessage(args: {
    phoneId: string;
    wabaId?: string;
    token: string;
    to: string;
    text: string;
    contextMessageId?: string;
  }): Promise<{ messageId: string }>;

  /**
   * Sends a pre-approved message template.
   * - `language` is the template's language code (defaults to en_US
   *   downstream when omitted).
   * - `template` + `messageParams` drive the structured send path
   *   (media headers, URL-button variables) where the provider
   *   supports it; `params` remains the legacy body-only shape.
   */
  sendTemplate(args: {
    phoneId: string;
    wabaId?: string;
    token: string;
    to: string;
    templateName: string;
    params?: string[];
    language?: string;
    template?: MessageTemplate;
    messageParams?: SendTimeParams;
    contextMessageId?: string;
  }): Promise<{ messageId: string }>;

  /**
   * Sends an image / video / document / audio message via a public URL.
   * Optional — providers that can't deliver media omit it and callers
   * surface a clear "not supported" error instead of silently sending
   * the caption as text.
   */
  sendMedia?(args: {
    phoneId: string;
    wabaId?: string;
    token: string;
    to: string;
    kind: ProviderMediaKind;
    /** Public URL the provider fetches at send time. */
    link: string;
    caption?: string;
    /** Document-only display file name. */
    filename?: string;
    contextMessageId?: string;
  }): Promise<{ messageId: string }>;
}
