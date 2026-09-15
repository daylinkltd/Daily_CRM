// REST API — the Dailybuz app is the only client. Every route (except
// /health) requires the shared key in X-Bridge-Key.
//
//   GET    /health
//   POST   /instances/{id}/pair      → start/refresh QR pairing
//   GET    /instances/{id}           → status, phone, QR (PNG data URL)
//   POST   /instances/{id}/send/text   {to, text, quoted_id?}
//   POST   /instances/{id}/send/media  {to, url, kind, caption?, filename?}
//   POST   /instances/{id}/logout    → unlink from the phone
//   DELETE /instances/{id}           → logout + forget entirely
//   GET    /media/{instance}/{file}  → inbound media the bridge saved

package main

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	qrcode "github.com/skip2/go-qrcode"
)

type API struct {
	cfg Config
	mgr *Manager
	mux *http.ServeMux
}

func NewAPI(cfg Config, mgr *Manager) http.Handler {
	a := &API{cfg: cfg, mgr: mgr, mux: http.NewServeMux()}
	a.mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	a.mux.HandleFunc("POST /instances/{id}/pair", a.auth(a.pair))
	a.mux.HandleFunc("GET /instances/{id}", a.auth(a.status))
	a.mux.HandleFunc("POST /instances/{id}/send/text", a.auth(a.sendText))
	a.mux.HandleFunc("POST /instances/{id}/send/media", a.auth(a.sendMedia))
	a.mux.HandleFunc("POST /instances/{id}/logout", a.auth(a.logout))
	a.mux.HandleFunc("DELETE /instances/{id}", a.auth(a.delete))
	a.mux.HandleFunc("GET /media/{instance}/{file}", a.auth(a.media))
	return a.mux
}

func (a *API) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-Bridge-Key")
		if key == "" || subtle.ConstantTimeCompare([]byte(key), []byte(a.cfg.APIKey)) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid bridge key"})
			return
		}
		next(w, r)
	}
}

// ── handlers ─────────────────────────────────────────────────

func (a *API) pair(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	inst, err := a.mgr.StartPairing(ctx, id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	// Give the QR loop a moment to produce the first code so the very
	// first poll already has something to show.
	deadline := time.Now().Add(5 * time.Second)
	for {
		st, qr, _, _ := inst.snapshot()
		if qr != "" || st == StatusConnected || time.Now().After(deadline) {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	a.writeStatus(w, inst)
}

func (a *API) status(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	inst := a.mgr.get(id)
	if inst == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"instance_id": id, "status": string(StatusDisconnected),
		})
		return
	}
	a.writeStatus(w, inst)
}

func (a *API) writeStatus(w http.ResponseWriter, inst *Instance) {
	st, qr, phone, pushName := inst.snapshot()
	out := map[string]any{
		"instance_id": inst.ID,
		"status":      string(st),
		"phone":       phone,
		"push_name":   pushName,
	}
	if qr != "" {
		// PNG data URL so the app renders it with a plain <img>.
		png, err := qrcode.Encode(qr, qrcode.Medium, 320)
		if err == nil {
			out["qr_data_url"] = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
		}
		out["qr_code"] = qr
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) sendText(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		To       string `json:"to"`
		Text     string `json:"text"`
		QuotedID string `json:"quoted_id"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil || body.To == "" || body.Text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "to and text are required"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()
	msgID, err := a.mgr.SendText(ctx, id, body.To, body.Text, body.QuotedID)
	if err != nil {
		writeSendError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message_id": msgID})
}

func (a *API) sendMedia(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		To       string `json:"to"`
		URL      string `json:"url"`
		Kind     string `json:"kind"`
		Caption  string `json:"caption"`
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil || body.To == "" || body.URL == "" || body.Kind == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "to, url and kind are required"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	msgID, err := a.mgr.SendMedia(ctx, id, body.To, body.URL, body.Kind, body.Caption, body.Filename)
	if err != nil {
		writeSendError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message_id": msgID})
}

func (a *API) logout(w http.ResponseWriter, r *http.Request) {
	if err := a.mgr.Logout(r.Context(), r.PathValue("id")); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *API) delete(w http.ResponseWriter, r *http.Request) {
	if err := a.mgr.Delete(r.Context(), r.PathValue("id")); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// media serves an inbound file the bridge saved. Path segments are
// validated against the same alphabets that produced them, so a crafted
// id can't traverse out of MEDIA_DIR.
func (a *API) media(w http.ResponseWriter, r *http.Request) {
	instance := r.PathValue("instance")
	file := r.PathValue("file")
	if !instanceIDRe.MatchString(instance) || fileNameRe.MatchString(file) {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, filepath.Join(a.cfg.MediaDir, instance, file))
}

// ── helpers ──────────────────────────────────────────────────

func writeSendError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrRateLimited):
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": err.Error()})
	case errors.Is(err, ErrNotConnected):
		writeJSON(w, http.StatusConflict, map[string]any{"error": err.Error()})
	default:
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("writeJSON: %v", err)
	}
}

// fetchMedia downloads an outbound media URL (the app's storage or any
// public URL), capped at 25 MB — WhatsApp's own practical ceiling.
func fetchMedia(ctx context.Context, url string) ([]byte, string, error) {
	if !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "http://") {
		return nil, "", fmt.Errorf("media url must be http(s)")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := (&http.Client{Timeout: 60 * time.Second}).Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("media fetch: status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 25<<20+1))
	if err != nil {
		return nil, "", err
	}
	if len(data) > 25<<20 {
		return nil, "", fmt.Errorf("media larger than 25 MB")
	}
	mimetype := resp.Header.Get("Content-Type")
	if mimetype == "" || mimetype == "application/octet-stream" {
		mimetype = http.DetectContentType(data)
	}
	return data, mimetype, nil
}
