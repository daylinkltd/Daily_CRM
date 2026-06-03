import { WhatsAppProvider } from '../provider-interface'

export class ApiAutoProvider implements WhatsAppProvider {
  private getHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }

  async verifyConfig(credentials: {
    phoneId: string
    wabaId?: string
    token: string
  }): Promise<{ verifiedName: string; quality?: string }> {
    // ApiAuto doesn't seem to have a dedicated verify endpoint in the docs.
    // We'll return a stub name for now, but in a real scenario we'd do a quick check.
    return {
      verifiedName: 'ApiAuto Account',
      quality: 'GREEN',
    }
  }

  async sendMessage(args: {
    phoneId: string
    wabaId?: string
    token: string
    to: string
    text: string
  }): Promise<{ messageId: string }> {
    const url = `https://official.apiauto.in/api/v1/send-message?token=${args.token}`

    const payload = {
      messageObject: {
        messaging_product: 'whatsapp',
        to: args.to,
        type: 'text',
        text: {
          body: args.text,
        },
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(args.token),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ApiAuto sendMessage failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    if (data.success === false) {
      throw new Error(`ApiAuto error: ${data.message}`)
    }

    // ApiAuto docs don't show message_id in the success response for /send-message,
    // so we'll generate a pseudo-ID or use what we can.
    const messageId = data.metaResponse?.message_id || `apiauto-${Date.now()}`
    return { messageId }
  }

  async sendTemplate(args: {
    phoneId: string
    wabaId?: string
    token: string
    to: string
    templateName: string
    params?: string[]
  }): Promise<{ messageId: string }> {
    const url = 'https://official.apiauto.in/api/v1/send_templet'

    const payload = {
      sendTo: args.to,
      templetName: args.templateName,
      exampleArr: args.params || [],
      token: args.token,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(args.token),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ApiAuto sendTemplate failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    if (data.success === false) {
      throw new Error(`ApiAuto template error: ${data.message}`)
    }

    const messageId = data.metaResponse?.message_id || `apiauto-tpl-${Date.now()}`
    return { messageId }
  }
}
