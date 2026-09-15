// ============================================================
// Dailybuz WhatsApp Bridge
//
// A small, self-owned service that connects WhatsApp numbers over the
// WhatsApp Web multi-device protocol via whatsmeow — no Meta Cloud
// API, no per-conversation charges, no template approvals. The tenant
// pairs by scanning a QR code, exactly like WhatsApp Web.
//
// The Dailybuz app is the ONLY intended client: it calls the REST API
// below (Bearer BRIDGE_API_KEY) and receives events on
// APP_WEBHOOK_URL, HMAC-signed with APP_WEBHOOK_SECRET.
//
// One "instance" = one WhatsApp number = one Dailybuz workspace.
// Session keys live in this service's own Postgres (NOT the app's
// Supabase — the app repo's no-DDL-from-code rule stays intact;
// whatsmeow migrates its own tables here on boot).
//
// Deliberately NOT included: fingerprint spoofing or any machinery to
// evade WhatsApp's anti-abuse systems. The safety layer here is
// behavioural — a per-instance rate limiter with human-ish pacing —
// because unofficial connections get banned for spammy behaviour, and
// pacing is the honest mitigation.
// ============================================================

package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
)

type Config struct {
	Port             string
	DatabaseURL      string
	APIKey           string
	AppWebhookURL    string
	AppWebhookSecret string
	MediaDir         string
}

func loadConfig() Config {
	cfg := Config{
		Port:             getenv("PORT", "8090"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		APIKey:           os.Getenv("BRIDGE_API_KEY"),
		AppWebhookURL:    os.Getenv("APP_WEBHOOK_URL"),
		AppWebhookSecret: os.Getenv("APP_WEBHOOK_SECRET"),
		MediaDir:         getenv("MEDIA_DIR", "/data/media"),
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required (the bridge's own Postgres, not the app's)")
	}
	if cfg.APIKey == "" {
		log.Fatal("BRIDGE_API_KEY is required — the app authenticates with it")
	}
	if cfg.AppWebhookURL == "" || cfg.AppWebhookSecret == "" {
		log.Fatal("APP_WEBHOOK_URL and APP_WEBHOOK_SECRET are required for inbound delivery")
	}
	return cfg
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	cfg := loadConfig()
	ctx := context.Background()

	if err := os.MkdirAll(cfg.MediaDir, 0o755); err != nil {
		log.Fatalf("cannot create MEDIA_DIR %s: %v", cfg.MediaDir, err)
	}

	// whatsmeow's session store — it creates/migrates its own tables.
	dbLog := waLog.Stdout("DB", "WARN", true)
	container, err := sqlstore.New(ctx, "postgres", cfg.DatabaseURL, dbLog)
	if err != nil {
		log.Fatalf("sqlstore init failed: %v", err)
	}

	// Our one table: which instance (workspace) owns which device JID.
	rawDB, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db open failed: %v", err)
	}
	if _, err := rawDB.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS bridge_instances (
			instance_id TEXT PRIMARY KEY,
			jid         TEXT,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`); err != nil {
		log.Fatalf("bridge_instances create failed: %v", err)
	}

	mgr := NewManager(cfg, container, rawDB)
	// Reconnect every previously-paired instance on boot, so a bridge
	// restart doesn't silently disconnect every tenant.
	if err := mgr.ResumeAll(ctx); err != nil {
		log.Printf("resume: %v", err)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           NewAPI(cfg, mgr),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("bridge listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Print("shutting down…")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	mgr.DisconnectAll()
}
