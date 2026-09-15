// Instance manager — one whatsmeow client per connected WhatsApp
// number. Pairing state, sending (through the pacing limiter), media
// download to disk, and translation of whatsmeow events into the
// bridge's webhook payloads for the app.

package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

type InstanceStatus string

const (
	StatusDisconnected InstanceStatus = "disconnected"
	StatusPairing      InstanceStatus = "pairing"
	StatusConnected    InstanceStatus = "connected"
)

type Instance struct {
	ID     string
	client *whatsmeow.Client

	mu        sync.Mutex
	status    InstanceStatus
	qrCode    string
	qrExpires time.Time
	phone     string
	pushName  string
	limiter   *Limiter
}

func (i *Instance) snapshot() (InstanceStatus, string, string, string) {
	i.mu.Lock()
	defer i.mu.Unlock()
	qr := i.qrCode
	if !i.qrExpires.IsZero() && time.Now().After(i.qrExpires) {
		qr = ""
	}
	return i.status, qr, i.phone, i.pushName
}

type Manager struct {
	cfg       Config
	container *sqlstore.Container
	db        *sql.DB
	hooks     *WebhookSender

	mu        sync.Mutex
	instances map[string]*Instance
}

func NewManager(cfg Config, container *sqlstore.Container, db *sql.DB) *Manager {
	return &Manager{
		cfg:       cfg,
		container: container,
		db:        db,
		hooks:     NewWebhookSender(cfg),
		instances: make(map[string]*Instance),
	}
}

var instanceIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// ── lifecycle ────────────────────────────────────────────────

// ResumeAll reconnects every instance that finished pairing before the
// last shutdown. Unpaired instances are forgotten — pairing is a live,
// interactive act and a stale QR from last week helps nobody.
func (m *Manager) ResumeAll(ctx context.Context) error {
	rows, err := m.db.QueryContext(ctx, `SELECT instance_id, jid FROM bridge_instances WHERE jid IS NOT NULL AND jid <> ''`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, jidStr string
		if err := rows.Scan(&id, &jidStr); err != nil {
			continue
		}
		jid, err := types.ParseJID(jidStr)
		if err != nil {
			log.Printf("[%s] stored jid unparsable: %v", id, err)
			continue
		}
		device, err := m.container.GetDevice(ctx, jid)
		if err != nil || device == nil {
			log.Printf("[%s] no stored device for %s — needs re-pairing", id, jidStr)
			continue
		}
		inst := m.newInstance(id, device)
		if err := inst.client.Connect(); err != nil {
			log.Printf("[%s] reconnect failed: %v", id, err)
			continue
		}
		log.Printf("[%s] resumed as %s", id, jidStr)
	}
	return rows.Err()
}

// StartPairing creates (or restarts) an instance and begins QR pairing.
// Calling it again while pairing simply issues a fresh QR.
func (m *Manager) StartPairing(ctx context.Context, id string) (*Instance, error) {
	if !instanceIDRe.MatchString(id) {
		return nil, errors.New("instance id must be 1-64 chars of letters, digits, _ or -")
	}

	if existing := m.get(id); existing != nil {
		st, _, _, _ := existing.snapshot()
		if st == StatusConnected {
			return existing, nil // already paired; nothing to do
		}
		existing.client.Disconnect()
		m.remove(id)
	}

	if _, err := m.db.ExecContext(ctx,
		`INSERT INTO bridge_instances (instance_id) VALUES ($1)
		 ON CONFLICT (instance_id) DO UPDATE SET updated_at = NOW()`, id); err != nil {
		return nil, err
	}

	device := m.container.NewDevice()
	inst := m.newInstance(id, device)
	inst.mu.Lock()
	inst.status = StatusPairing
	inst.mu.Unlock()

	// The QR channel must be requested BEFORE Connect on an unpaired
	// device; codes rotate every ~20s until scanned or timed out.
	qrChan, err := inst.client.GetQRChannel(context.Background())
	if err != nil {
		m.remove(id)
		return nil, fmt.Errorf("qr channel: %w", err)
	}
	if err := inst.client.Connect(); err != nil {
		m.remove(id)
		return nil, fmt.Errorf("connect: %w", err)
	}

	go func() {
		for item := range qrChan {
			switch item.Event {
			case "code":
				inst.mu.Lock()
				inst.qrCode = item.Code
				inst.qrExpires = time.Now().Add(item.Timeout)
				inst.mu.Unlock()
			case "success":
				// PairSuccess event handles persistence; just clear the QR.
				inst.mu.Lock()
				inst.qrCode = ""
				inst.mu.Unlock()
			default: // timeout, err-*
				inst.mu.Lock()
				inst.qrCode = ""
				if inst.status == StatusPairing {
					inst.status = StatusDisconnected
				}
				inst.mu.Unlock()
			}
		}
	}()

	return inst, nil
}

// Logout unlinks the device from the phone and forgets the session.
func (m *Manager) Logout(ctx context.Context, id string) error {
	inst := m.get(id)
	if inst != nil {
		// Best effort: tells the phone to drop the linked device.
		if inst.client.Store.ID != nil {
			if err := inst.client.Logout(ctx); err != nil {
				log.Printf("[%s] logout: %v", id, err)
			}
		}
		inst.client.Disconnect()
		m.remove(id)
	}
	_, err := m.db.ExecContext(ctx,
		`UPDATE bridge_instances SET jid = NULL, updated_at = NOW() WHERE instance_id = $1`, id)
	return err
}

// Delete removes the instance entirely (logout + registry row).
func (m *Manager) Delete(ctx context.Context, id string) error {
	if err := m.Logout(ctx, id); err != nil {
		return err
	}
	_, err := m.db.ExecContext(ctx, `DELETE FROM bridge_instances WHERE instance_id = $1`, id)
	return err
}

func (m *Manager) DisconnectAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, inst := range m.instances {
		inst.client.Disconnect()
	}
}

func (m *Manager) get(id string) *Instance {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.instances[id]
}

func (m *Manager) remove(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.instances, id)
}

func (m *Manager) newInstance(id string, device *store.Device) *Instance {
	cli := whatsmeow.NewClient(device, waLog.Stdout("WA:"+id, "WARN", true))
	inst := &Instance{
		ID:      id,
		client:  cli,
		status:  StatusDisconnected,
		limiter: NewLimiter(m.cfg),
	}
	cli.AddEventHandler(func(evt interface{}) { m.handleEvent(inst, evt) })
	m.mu.Lock()
	m.instances[id] = inst
	m.mu.Unlock()
	return inst
}

// ── events → app webhooks ────────────────────────────────────

func (m *Manager) handleEvent(inst *Instance, evt interface{}) {
	switch e := evt.(type) {
	case *events.PairSuccess:
		jid := e.ID
		inst.mu.Lock()
		inst.phone = jid.User
		inst.mu.Unlock()
		if _, err := m.db.Exec(
			`UPDATE bridge_instances SET jid = $1, updated_at = NOW() WHERE instance_id = $2`,
			jid.String(), inst.ID); err != nil {
			log.Printf("[%s] persist jid: %v", inst.ID, err)
		}
		m.hooks.Send(inst.ID, "pair_success", map[string]any{"phone": jid.User})

	case *events.Connected:
		inst.mu.Lock()
		inst.status = StatusConnected
		inst.qrCode = ""
		if inst.client.Store.ID != nil {
			inst.phone = inst.client.Store.ID.User
		}
		inst.pushName = inst.client.Store.PushName
		inst.mu.Unlock()
		m.hooks.Send(inst.ID, "connected", map[string]any{"phone": inst.phone})

	case *events.Disconnected:
		inst.mu.Lock()
		if inst.status == StatusConnected {
			inst.status = StatusDisconnected
		}
		inst.mu.Unlock()
		m.hooks.Send(inst.ID, "disconnected", map[string]any{})

	case *events.LoggedOut:
		inst.mu.Lock()
		inst.status = StatusDisconnected
		inst.phone = ""
		inst.mu.Unlock()
		if _, err := m.db.Exec(
			`UPDATE bridge_instances SET jid = NULL, updated_at = NOW() WHERE instance_id = $1`,
			inst.ID); err != nil {
			log.Printf("[%s] clear jid: %v", inst.ID, err)
		}
		m.hooks.Send(inst.ID, "logged_out", map[string]any{})

	case *events.Message:
		m.handleMessage(inst, e)

	case *events.Receipt:
		// Delivery/read receipts for messages WE sent.
		var status string
		switch e.Type {
		case types.ReceiptTypeDelivered:
			status = "delivered"
		case types.ReceiptTypeRead:
			status = "read"
		default:
			return
		}
		if len(e.MessageIDs) == 0 {
			return
		}
		m.hooks.Send(inst.ID, "status", map[string]any{
			"message_ids": e.MessageIDs,
			"status":      status,
			"from":        e.Chat.User,
		})
	}
}

func (m *Manager) handleMessage(inst *Instance, e *events.Message) {
	info := e.Info
	// v1 scope: 1:1 customer chats only. Groups, newsletters, broadcast
	// lists and our own messages echoed from other devices are skipped.
	if info.IsFromMe || info.IsGroup || info.Chat.Server != types.DefaultUserServer {
		return
	}

	msg := e.Message
	if msg == nil {
		return
	}

	payload := map[string]any{
		"id":        info.ID,
		"from":      info.Sender.User,
		"push_name": info.PushName,
		"timestamp": info.Timestamp.Unix(),
	}

	switch {
	case msg.GetConversation() != "":
		payload["type"] = "text"
		payload["text"] = msg.GetConversation()
	case msg.GetExtendedTextMessage().GetText() != "":
		payload["type"] = "text"
		payload["text"] = msg.GetExtendedTextMessage().GetText()
	case msg.GetImageMessage() != nil:
		m.attachMedia(inst, payload, "image", msg.GetImageMessage().GetCaption(),
			msg.GetImageMessage().GetMimetype(), msg.GetImageMessage())
	case msg.GetVideoMessage() != nil:
		m.attachMedia(inst, payload, "video", msg.GetVideoMessage().GetCaption(),
			msg.GetVideoMessage().GetMimetype(), msg.GetVideoMessage())
	case msg.GetAudioMessage() != nil:
		m.attachMedia(inst, payload, "audio", "",
			msg.GetAudioMessage().GetMimetype(), msg.GetAudioMessage())
	case msg.GetDocumentMessage() != nil:
		payload["filename"] = msg.GetDocumentMessage().GetFileName()
		m.attachMedia(inst, payload, "document", msg.GetDocumentMessage().GetCaption(),
			msg.GetDocumentMessage().GetMimetype(), msg.GetDocumentMessage())
	case msg.GetLocationMessage() != nil:
		payload["type"] = "location"
		payload["latitude"] = msg.GetLocationMessage().GetDegreesLatitude()
		payload["longitude"] = msg.GetLocationMessage().GetDegreesLongitude()
	default:
		// Reactions, polls, stickers, protocol messages — ignore in v1.
		return
	}

	m.hooks.Send(inst.ID, "message", payload)
}

// attachMedia downloads the media to MEDIA_DIR and references it by a
// path the app can fetch via GET /media/… (same API key). Download
// failures degrade to a caption-only event rather than dropping the
// message.
func (m *Manager) attachMedia(inst *Instance, payload map[string]any, kind, caption, mimetype string, dl whatsmeow.DownloadableMessage) {
	payload["type"] = kind
	if caption != "" {
		payload["caption"] = caption
	}
	payload["mimetype"] = mimetype

	data, err := inst.client.Download(context.Background(), dl)
	if err != nil {
		log.Printf("[%s] media download: %v", inst.ID, err)
		return
	}
	exts, _ := mime.ExtensionsByType(mimetype)
	ext := ".bin"
	if len(exts) > 0 {
		ext = exts[0]
	}
	name := fmt.Sprintf("%s-%d%s", sanitizeFileName(payload["id"].(string)), time.Now().UnixNano(), ext)
	dir := filepath.Join(m.cfg.MediaDir, inst.ID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Printf("[%s] media dir: %v", inst.ID, err)
		return
	}
	if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
		log.Printf("[%s] media write: %v", inst.ID, err)
		return
	}
	payload["media_path"] = inst.ID + "/" + name
}

var fileNameRe = regexp.MustCompile(`[^A-Za-z0-9._-]`)

func sanitizeFileName(s string) string {
	return fileNameRe.ReplaceAllString(s, "_")
}

// ── sending ──────────────────────────────────────────────────

var ErrNotConnected = errors.New("instance is not connected — pair it first")

func (m *Manager) instanceForSend(id string) (*Instance, error) {
	inst := m.get(id)
	if inst == nil {
		return nil, ErrNotConnected
	}
	st, _, _, _ := inst.snapshot()
	if st != StatusConnected {
		return nil, ErrNotConnected
	}
	return inst, nil
}

func toJID(phone string) (types.JID, error) {
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)
	if len(digits) < 7 {
		return types.JID{}, fmt.Errorf("recipient %q is not a phone number", phone)
	}
	return types.NewJID(digits, types.DefaultUserServer), nil
}

// SendText delivers a free-form text (optionally as a quoted reply).
func (m *Manager) SendText(ctx context.Context, id, to, text, quotedID string) (string, error) {
	inst, err := m.instanceForSend(id)
	if err != nil {
		return "", err
	}
	jid, err := toJID(to)
	if err != nil {
		return "", err
	}
	if err := inst.limiter.Wait(ctx); err != nil {
		return "", err
	}

	var message *waProto.Message
	if quotedID != "" {
		message = &waProto.Message{
			ExtendedTextMessage: &waProto.ExtendedTextMessage{
				Text: proto.String(text),
				ContextInfo: &waProto.ContextInfo{
					StanzaID:      proto.String(quotedID),
					Participant:   proto.String(jid.String()),
					QuotedMessage: &waProto.Message{Conversation: proto.String("")},
				},
			},
		}
	} else {
		message = &waProto.Message{Conversation: proto.String(text)}
	}

	resp, err := inst.client.SendMessage(ctx, jid, message)
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

// SendMedia fetches a (public or app-served) URL and delivers it as the
// given kind with an optional caption.
func (m *Manager) SendMedia(ctx context.Context, id, to, url, kind, caption, filename string) (string, error) {
	inst, err := m.instanceForSend(id)
	if err != nil {
		return "", err
	}
	jid, err := toJID(to)
	if err != nil {
		return "", err
	}

	data, mimetype, err := fetchMedia(ctx, url)
	if err != nil {
		return "", err
	}

	var mediaType whatsmeow.MediaType
	switch kind {
	case "image":
		mediaType = whatsmeow.MediaImage
	case "video":
		mediaType = whatsmeow.MediaVideo
	case "audio":
		mediaType = whatsmeow.MediaAudio
	case "document":
		mediaType = whatsmeow.MediaDocument
	default:
		return "", fmt.Errorf("unsupported media kind %q", kind)
	}

	if err := inst.limiter.Wait(ctx); err != nil {
		return "", err
	}

	up, err := inst.client.Upload(ctx, data, mediaType)
	if err != nil {
		return "", fmt.Errorf("upload: %w", err)
	}

	length := uint64(len(data))
	message := &waProto.Message{}
	switch kind {
	case "image":
		message.ImageMessage = &waProto.ImageMessage{
			URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey,
			FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: &length,
			Mimetype: proto.String(mimetype), Caption: proto.String(caption),
		}
	case "video":
		message.VideoMessage = &waProto.VideoMessage{
			URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey,
			FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: &length,
			Mimetype: proto.String(mimetype), Caption: proto.String(caption),
		}
	case "audio":
		message.AudioMessage = &waProto.AudioMessage{
			URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey,
			FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: &length,
			Mimetype: proto.String(mimetype),
		}
	case "document":
		if filename == "" {
			filename = "document"
		}
		message.DocumentMessage = &waProto.DocumentMessage{
			URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey,
			FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: &length,
			Mimetype: proto.String(mimetype), FileName: proto.String(filename),
			Caption: proto.String(caption),
		}
	}

	resp, err := inst.client.SendMessage(ctx, jid, message)
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}
