import { WhatsAppProvider } from "../provider-interface";
import { supabaseAdmin } from "@/lib/automations/admin-client";

function formatTwilioNumber(num: string): string {
  const clean = num.trim();
  if (clean.startsWith("whatsapp:")) return clean;
  return `whatsapp:${clean.startsWith("+") ? clean : "+" + clean}`;
}

export class TwilioProvider implements WhatsAppProvider {
  async verifyConfig(credentials: {
    phoneId: string;
    wabaId?: string;
    token: string;
  }): Promise<{ verifiedName: string; quality?: string }> {
    const accountSid = credentials.wabaId;
    const authToken = credentials.token;

    if (!accountSid) {
      throw new Error("Twilio Account SID (WABA ID field) is required.");
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Twilio authentication failed: ${response.statusText} (${response.status})`);
    }

    const data = await response.json();
    return {
      verifiedName: data.friendly_name || "Twilio Account",
      quality: "GREEN",
    };
  }

  async sendMessage(args: {
    phoneId: string;
    wabaId?: string;
    token: string;
    to: string;
    text: string;
  }): Promise<{ messageId: string }> {
    const accountSid = args.wabaId;
    const authToken = args.token;

    if (!accountSid) {
      throw new Error("Twilio Account SID (WABA ID field) is required to send messages.");
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

    const fromFormatted = formatTwilioNumber(args.phoneId);
    const toFormatted = formatTwilioNumber(args.to);

    const bodyParams = new URLSearchParams({
      From: fromFormatted,
      To: toFormatted,
      Body: args.text,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Twilio send failed: ${errText} (${response.status})`);
    }

    const data = await response.json();
    return { messageId: data.sid };
  }

  async sendTemplate(args: {
    phoneId: string;
    wabaId?: string;
    token: string;
    to: string;
    templateName: string;
    params?: string[];
  }): Promise<{ messageId: string }> {
    const accountSid = args.wabaId;
    const authToken = args.token;

    if (!accountSid) {
      throw new Error("Twilio Account SID (WABA ID field) is required to send templates.");
    }

    // Resolve workspace ID from database to locate correct message template
    const { data: config, error: configError } = await supabaseAdmin()
      .from("whatsapp_config")
      .select("workspace_id")
      .eq("waba_id", accountSid)
      .maybeSingle();

    if (configError || !config) {
      throw new Error(`Failed to resolve workspace details for Twilio Account SID: ${configError?.message || "Not found"}`);
    }

    // Fetch the correct template row
    const { data: template, error: templateError } = await supabaseAdmin()
      .from("message_templates")
      .select("body_text")
      .eq("name", args.templateName)
      .eq("workspace_id", config.workspace_id)
      .maybeSingle();

    if (templateError || !template) {
      throw new Error(`Failed to fetch message template "${args.templateName}": ${templateError?.message || "Not found"}`);
    }

    // Substitute template parameters {{1}}, {{2}} with dynamic args values
    let compiledBody = template.body_text || "";
    if (args.params && args.params.length > 0) {
      args.params.forEach((param, index) => {
        compiledBody = compiledBody.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, "g"), param);
      });
    }

    // Deliver the compiled template via normal Twilio text message endpoint
    return this.sendMessage({
      phoneId: args.phoneId,
      wabaId: args.wabaId,
      token: args.token,
      to: args.to,
      text: compiledBody,
    });
  }
}
