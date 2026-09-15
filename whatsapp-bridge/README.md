# Dailybuz WhatsApp Bridge

Connects WhatsApp numbers over the WhatsApp Web multi-device protocol
(via [whatsmeow](https://github.com/tulir/whatsmeow)) — no Meta Cloud
API, no per-conversation charges, no template approvals. A tenant pairs
by scanning a QR code, exactly like WhatsApp Web.

**Be clear about the trade:** this is the *unofficial* protocol. It is
against WhatsApp's Terms of Service, and numbers that behave like
spam machines get banned. The bridge paces every send (min gap +
jitter + hourly cap) because behaviour is the only honest mitigation —
there is deliberately no detection-evasion machinery here. Offer it as
an at-your-own-risk tier; keep the official Cloud API for bulk senders.

## How it fits

```
Dailybuz app ── REST (X-Bridge-Key) ──▶ bridge ── WhatsApp Web protocol ──▶ WhatsApp
Dailybuz app ◀── HMAC-signed webhooks ── bridge   (one instance per workspace/number)
```

- App-side provider: `src/lib/whatsapp/providers/bridge-provider.ts`
  (provider `bridge` in `whatsapp_config`).
- Inbound events land on `POST /api/whatsapp/bridge-webhook` in the app,
  signed with `APP_WEBHOOK_SECRET` (`X-Bridge-Signature`, hex HMAC-SHA256
  of the raw body).
- Sessions live in this service's **own Postgres** (whatsmeow migrates
  its tables itself). Never point it at the app's Supabase — the app
  repo's no-DDL-from-code rule stays intact.

## Deploy on Coolify

1. **Postgres**: create a small dedicated database (e.g. `wa_bridge`).
2. **Service**: new app from this repo, build context `whatsapp-bridge/`,
   Dockerfile build. Attach a volume at `/data/media`.
3. **Environment**:

   | Var | Meaning |
   |---|---|
   | `DATABASE_URL` | the bridge's own Postgres, e.g. `postgres://…/wa_bridge?sslmode=disable` |
   | `BRIDGE_API_KEY` | long random string; the app sends it as `X-Bridge-Key` |
   | `APP_WEBHOOK_URL` | `https://dailybuz.com/api/whatsapp/bridge-webhook` |
   | `APP_WEBHOOK_SECRET` | long random string; signs every webhook |
   | `PORT` | default `8090` |
   | `MEDIA_DIR` | default `/data/media` |
   | `SEND_MIN_GAP_MS` | min gap between sends per number (default 3000) |
   | `SEND_JITTER_MAX_MS` | random extra gap (default 4000) |
   | `SEND_MAX_PER_HOUR` | hourly cap per number (default 180) |

4. **App env** (the Next.js app): `WHATSAPP_BRIDGE_URL` (the bridge's
   internal URL), `WHATSAPP_BRIDGE_API_KEY` and
   `WHATSAPP_BRIDGE_WEBHOOK_SECRET` (same values as above).

The bridge needs no public hostname if app and bridge share a Coolify
network — an internal URL keeps the API surface private; the app is the
only client either way.

## API (all routes except /health need `X-Bridge-Key`)

| Route | Does |
|---|---|
| `GET /health` | liveness |
| `POST /instances/{id}/pair` | start/refresh QR pairing; returns status + QR data URL |
| `GET /instances/{id}` | status, phone, current QR if pairing |
| `POST /instances/{id}/send/text` | `{to, text, quoted_id?}` → `{message_id}` |
| `POST /instances/{id}/send/media` | `{to, url, kind, caption?, filename?}` → `{message_id}` |
| `POST /instances/{id}/logout` | unlink from the phone |
| `DELETE /instances/{id}` | logout + forget |
| `GET /media/{instance}/{file}` | inbound media the bridge saved |

Webhook events (`{instance_id, event, data, ts}`): `pair_success`,
`connected`, `disconnected`, `logged_out`, `message` (text/media/
location, media saved under `media_path`), `status` (delivered/read).

## Local dev

```bash
cd whatsapp-bridge
DATABASE_URL=postgres://localhost/wa_bridge \
BRIDGE_API_KEY=dev APP_WEBHOOK_URL=http://localhost:3000/api/whatsapp/bridge-webhook \
APP_WEBHOOK_SECRET=dev MEDIA_DIR=./data/media go run .
```

Pair a **throwaway number first** — never the main business line.
