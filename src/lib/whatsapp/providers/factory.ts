import { WhatsAppProvider } from "../provider-interface";
import { MetaProvider } from "./meta-provider";
import { TwilioProvider } from "./twilio-provider";
import { MockProvider } from "./mock-provider";

/**
 * Factory function to retrieve the appropriate WhatsApp API driver.
 * Defaults to 'meta' for backward compatibility.
 */
export function getWhatsAppProvider(provider: string): WhatsAppProvider {
  const normProvider = (provider || "meta").toLowerCase().trim();
  switch (normProvider) {
    case "twilio":
      return new TwilioProvider();
    case "mock":
      return new MockProvider();
    case "meta":
    default:
      return new MetaProvider();
  }
}
