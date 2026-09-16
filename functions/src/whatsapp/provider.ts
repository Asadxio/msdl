/**
 * MSLB WhatsApp Provider Factory & Manager
 * 
 * Central registry for WhatsApp messaging providers.
 * Allows seamless switching between Official Meta Cloud API (Default)
 * and Self-Hosted Gateway (Optional) via configuration.
 */

import {
  WhatsAppProvider,
  WhatsAppProviderType,
  WhatsAppMessagePayload,
  WhatsAppSendResult,
  WhatsAppProviderHealth,
} from "./types";
import { MetaCloudWhatsAppProvider, OFFICIAL_SENDER_NUMBER } from "./metaProvider";
import { SelfHostedWhatsAppProvider } from "./selfHostedProvider";

export class DisabledWhatsAppProvider implements WhatsAppProvider {
  public readonly providerType: WhatsAppProviderType = "disabled";
  public readonly senderNumber: string = OFFICIAL_SENDER_NUMBER;

  public async sendWelcome(
    _payload: WhatsAppMessagePayload,
    _credentialsOverride?: any
  ): Promise<WhatsAppSendResult> {
    return {
      success: false,
      status: "disabled",
      provider: "disabled",
      deliveryState: "unknown",
      reason: "Automatic WhatsApp messaging is currently disabled by institutional policy.",
      timestamp: Date.now(),
    };
  }

  public async getHealth(_credentialsOverride?: any): Promise<WhatsAppProviderHealth> {
    return {
      providerType: "disabled",
      status: "DISABLED",
      officialSenderNumber: OFFICIAL_SENDER_NUMBER,
      isOfficialMetaApi: false,
      accountRiskLevel: "NONE",
      details: "Automatic WhatsApp delivery is disabled. In-App + FCM active.",
    };
  }
}

export function getWhatsAppProvider(
  preferredType?: WhatsAppProviderType
): WhatsAppProvider {
  const selectedType: WhatsAppProviderType =
    preferredType ||
    ((process.env.WHATSAPP_PROVIDER_TYPE as WhatsAppProviderType) || "disabled");

  if (selectedType === "meta") {
    return new MetaCloudWhatsAppProvider();
  }
  if (selectedType === "self_hosted") {
    return new SelfHostedWhatsAppProvider();
  }

  // Default to disabled (zero cost, zero external API call during signup)
  return new DisabledWhatsAppProvider();
}

/**
 * Dispatches a welcome WhatsApp message using the active configured provider.
 */
export async function dispatchWelcomeWhatsApp(
  payload: WhatsAppMessagePayload,
  options?: {
    providerType?: WhatsAppProviderType;
    credentialsOverride?: any;
  }
): Promise<WhatsAppSendResult> {
  const provider = getWhatsAppProvider(options?.providerType);
  return provider.sendWelcome(payload, options?.credentialsOverride);
}

/**
 * Retrieves the current health and connection status of the active provider.
 */
export async function checkWhatsAppProviderHealth(
  providerType?: WhatsAppProviderType,
  credentialsOverride?: any
): Promise<WhatsAppProviderHealth> {
  const provider = getWhatsAppProvider(providerType);
  return provider.getHealth(credentialsOverride);
}
