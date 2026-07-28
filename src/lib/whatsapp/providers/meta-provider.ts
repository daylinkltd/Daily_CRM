import { WhatsAppProvider, ProviderMediaKind } from "../provider-interface";
import type { MessageTemplate } from "@/types";
import type { SendTimeParams } from "../template-send-builder";
import {
  verifyPhoneNumber,
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
} from "../meta-api";

export class MetaProvider implements WhatsAppProvider {
  async verifyConfig(credentials: {
    phoneId: string;
    wabaId?: string;
    token: string;
  }): Promise<{ verifiedName: string; quality?: string }> {
    const info = await verifyPhoneNumber({
      phoneNumberId: credentials.phoneId,
      accessToken: credentials.token,
    });
    return {
      verifiedName: info.verified_name || info.display_phone_number,
      quality: info.quality_rating || "UNKNOWN",
    };
  }

  async sendMessage(args: {
    phoneId: string;
    token: string;
    to: string;
    text: string;
    contextMessageId?: string;
  }): Promise<{ messageId: string }> {
    return sendTextMessage({
      phoneNumberId: args.phoneId,
      accessToken: args.token,
      to: args.to,
      text: args.text,
      contextMessageId: args.contextMessageId,
    });
  }

  async sendTemplate(args: {
    phoneId: string;
    token: string;
    to: string;
    templateName: string;
    params?: string[];
    language?: string;
    template?: MessageTemplate;
    messageParams?: SendTimeParams;
    contextMessageId?: string;
  }): Promise<{ messageId: string }> {
    return sendTemplateMessage({
      phoneNumberId: args.phoneId,
      accessToken: args.token,
      to: args.to,
      templateName: args.templateName,
      params: args.params,
      language: args.language,
      template: args.template,
      messageParams: args.messageParams,
      contextMessageId: args.contextMessageId,
    });
  }

  async sendMedia(args: {
    phoneId: string;
    token: string;
    to: string;
    kind: ProviderMediaKind;
    link: string;
    caption?: string;
    filename?: string;
    contextMessageId?: string;
  }): Promise<{ messageId: string }> {
    return sendMediaMessage({
      phoneNumberId: args.phoneId,
      accessToken: args.token,
      to: args.to,
      kind: args.kind,
      link: args.link,
      caption: args.caption,
      filename: args.filename,
      contextMessageId: args.contextMessageId,
    });
  }
}
