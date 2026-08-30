// ============================================================
// Why did the mailbox say no?
//
// "535 5.7.3 Authentication unsuccessful" is the same answer for a
// wrong password, a mailbox with SMTP AUTH switched off, an account
// with MFA that needs an app password, and a tenant blocking legacy
// auth. Guessing between those over email costs a round trip each
// time, so this establishes the facts instead:
//
//   • who actually hosts the domain's mail, from its MX records —
//     a Zoho mailbox pointed at Office 365 fails exactly like a
//     rejected password, and that mistake is invisible otherwise;
//   • whether the credential looks intact, without ever revealing it
//     (length and stray whitespace only — an env file that swallowed a
//     quote or kept a trailing space produces this same 535);
//   • which of Microsoft's SMTP endpoints, if any, accepts the login.
//
// Credentials are only ever offered to hosts belonging to the provider
// the MX records name. A password is never tried against a third party
// to see if it happens to fit.
// ============================================================

import { promises as dns } from 'dns';
import nodemailer from 'nodemailer';

export interface MailHostCandidate {
  host: string;
  port: number;
  label: string;
}

export interface ProviderProfile {
  /** What the MX records say is hosting this domain. */
  provider: 'microsoft' | 'google' | 'zoho' | 'other' | 'unknown';
  mx: string[];
  candidates: MailHostCandidate[];
  /** Guidance specific to that provider when auth is refused. */
  advice: string;
}

const MICROSOFT_CANDIDATES: MailHostCandidate[] = [
  { host: 'smtp.office365.com', port: 587, label: 'Microsoft 365 (business)' },
  { host: 'smtp-mail.outlook.com', port: 587, label: 'Outlook (consumer endpoint)' },
];

/** Identify the mail host from the domain's MX records. */
export async function detectProvider(email: string): Promise<ProviderProfile> {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain) {
    return { provider: 'unknown', mx: [], candidates: [], advice: 'That username is not an email address.' };
  }

  let mx: string[] = [];
  try {
    const records = await dns.resolveMx(domain);
    mx = records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange.toLowerCase());
  } catch {
    return {
      provider: 'unknown',
      mx: [],
      candidates: MICROSOFT_CANDIDATES,
      advice: `Could not read MX records for ${domain}, so the mail host could not be confirmed.`,
    };
  }

  const joined = mx.join(' ');

  if (joined.includes('outlook.com') || joined.includes('microsoft')) {
    return {
      provider: 'microsoft',
      mx,
      candidates: MICROSOFT_CANDIDATES,
      advice:
        `${domain} is hosted by Microsoft 365, so the host and port are right — a 535 here is the ACCOUNT ` +
        'refusing the login, not the wrong server. ' +
        'IF THIS IS A SHARED MAILBOX: it has no licence and its sign-in is disabled by design, so it can ' +
        'never authenticate with its own password, no matter what the password is. Two supported ways to ' +
        'send from it: (a) SMTP as a LICENSED user that has Send As permission on the shared mailbox — put ' +
        'that user in SMTP username/password and the shared address in "From address"; or (b) Microsoft ' +
        'Graph, which sends from an unlicensed shared mailbox directly — switch Provider to Microsoft and ' +
        'set "Send as" to the shared address. ' +
        'IF IT IS A NORMAL MAILBOX: Authenticated SMTP is probably off for it (admin centre → Users → the ' +
        'user → Mail → Manage email apps), or MFA/Security Defaults are blocking SMTP AUTH — Graph is the ' +
        'way through those.',
    };
  }
  if (joined.includes('zoho')) {
    return {
      provider: 'zoho',
      mx,
      candidates: [
        { host: 'smtp.zoho.in', port: 465, label: 'Zoho India' },
        { host: 'smtp.zoho.com', port: 465, label: 'Zoho global' },
      ],
      advice: `${domain} is hosted by Zoho, not Microsoft. Set the SMTP host to smtp.zoho.in (or smtp.zoho.com) on port 465.`,
    };
  }
  if (joined.includes('google') || joined.includes('googlemail')) {
    return {
      provider: 'google',
      mx,
      candidates: [{ host: 'smtp.gmail.com', port: 587, label: 'Google Workspace' }],
      advice: `${domain} is hosted by Google. Use smtp.gmail.com on port 587 with an app password — Google refuses normal passwords over SMTP.`,
    };
  }

  return {
    provider: 'other',
    mx,
    candidates: [],
    advice: `${domain} is hosted by ${mx[0] ?? 'an unrecognised provider'}. Use that provider's SMTP host and port.`,
  };
}

export interface CredentialShape {
  length: number;
  hasSurroundingWhitespace: boolean;
  looksTruncatedAtQuote: boolean;
}

/**
 * Describe the credential without disclosing it. An env file that ate a
 * quote or kept a trailing space produces the same 535 as a wrong
 * password, and only one of those is worth re-typing.
 */
export function describeCredential(pass: string | undefined): CredentialShape {
  const raw = pass ?? '';
  return {
    length: raw.length,
    hasSurroundingWhitespace: raw !== raw.trim(),
    // A lone quote at either end usually means the value was cut short.
    looksTruncatedAtQuote: /^["']|["']$/.test(raw.trim()),
  };
}

export interface HostAttempt {
  host: string;
  port: number;
  label: string;
  ok: boolean;
  error?: string;
}

/**
 * Offer the credentials to each candidate host and report what happened.
 * `verify()` completes the login handshake without sending a message.
 */
export async function tryCandidates(
  candidates: MailHostCandidate[],
  user: string,
  pass: string,
): Promise<HostAttempt[]> {
  const out: HostAttempt[] = [];

  for (const c of candidates) {
    try {
      const transporter = nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.port === 465,
        requireTLS: c.port !== 465,
        auth: { user, pass },
        connectionTimeout: 12_000,
        greetingTimeout: 8_000,
      });
      await transporter.verify();
      out.push({ ...c, ok: true });
    } catch (err) {
      out.push({
        ...c,
        ok: false,
        error: err instanceof Error ? err.message : 'verify failed',
      });
    }
  }

  return out;
}
