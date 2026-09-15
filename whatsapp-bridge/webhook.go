// Webhook delivery to the Dailybuz app — every payload HMAC-signed so
// the app can refuse anything that didn't come from this bridge.
//
// Delivery is at-least-once with short retries and then gives up loudly
// in the log. Ordering is preserved per bridge process via a single
// dispatch goroutine; a lost webhook shows up as a missing inbox
// message, which the log line makes diagnosable.

package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type WebhookSender struct {
	cfg    Config
	queue  chan []byte
	client *http.Client
}

func NewWebhookSender(cfg Config) *WebhookSender {
	w := &WebhookSender{
		cfg:    cfg,
		queue:  make(chan []byte, 1024),
		client: &http.Client{Timeout: 15 * time.Second},
	}
	go w.run()
	return w
}

// Send enqueues one event. Never blocks the WhatsApp event loop: if the
// queue is full (app down for a long stretch) the event is dropped with
// a log line rather than stalling every instance.
func (w *WebhookSender) Send(instanceID, event string, data map[string]any) {
	body, err := json.Marshal(map[string]any{
		"instance_id": instanceID,
		"event":       event,
		"data":        data,
		"ts":          time.Now().Unix(),
	})
	if err != nil {
		log.Printf("webhook marshal: %v", err)
		return
	}
	select {
	case w.queue <- body:
	default:
		log.Printf("webhook queue full — dropping %s event for %s", event, instanceID)
	}
}

func (w *WebhookSender) run() {
	for body := range w.queue {
		w.deliver(body)
	}
}

func (w *WebhookSender) deliver(body []byte) {
	mac := hmac.New(sha256.New, []byte(w.cfg.AppWebhookSecret))
	mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))

	backoff := time.Second
	for attempt := 1; attempt <= 4; attempt++ {
		req, err := http.NewRequest(http.MethodPost, w.cfg.AppWebhookURL, bytes.NewReader(body))
		if err != nil {
			log.Printf("webhook request: %v", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Bridge-Signature", sig)

		resp, err := w.client.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode < 300 {
				return
			}
			// 4xx other than 429 will not improve on retry.
			if resp.StatusCode >= 400 && resp.StatusCode < 500 && resp.StatusCode != http.StatusTooManyRequests {
				log.Printf("webhook rejected (%d) — dropping event", resp.StatusCode)
				return
			}
			log.Printf("webhook attempt %d: status %d", attempt, resp.StatusCode)
		} else {
			log.Printf("webhook attempt %d: %v", attempt, err)
		}
		time.Sleep(backoff)
		backoff *= 2
	}
	log.Printf("webhook delivery failed after retries — event lost")
}
