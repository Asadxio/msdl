/**
 * Self-Hosted WhatsApp Web Gateway Provider (e.g. Baileys / Evolution API / WPPConnect)
 * 
 * ARCHITECTURE & SECURITY CRITICAL NOTE:
 * - Persistent WebSockets CANNOT run inside serverless Firebase Cloud Functions.
 * - This provider communicates with an authenticated external self-hosted gateway instance
 *   (running in Docker / VPS) via authenticated HTTP REST.
 * 
 * TERMS OF SERVICE & BAN RISK DISCLOSURE:
 * - Unofficial WhatsApp Web protocol emulation violates Meta Terms of Service.
 * - HIGH ACCOUNT BAN RISK: Meta automated anti-spam algorithms can permanently ban
 *   the official sender number (+91 63669 19122) if flagged for unsolicited automated messages.
 */

import { logger } from "firebase-functions/v2";
import {
  WhatsAppProvider,
  WhatsAppProviderType,
  WhatsAppMessagePayload,
  WhatsAppSendResult,
  WhatsAppProviderHealth,
} from "./types";
import {
  SELF_HOSTED_WHATSAPP_URL,
  SELF_HOSTED_WHATSAPP_API_KEY,
} from "../config/secrets";

export const OFFICIAL_SENDER_NUMBER = "+916366919122";

export class SelfHostedWhatsAppProvider implements WhatsAppProvider {
  public readonly providerType: WhatsAppProviderType = "self_hosted";
  public readonly senderNumber: string = OFFICIAL_SENDER_NUMBER;

  public async sendWelcome(
    payload: WhatsAppMessagePayload,
    credentialsOverride?: { gatewayUrl?: string; apiKey?: string }
  ): Promise<WhatsAppSendResult> {
    let url = credentialsOverride?.gatewayUrl;
    let apiKey = credentialsOverride?.apiKey;

    if (!url) {
      try {
        url = SELF_HOSTED_WHATSAPP_URL.value();
      } catch {
        url = process.env.SELF_HOSTED_WHATSAPP_URL;
      }
    }

    if (!apiKey) {
      try {
        apiKey = SELF_HOSTED_WHATSAPP_API_KEY.value();
      } catch {
        apiKey = process.env.SELF_HOSTED_WHATSAPP_API_KEY;
      }
    }

    // Zero Fake Delivery: Missing self-hosted configuration
    if (!url || !apiKey) {
      logger.warn(
        `[SelfHostedWhatsAppProvider] Self-hosted gateway configuration missing (SELF_HOSTED_WHATSAPP_URL / SELF_HOSTED_WHATSAPP_API_KEY).`
      );
      return {
        success: false,
        status: "pending_configuration",
        provider: "self_hosted_gateway",
        deliveryState: "unknown",
        reason: "Self-hosted WhatsApp gateway URL or API key is not configured in Secret Manager.",
        timestamp: Date.now(),
      };
    }

    try {
      const endpoint = `${url.replace(/\/+$/, "")}/message/sendText`;
      const body = {
        number: payload.recipientE164.replace("+", ""),
        text: payload.messageText,
        options: {
          delay: 1200,
          presence: "composing",
        },
        senderExpected: OFFICIAL_SENDER_NUMBER,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const resJson = (await response.json()) as any;

      if (!response.ok) {
        const errMsg = resJson?.message || resJson?.error || `HTTP ${response.status} ${response.statusText}`;
        logger.error("[SelfHostedWhatsAppProvider] Gateway rejected message:", errMsg);
        return {
          success: false,
          status: "failed",
          provider: "self_hosted_gateway",
          deliveryState: "unknown",
          error: errMsg,
          timestamp: Date.now(),
        };
      }

      // Check if instance disconnected
      if (resJson?.status === "DISCONNECTED" || resJson?.connectionStatus === "close") {
        return {
          success: false,
          status: "failed",
          provider: "self_hosted_gateway",
          deliveryState: "unknown",
          error: "Self-hosted WhatsApp session disconnected. QR re-authentication required.",
          timestamp: Date.now(),
        };
      }

      const msgId = resJson?.key?.id || resJson?.messageId || "self_msg_" + Date.now();
      logger.info(
        `[SelfHostedWhatsAppProvider] Message accepted by self-hosted gateway. msgId=${msgId}`
      );

      return {
        success: true,
        status: "sent",
        provider: "self_hosted_gateway",
        providerMessageId: msgId,
        deliveryState: "accepted",
        timestamp: Date.now(),
      };
    } catch (err: any) {
      logger.error("[SelfHostedWhatsAppProvider] Network exception contacting gateway:", err);
      return {
        success: false,
        status: "failed",
        provider: "self_hosted_gateway",
        deliveryState: "unknown",
        error: err?.message || "Connection refused to self-hosted WhatsApp gateway",
        timestamp: Date.now(),
      };
    }
  }

  public async getHealth(
    credentialsOverride?: { gatewayUrl?: string; apiKey?: string }
  ): Promise<WhatsAppProviderHealth> {
    let url = credentialsOverride?.gatewayUrl;
    let apiKey = credentialsOverride?.apiKey;

    if (!url) {
      try {
        url = SELF_HOSTED_WHATSAPP_URL.value();
      } catch {
        url = process.env.SELF_HOSTED_WHATSAPP_URL;
      }
    }
    if (!apiKey) {
      try {
        apiKey = SELF_HOSTED_WHATSAPP_API_KEY.value();
      } catch {
        apiKey = process.env.SELF_HOSTED_WHATSAPP_API_KEY;
      }
    }

    if (!url || !apiKey) {
      return {
        providerType: "self_hosted",
        status: "PENDING_CONFIGURATION",
        officialSenderNumber: OFFICIAL_SENDER_NUMBER,
        isOfficialMetaApi: false,
        accountRiskLevel: "HIGH_UNOFFICIAL",
        details: "Self-hosted gateway URL/API key not configured in Secret Manager.",
      };
    }

    try {
      const pingUrl = `${url.replace(/\/+$/, "")}/instance/status`;
      const res = await fetch(pingUrl, {
        method: "GET",
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        return {
          providerType: "self_hosted",
          status: "ERROR",
          officialSenderNumber: OFFICIAL_SENDER_NUMBER,
          isOfficialMetaApi: false,
          accountRiskLevel: "HIGH_UNOFFICIAL",
          details: `Gateway responded with HTTP ${res.status}`,
        };
      }

      const statusData = (await res.json()) as any;
      const connected = statusData?.state === "open" || statusData?.status === "CONNECTED";

      return {
        providerType: "self_hosted",
        status: connected ? "CONNECTED" : "AUTH_REQUIRED",
        officialSenderNumber: OFFICIAL_SENDER_NUMBER,
        isOfficialMetaApi: false,
        accountRiskLevel: "HIGH_UNOFFICIAL",
        details: connected
          ? "Self-hosted gateway connected via WhatsApp Web protocol. WARNING: High account ban risk."
          : "Self-hosted gateway requires QR code authentication.",
      };
    } catch (err: any) {
      return {
        providerType: "self_hosted",
        status: "DISCONNECTED",
        officialSenderNumber: OFFICIAL_SENDER_NUMBER,
        isOfficialMetaApi: false,
        accountRiskLevel: "HIGH_UNOFFICIAL",
        details: `Failed to connect to gateway: ${err?.message}`,
      };
    }
  }
}
