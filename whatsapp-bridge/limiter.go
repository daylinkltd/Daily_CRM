// Per-instance send pacing — the honest ban mitigation.
//
// Unofficial connections get numbers banned for spammy BEHAVIOUR:
// machine-gun velocity, identical blasts, cold lists. The bridge can't
// fix content, but it can refuse to send like a machine: a minimum gap
// with jitter between sends, and an hourly ceiling per number. Both
// are env-tunable; the defaults are deliberately conservative.

package main

import (
	"context"
	"errors"
	"math/rand"
	"strconv"
	"sync"
	"time"
)

type Limiter struct {
	mu        sync.Mutex
	lastSend  time.Time
	window    []time.Time // sends in the trailing hour
	minGap    time.Duration
	jitterMax time.Duration
	perHour   int
}

var ErrRateLimited = errors.New("hourly send cap reached for this number — try later")

func NewLimiter(cfg Config) *Limiter {
	minGapMs, _ := strconv.Atoi(getenv("SEND_MIN_GAP_MS", "3000"))
	jitterMs, _ := strconv.Atoi(getenv("SEND_JITTER_MAX_MS", "4000"))
	perHour, _ := strconv.Atoi(getenv("SEND_MAX_PER_HOUR", "180"))
	return &Limiter{
		minGap:    time.Duration(minGapMs) * time.Millisecond,
		jitterMax: time.Duration(jitterMs) * time.Millisecond,
		perHour:   perHour,
	}
}

// Wait blocks until this send is allowed to go, or fails fast when the
// hourly cap is hit (a queued hour of messages would be worse than a
// clear 429 the app can surface).
func (l *Limiter) Wait(ctx context.Context) error {
	l.mu.Lock()
	now := time.Now()

	// Trim the trailing-hour window.
	cutoff := now.Add(-time.Hour)
	kept := l.window[:0]
	for _, t := range l.window {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	l.window = kept

	if l.perHour > 0 && len(l.window) >= l.perHour {
		l.mu.Unlock()
		return ErrRateLimited
	}

	gap := l.minGap
	if l.jitterMax > 0 {
		gap += time.Duration(rand.Int63n(int64(l.jitterMax)))
	}
	earliest := l.lastSend.Add(gap)
	wait := time.Until(earliest)

	// Claim the slot before sleeping so concurrent senders stack up
	// behind each other instead of all sleeping the same interval.
	if wait > 0 {
		l.lastSend = earliest
	} else {
		l.lastSend = now
	}
	l.window = append(l.window, l.lastSend)
	l.mu.Unlock()

	if wait <= 0 {
		return nil
	}
	select {
	case <-time.After(wait):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
