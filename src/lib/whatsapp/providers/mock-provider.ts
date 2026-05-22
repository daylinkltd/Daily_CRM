import { WhatsAppProvider } from "../provider-interface";

export class MockProvider implements WhatsAppProvider {
  async verifyConfig(credentials: {
    phoneId: string;
    wabaId?: string;
    token: string;
  }): Promise<{ verifiedName: string; quality?: string }> {
    // Instantly verify mock simulator credentials to facilitate immediate testing
    return {
      verifiedName: "Daylink Sandbox Simulator",
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
    // Generate a unique mock message reference
    const mockId = `mock-msg-${Math.random().toString(36).substring(2, 11)}`;
    console.log(`[MockProvider] Simulated message delivery to ${args.to} (Text: "${args.text}")`);
    return { messageId: mockId };
  }

  async sendTemplate(args: {
    phoneId: string;
    wabaId?: string;
    token: string;
    to: string;
    templateName: string;
    params?: string[];
  }): Promise<{ messageId: string }> {
    // Generate a unique mock template reference
    const mockId = `mock-tpl-${Math.random().toString(36).substring(2, 11)}`;
    console.log(
      `[MockProvider] Simulated template "${args.templateName}" delivery to ${args.to} with params:`,
      args.params || []
    );
    return { messageId: mockId };
  }
}
