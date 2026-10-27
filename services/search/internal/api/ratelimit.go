package api

import (
	"sync"
	"time"
)

// limiter permite `max` peticiones por ventana y por IP (ventana fija, en memoria: un solo proceso).
type limiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string]*bucket
	sweep  time.Time
}

type bucket struct {
	start time.Time
	count int
}

func newLimiter(max int, window time.Duration) *limiter {
	return &limiter{max: max, window: window, hits: map[string]*bucket{}}
}

// allow dice si la IP aún puede pedir y, si no, cuántos segundos faltan.
func (l *limiter) allow(ip string, now time.Time) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	// Cada ventana se olvidan las IP que no volvieron: la memoria queda acotada
	if now.Sub(l.sweep) > l.window {
		for key, b := range l.hits {
			if now.Sub(b.start) >= l.window {
				delete(l.hits, key)
			}
		}
		l.sweep = now
	}
	b, ok := l.hits[ip]
	if !ok || now.Sub(b.start) >= l.window {
		l.hits[ip] = &bucket{start: now, count: 1}
		return true, 0
	}
	if b.count >= l.max {
		return false, int((l.window - now.Sub(b.start)).Seconds()) + 1
	}
	b.count++
	return true, 0
}
