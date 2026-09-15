import { WhatsAppProvider } from "../provider-interface";
import { MetaProvider } from "./meta-provider";
import { TwilioProvider } from "./twilio-provider";
import { MockProvider } from "./mock-provider";
import { ApiAutoProvider } from "./api-auto-provider";
import { BridgeProvider } from "./bridge-provider";

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
    case "apiauto":
      return new ApiAutoProvider();
    case "bridge":
      // The Dailybuz WhatsApp Bridge (whatsapp-bridge/) — unofficial
      // WhatsApp Web protocol, QR-paired, no Meta account.
      return new BridgeProvider();
    case "meta":
    default:
      return new MetaProvider();
  }
}
