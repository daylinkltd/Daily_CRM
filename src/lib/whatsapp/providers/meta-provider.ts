import { WhatsAppProvider } from "../provider-interface";
import {
  verifyPhoneNumber,
  sendTextMessage,
  sendTemplateMessage,
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
  }): Promise<{ messageId: string }> {
    return sendTextMessage({
      phoneNumberId: args.phoneId,
      accessToken: args.token,
      to: args.to,
      text: args.text,
    });
  }

  async sendTemplate(args: {
    phoneId: string;
    token: string;
    to: string;
    templateName: string;
    params?: string[];
  }): Promise<{ messageId: string }> {
    return sendTemplateMessage({
      phoneNumberId: args.phoneId,
      accessToken: args.token,
      to: args.to,
      templateName: args.templateName,
      params: args.params,
    });
  }
}
