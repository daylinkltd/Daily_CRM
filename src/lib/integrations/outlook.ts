/**
 * Microsoft Outlook / Azure AD App Registration Email Integration Engine.
 * Uses Client Credentials Grant against Microsoft Graph API.
 */

export interface OutlookConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  fromEmail: string;
}

export interface SendOutlookEmailArgs {
  config: OutlookConfig;
  to: string;
  subject: string;
  bodyHtml: string;
}

/**
 * Fetch OAuth2 Access Token for Azure AD App Registration using Client Credentials Flow.
 */
export async function getOutlookAccessToken(config: OutlookConfig): Promise<string> {
  const { tenantId, clientId, clientSecret } = config;
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      json.error_description || json.error || `Azure AD Authentication Failed (Status ${res.status})`
    );
  }

  return json.access_token;
}

/**
 * Test Azure AD App Registration credentials.
 */
export async function testOutlookConnection(config: OutlookConfig): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getOutlookAccessToken(config);
    // Test fetching sender profile or mailbox
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${config.fromEmail}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `User mailbox "${config.fromEmail}" not accessible (Status ${res.status})`);
    }

    return {
      success: true,
      message: `Successfully connected to Microsoft Graph API for mailbox ${config.fromEmail}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to authenticate with Microsoft Outlook",
    };
  }
}

/**
 * Send Email via Microsoft Graph API.
 */
export async function sendOutlookEmail(args: SendOutlookEmailArgs): Promise<void> {
  const { config, to, subject, bodyHtml } = args;
  const token = await getOutlookAccessToken(config);

  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${config.fromEmail}/sendMail`;

  const payload = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: bodyHtml,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    },
    saveToSentItems: "true",
  };

  const res = await fetch(sendMailUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Microsoft Graph API sendMail failed (${res.status})`);
  }
}
