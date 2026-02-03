// utils/sms.js
// ESM-ready SMS helper with Twilio + safe dev fallback.

let _twilioClient = null;

async function getTwilioClient() {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  if (!sid || !token) return null;
  if (_twilioClient) return _twilioClient;

  // dynamic import keeps startup fast if Twilio isn’t configured
  const twilio = (await import("twilio")).default;
  _twilioClient = twilio(sid, token);
  return _twilioClient;
}

/**
 * Send an SMS message
 * @param {Object} params
 * @param {string} params.to - destination in E.164 (+1..., +91...) or 'whatsapp:+...'
 * @param {string} params.body - message text
 * @returns {Promise<{ok: boolean, sid?: string}>}
 */
export async function sendSms({ to, body }) {
  const client = await getTwilioClient();
  const fromNumber = process.env.TWILIO_FROM; // e.g. +12223334444
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID; // recommended

  // Dev fallback (no Twilio creds)
  if (!client || (!fromNumber && !messagingServiceSid)) {
    console.log(`[DEV SMS] → ${to}: ${body}`);
    return { ok: true };
  }

  try {
    const msg = await client.messages.create({
      to,
      body,
      ...(messagingServiceSid ? { messagingServiceSid } : { from: fromNumber }),
    });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    console.error("sendSms error:", err?.message || err);
    return { ok: false };
  }
}

/**
 * Convenience helper for OTP messages
 * @param {string} to
 * @param {string|number} code
 * @param {number} minutes - expiry minutes to mention in text
 */
export async function sendOtpSms(to, code, minutes = 10) {
  const body = `Your verification code is ${code}. It expires in ${minutes} minutes.`;
  return sendSms({ to, body });
}
