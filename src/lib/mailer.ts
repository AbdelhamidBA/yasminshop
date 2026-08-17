import 'server-only';
import nodemailer, {type Transporter} from 'nodemailer';

// Outbound e-mail. One transport for the whole app, created lazily and reused —
// nodemailer pools connections, and building a transport per send would open a
// new SMTP session every time.
//
// CONFIGURATION IS OPTIONAL BY DESIGN. Unset SMTP_* means "no mail server", and
// every send returns false after logging, instead of throwing. Development and
// the e2e suite therefore need no credentials, and a misconfigured production
// box degrades to "the code was not delivered" rather than a 500 on a public
// form. Callers must treat the boolean as the delivery outcome.

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function readConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;
  // 465 is implicit TLS (secure from the first byte); 587 is STARTTLS. OVH's
  // MXplan offers both — the port decides, so `secure` is derived rather than
  // configured separately and unable to disagree with it.
  const port = Number.parseInt(process.env.SMTP_PORT ?? '465', 10);
  return {
    host,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 465,
    user,
    password,
    from: process.env.SMTP_FROM || user
  };
}

let cached: Transporter | null = null;

function transport(): {transporter: Transporter; from: string} | null {
  const config = readConfig();
  if (!config) return null;
  cached ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {user: config.user, pass: config.password},
    pool: true,
    maxConnections: 2
  });
  return {transporter: cached, from: config.from};
}

/** True when SMTP_* is configured — lets a caller word its response honestly. */
export function mailerConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Sends one message. Never throws: an SMTP outage must not take down the form
 * that triggered it, and for the password-reset flow the response is
 * deliberately identical whether or not delivery succeeded (no account-existence
 * oracle), so the boolean is for LOGGING and for the caller's own decisions —
 * not for the user-facing answer.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const active = transport();
  if (!active) {
    console.warn(`[mail] SMTP not configured — dropped "${message.subject}" to ${message.to}`);
    return false;
  }
  try {
    await active.transporter.sendMail({
      from: active.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    return true;
  } catch (error) {
    // The address itself is logged, the body never is: a reset e-mail contains
    // a live credential and logs are not the place for it.
    console.error(`[mail] failed to send "${message.subject}" to ${message.to}:`, error);
    return false;
  }
}
