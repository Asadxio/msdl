/**
 * MSLB WhatsApp Provider Abstraction Types
 * 
 * Defines standard interfaces for Meta WhatsApp Cloud API (Official)
 * and Self-Hosted WhatsApp Web Gateway (e.g. Baileys / Evolution API).
 */

export type WhatsAppProviderType = "meta" | "self_hosted" | "disabled";

export type DeliveryState = "accepted" | "sent" | "delivered" | "read" | "unknown";

export interface WhatsAppMessagePayload {
  recipientE164: string;
  messageText: string;
  studentName: string;
  enrolledCourse?: string | null;
}

export interface WhatsAppSendResult {
  success: boolean;
  status: "sent" | "pending_configuration" | "failed" | "disabled";
  provider: "meta_cloud_api" | "self_hosted_gateway" | "disabled";
  providerMessageId?: string;
  deliveryState: DeliveryState;
  error?: string;
  reason?: string;
  timestamp: number;
}

export interface WhatsAppProviderHealth {
  providerType: WhatsAppProviderType;
  status: "CONNECTED" | "DISCONNECTED" | "AUTH_REQUIRED" | "PENDING_CONFIGURATION" | "ERROR" | "DISABLED";
  officialSenderNumber: string;
  isOfficialMetaApi: boolean;
  accountRiskLevel: "NONE" | "HIGH_UNOFFICIAL";
  details: string;
}

export interface WhatsAppProvider {
  readonly providerType: WhatsAppProviderType;
  readonly senderNumber: string;
  sendWelcome(
    payload: WhatsAppMessagePayload,
    credentialsOverride?: any
  ): Promise<WhatsAppSendResult>;
  getHealth(credentialsOverride?: any): Promise<WhatsAppProviderHealth>;
}
