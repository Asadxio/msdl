/**
 * MSLB Email Delivery Service
 *
 * Provides transactional email delivery for critical security workflows,
 * specifically Public Account Deletion Ownership Verification.
 *
 * Security & Reliability Guarantees:
 * - Credentials retrieved exclusively from Secret Manager / secure environment variables.
 * - Zero credential exposure in client apps, Git, APK/AAB, or logs.
 * - Supports standard SMTP via nodemailer and mock transport injection for test suites.
 * - Explicit delivery status tracking: 'sent', 'failed', or 'not_configured'.
 */

import { logger } from 'firebase-functions/v2';
import * as nodemailer from 'nodemailer';
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} from '../config/secrets';

export interface EmailDeliveryResult {
  delivered: boolean;
  provider: 'smtp' | 'mock' | 'none';
  status: 'sent' | 'failed' | 'not_configured' | 'skipped_no_account';
  messageId?: string;
  error?: string;
}

export interface EmailTransport {
  sendMail(mailOptions: nodemailer.SendMailOptions): Promise<any>;
}

/**
 * Checks whether production SMTP credentials are fully configured.
 */
export function isEmailConfigured(): boolean {
  try {
    const host = process.env.SMTP_HOST || SMTP_HOST.value();
    const user = process.env.SMTP_USER || SMTP_USER.value();
    const pass = process.env.SMTP_PASS || SMTP_PASS.value();
    return Boolean(host && user && pass);
  } catch {
    return false;
  }
}

/**
 * Creates the production nodemailer transporter using Secret Manager values.
 */
function createSmtpTransporter(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST || SMTP_HOST.value();
  const portStr = process.env.SMTP_PORT || SMTP_PORT.value();
  const port = portStr ? parseInt(portStr, 10) : 587;
  const user = process.env.SMTP_USER || SMTP_USER.value();
  const pass = process.env.SMTP_PASS || SMTP_PASS.value();
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends the account deletion verification code to the target email.
 *
 * @param toEmail The recipient's email address
 * @param verificationCode The plaintext 6-digit verification code
 * @param requestId The associated privacy_requests document ID
 * @param customTransport Optional transport for unit/emulator testing
 */
export async function sendAccountDeletionVerificationEmail(
  toEmail: string,
  verificationCode: string,
  requestId: string,
  customTransport?: EmailTransport
): Promise<EmailDeliveryResult> {
  const cleanEmail = toEmail.trim().toLowerCase();

  // If a mock or custom transport is supplied (for unit/integration testing)
  if (customTransport) {
    try {
      const info = await customTransport.sendMail({
        from: '"Madrasa Tus Salikat" <privacy@madrasatussalikat.com>',
        to: cleanEmail,
        subject: 'MSLB Account Deletion Verification Code',
        text: `Your verification code is: ${verificationCode}`,
      });
      return {
        delivered: true,
        provider: 'mock',
        status: 'sent',
        messageId: info?.messageId || `mock-${Date.now()}`,
      };
    } catch (err: any) {
      logger.error('[emailDeliveryService] Mock transport failed', { error: err?.message });
      return {
        delivered: false,
        provider: 'mock',
        status: 'failed',
        error: err?.message || 'Mock send error',
      };
    }
  }

  // Check if live SMTP credentials are configured
  if (!isEmailConfigured()) {
    logger.warn(
      `[emailDeliveryService] SMTP credentials not configured. Verification email for requestId=${requestId} could not be dispatched.`
    );
    return {
      delivered: false,
      provider: 'none',
      status: 'not_configured',
      error: 'SMTP credentials are not configured in Secret Manager or environment.',
    };
  }

  try {
    const transporter = createSmtpTransporter();
    let fromAddress = '"Madrasa Tus Salikat Lil Banat" <privacy@madrasatussalikat.com>';
    try {
      const configuredFrom = process.env.SMTP_FROM || SMTP_FROM.value();
      if (configuredFrom) fromAddress = configuredFrom;
    } catch {
      // Use default fromAddress
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #005F46; margin: 0;">Madrasa Tus Salikat Lil Banat</h2>
          <p style="color: #666; font-size: 14px; margin-top: 4px;">Account Deletion Verification</p>
        </div>
        <p style="color: #333; font-size: 15px; line-height: 1.5;">Assalamu Alaikum,</p>
        <p style="color: #333; font-size: 15px; line-height: 1.5;">
          A request has been submitted on our website to delete the Madrasa Tus Salikat account associated with this email address.
        </p>
        <div style="background-color: #F4F7F5; border: 2px dashed #005F46; border-radius: 6px; padding: 16px; text-align: center; margin: 24px 0;">
          <span style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Your 6-Digit Verification Code</span>
          <span style="font-size: 32px; font-weight: bold; color: #005F46; letter-spacing: 6px;">${verificationCode}</span>
        </div>
        <p style="color: #666; font-size: 13px; line-height: 1.5;">
          <strong>Security Notice:</strong> This code is valid for <strong>15 minutes</strong>. If you did not initiate this request, you can safely ignore this email. Your account data will remain untouched.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 11px; text-align: center; margin: 0;">
          Reference Request ID: ${requestId}<br />
          Madrasa Tus Salikat Lil Banat Privacy Administration
        </p>
      </div>
    `;

    const textBody = `Assalamu Alaikum,\n\nA request has been submitted to delete the Madrasa Tus Salikat account associated with this email address.\n\nYour 6-digit verification code is:\n${verificationCode}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email.\n\nRequest ID: ${requestId}\nMadrasa Tus Salikat Lil Banat`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject: 'MSLB Account Deletion Verification Code',
      text: textBody,
      html: htmlBody,
    });

    logger.info(
      `[emailDeliveryService] Verification email dispatched for requestId=${requestId} messageId=${info.messageId}`
    );

    return {
      delivered: true,
      provider: 'smtp',
      status: 'sent',
      messageId: info.messageId,
    };
  } catch (err: any) {
    logger.error('[emailDeliveryService] SMTP dispatch failed', {
      requestId,
      error: err?.message,
    });
    return {
      delivered: false,
      provider: 'smtp',
      status: 'failed',
      error: err?.message || 'SMTP transmission error',
    };
  }
}
