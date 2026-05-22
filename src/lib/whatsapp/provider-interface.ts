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
   */
  sendMessage(args: {
    phoneId: string;
    wabaId?: string;
    token: string;
    to: string;
    text: string;
  }): Promise<{ messageId: string }>;

  /**
   * Sends a pre-approved message template.
   */
  sendTemplate(args: {
    phoneId: string;
    wabaId?: string;
    token: string;
    to: string;
    templateName: string;
    params?: string[];
  }): Promise<{ messageId: string }>;
}
