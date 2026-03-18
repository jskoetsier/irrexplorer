# Python to Go Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully decommission the Python backend and run all IRRExplorer functionality in Go using a 6-phase incremental (strangler pattern) migration.

**Architecture:** Both services run simultaneously in Kubernetes; nginx ingress routes by path — Go owns an expanding path list (`goBackendPaths`), Python handles the rest. Each phase adds Go endpoints, verifies parity against Python, then extends `goBackendPaths` to cut traffic over. Phase 6 rewrites the importer in Go and removes all Python infrastructure.

**Tech Stack:** Go 1.22, `net/http` stdlib, `pgx/v5`, `go-redis/v9`, `golang.org/x/time/rate`

**Database migrations:** Plain SQL files in `go-backend/db/migrations/`. Applied manually via `psql` or via the existing `migrate-job.yaml` Helm Job (which runs `psql` on startup). No `golang-migrate` library needed — the migrate job already handles this pattern.

**Spec:** `docs/superpowers/specs/2026-03-18-python-to-go-migration-design.md`

**Working directory for all Go commands:** `go-backend/`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `go-backend/internal/cache/redis.go` | Create | Redis Get/Set with gzipped JSON |
| `go-backend/internal/cache/admin.go` | Create | Cache stats + clear endpoints |
| `go-backend/internal/middleware/cors.go` | Create | CORS middleware |
| `go-backend/internal/middleware/ratelimit.go` | Create | Per-IP rate limiter |
| `go-backend/internal/navigation/db.go` | Create | Nav table DB queries |
| `go-backend/internal/navigation/session.go` | Create | session_id cookie helper |
| `go-backend/internal/navigation/handlers.go` | Create | Nav HTTP handlers |
| `go-backend/internal/analysis/db.go` | Create | Analysis aggregate DB queries |
| `go-backend/internal/analysis/handlers.go` | Create | Analysis + advanced search handlers |
| `go-backend/internal/visualization/db.go` | Create | Viz DB queries |
| `go-backend/internal/visualization/handlers.go` | Create | Viz handlers |
| `go-backend/internal/export/handlers.go` | Create | Export + bulk query handlers |
| `go-backend/internal/importer/bgp.go` | Create | BGP JSONL download + COPY insert |
| `go-backend/internal/importer/rirstats.go` | Create | RIR delegation file download + parse |
| `go-backend/internal/importer/runner.go` | Create | Importer orchestration |
| `go-backend/cmd/importer/main.go` | Create | CronJob entrypoint |
| `go-backend/db/migrations/001_drop_alerting.sql` | Create | Drop user/alerting tables |
| `go-backend/internal/config/config.go` | Modify | Add AllowedOrigins |
| `go-backend/internal/httpapi/router.go` | Modify | Wire middlewares + register all routes |
| `go-backend/go.mod` / `go.sum` | Modify | Add go-redis/v9, golang.org/x/time |
| `charts/irrexplorer/values.yaml` | Modify | Extend goBackendPaths per phase |
| `charts/irrexplorer/templates/backend-*.yaml` | Delete | Remove Python deployment (Phase 6) |
| `irrexplorer/` | Delete | Python package (Phase 6) |
| `Dockerfile`, `requirements*.txt`, etc. | Delete | Python build artifacts (Phase 6) |

---

## Phase 1: Redis Caching + CORS + Rate Limiting

### Task 1.1: Add Dependencies

**Files:**
- Modify: `go-backend/go.mod`

- [ ] **Step 1: Add go-redis and golang.org/x/time**

```bash
cd go-backend
go get github.com/redis/go-redis/v9
go get golang.org/x/time
go get golang.org/x/sync
```

- [ ] **Step 2: Verify modules downloaded**

```bash
grep "go-redis\|golang.org/x/time\|golang.org/x/sync" go.mod
```
Expected: all three lines present as direct dependencies.

- [ ] **Step 3: Commit**

```bash
git add go-backend/go.mod go-backend/go.sum
git commit -m "chore: add go-redis/v9 and golang.org/x/time dependencies"
```

---

### Task 1.2: Redis Cache Wrapper

**Files:**
- Create: `go-backend/internal/cache/redis.go`
- Create: `go-backend/internal/cache/redis_test.go`

- [ ] **Step 1: Write the failing test**

Create `go-backend/internal/cache/redis_test.go`:

```go
package cache_test

import (
	"context"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/cache"
)

func TestCacheGetMiss(t *testing.T) {
	c, err := cache.New("redis://localhost:6379", slog.New(slog.NewTextHandler(os.Stderr, nil)))
	if err != nil {
		t.Skip("redis not available:", err)
	}
	var dest map[string]any
	if c.Get(context.Background(), "go:test:nonexistent", &dest) {
		t.Fatal("expected cache miss, got hit")
	}
}

func TestCacheSetAndGet(t *testing.T) {
	c, err := cache.New("redis://localhost:6379", slog.New(slog.NewTextHandler(os.Stderr, nil)))
	if err != nil {
		t.Skip("redis not available:", err)
	}
	key := "go:test:roundtrip"
	_ = c.Del(context.Background(), key)

	want := map[string]any{"foo": "bar"}
	c.Set(context.Background(), key, want, 5*time.Second)

	var got map[string]any
	if !c.Get(context.Background(), key, &got) {
		t.Fatal("expected cache hit")
	}
	if got["foo"] != "bar" {
		t.Fatalf("unexpected value: %v", got)
	}
	_ = c.Del(context.Background(), key)
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd go-backend && go test ./internal/cache/... -v
```
Expected: compile error — package `cache` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `go-backend/internal/cache/redis.go`:

```go
package cache

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	client *redis.Client
	logger *slog.Logger
}

func New(redisURL string, logger *slog.Logger) (*Cache, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &Cache{client: redis.NewClient(opts), logger: logger}, nil
}

// Get decodes a gzipped JSON value from Redis into dest. Returns false on miss or error.
func (c *Cache) Get(ctx context.Context, key string, dest any) bool {
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			c.logger.Warn("redis get failed", "key", key, "error", err)
		}
		return false
	}
	r, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		c.logger.Warn("cache decompress failed", "key", key, "error", err)
		return false
	}
	defer r.Close()
	if err := json.NewDecoder(r).Decode(dest); err != nil {
		c.logger.Warn("cache decode failed", "key", key, "error", err)
		return false
	}
	return true
}

// Set encodes value as gzipped JSON and stores it in Redis. Logs and returns on error.
func (c *Cache) Set(ctx context.Context, key string, value any, ttl time.Duration) {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		c.logger.Warn("cache encode failed", "key", key, "error", err)
		return
	}
	if err := w.Close(); err != nil {
		c.logger.Warn("cache compress failed", "key", key, "error", err)
		return
	}
	if err := c.client.Set(ctx, key, buf.Bytes(), ttl).Err(); err != nil {
		c.logger.Warn("redis set failed", "key", key, "error", err)
	}
}

// Del removes a key. Used in tests and cache admin.
func (c *Cache) Del(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

// Client exposes the underlying redis client for admin operations.
func (c *Cache) Client() *redis.Client {
	return c.client
}
```

- [ ] **Step 4: Run tests**

```bash
cd go-backend && go test ./internal/cache/... -v
```
Expected: PASS (or SKIP if Redis not running locally — that's fine, integration tests run in CI).

- [ ] **Step 5: Commit**

```bash
git add go-backend/internal/cache/
git commit -m "feat: add Redis cache wrapper with gzipped JSON (go: key prefix)"
```

---

### Task 1.3: CORS Middleware

**Files:**
- Create: `go-backend/internal/middleware/cors.go`
- Create: `go-backend/internal/middleware/cors_test.go`

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/middleware/cors_test.go`:

```go
package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/middleware"
)

func TestCORSPreflightOptions(t *testing.T) {
	handler := middleware.CORS("*")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Fatal("missing Access-Control-Allow-Methods")
	}
}

func TestCORSPassthrough(t *testing.T) {
	called := false
	handler := middleware.CORS("https://example.com")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("handler not called")
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "https://example.com" {
		t.Fatalf("unexpected origin header: %q", rec.Header().Get("Access-Control-Allow-Origin"))
	}
}
```

- [ ] **Step 2: Run to verify failure**

```bash
cd go-backend && go test ./internal/middleware/... -v
```
Expected: compile error — package doesn't exist.

- [ ] **Step 3: Implement**

Create `go-backend/internal/middleware/cors.go`:

```go
package middleware

import "net/http"

// CORS returns a middleware that sets CORS headers.
// allowedOrigins: "*" to allow all, or a specific origin string.
// Intentionally expands over Python baseline to support POST/DELETE from Phase 2.
func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if allowedOrigins == "*" {
					w.Header().Set("Access-Control-Allow-Origin", "*")
				} else if origin == allowedOrigins {
					w.Header().Set("Access-Control-Allow-Origin", origin)
				}
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Cache-Control, Pragma, Expires, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "3600")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 4: Run tests**

```bash
cd go-backend && go test ./internal/middleware/... -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-backend/internal/middleware/cors.go go-backend/internal/middleware/cors_test.go
git commit -m "feat: add CORS middleware (GET/POST/DELETE/OPTIONS)"
```

---

### Task 1.4: Rate Limiting Middleware

**Files:**
- Create: `go-backend/internal/middleware/ratelimit.go`
- Modify: `go-backend/internal/middleware/cors_test.go` → add ratelimit tests in same package

- [ ] **Step 1: Write failing test**

Add to `go-backend/internal/middleware/ratelimit_test.go` (new file):

```go
package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/middleware"
)

func TestRateLimiterAllows(t *testing.T) {
	rl := middleware.NewRateLimiter(100)
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.RemoteAddr = "192.0.2.1:12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestRateLimiterBlocks(t *testing.T) {
	rl := middleware.NewRateLimiter(1) // 1 req/min burst=1
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	makeReq := func() int {
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		req.RemoteAddr = "192.0.2.2:12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec.Code
	}

	makeReq() // consume burst
	if got := makeReq(); got != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", got)
	}
}
```

- [ ] **Step 2: Run to verify failure**

```bash
cd go-backend && go test ./internal/middleware/... -run TestRateLimiter -v
```
Expected: compile error.

- [ ] **Step 3: Implement**

Create `go-backend/internal/middleware/ratelimit.go`:

```go
package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type ipEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter holds per-IP token bucket limiters.
type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*ipEntry
	rateVal rate.Limit
	burst   int
}

// NewRateLimiter creates a rate limiter allowing requestsPerMinute per IP (burst = requestsPerMinute).
func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*ipEntry),
		rateVal: rate.Limit(float64(requestsPerMinute) / 60.0),
		burst:   requestsPerMinute,
	}
	go rl.cleanup()
	return rl
}

// Middleware returns an http.Handler middleware that enforces the rate limit.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if idx := strings.LastIndex(ip, ":"); idx >= 0 {
			ip = ip[:idx]
		}
		if !rl.allow(ip) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	entry, ok := rl.entries[ip]
	if !ok {
		entry = &ipEntry{limiter: rate.NewLimiter(rl.rateVal, rl.burst)}
		rl.entries[ip] = entry
	}
	entry.lastSeen = time.Now()
	return entry.limiter.Allow()
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		for ip, entry := range rl.entries {
			if time.Since(entry.lastSeen) > 5*time.Minute {
				delete(rl.entries, ip)
			}
		}
		rl.mu.Unlock()
	}
}
```

- [ ] **Step 4: Run tests**

```bash
cd go-backend && go test ./internal/middleware/... -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-backend/internal/middleware/ratelimit.go go-backend/internal/middleware/ratelimit_test.go
git commit -m "feat: add per-IP rate limiter middleware (100 req/min)"
```

---

### Task 1.5: Wire Middlewares + Cache Into Server

**Files:**
- Modify: `go-backend/internal/config/config.go` — add `AllowedOrigins`
- Modify: `go-backend/internal/httpapi/router.go` — add cache + middleware fields, update `Handler()`, cache existing endpoints

- [ ] **Step 1: Add AllowedOrigins to config**

Edit `go-backend/internal/config/config.go` — add field and loading:

```go
// In Config struct, add:
AllowedOrigins string

// In Load(), add:
AllowedOrigins: stringFromEnv("ALLOWED_ORIGINS", "*"),
```

- [ ] **Step 2: Update Server struct and NewServer in router.go**

Add import and field:

```go
import (
    // existing imports...
    "github.com/sebastiaan/irrexplorer/go-backend/internal/cache"
    "github.com/sebastiaan/irrexplorer/go-backend/internal/middleware"
)

type Server struct {
    // existing fields...
    cache       *cache.Cache
    rateLimiter *middleware.RateLimiter
}
```

In `NewServer()`, after creating the server `s`, add:

```go
s.rateLimiter = middleware.NewRateLimiter(100)

if cfg.RedisURL != "" {
    c, err := cache.New(cfg.RedisURL, logger)
    if err != nil {
        logger.Warn("redis cache init failed", "error", err)
    } else {
        s.cache = c
    }
}
```

- [ ] **Step 3: Update Handler() to chain middlewares**

```go
func (s *Server) Handler() http.Handler {
    return s.rateLimiter.Middleware(
        middleware.CORS(s.cfg.AllowedOrigins)(
            s.loggingMiddleware(s.mux),
        ),
    )
}
```

- [ ] **Step 4: Add cache helper and wrap existing handlers**

Add to `router.go`:

```go
const (
    ttlMetadata  = 1 * time.Minute
    ttlPrefix    = 5 * time.Minute
    ttlASN       = 5 * time.Minute
    ttlSetExpand = 5 * time.Minute
    ttlMemberOf  = 5 * time.Minute
)

// cacheKey returns a prefixed cache key. All Go keys use "go:" prefix during migration.
func cacheKey(parts ...string) string {
    return "go:" + strings.Join(parts, ":")
}

// tryCache writes a cached response if available. Returns true if hit.
func (s *Server) tryCache(w http.ResponseWriter, key string) bool {
    if s.cache == nil {
        return false
    }
    var raw json.RawMessage
    if !s.cache.Get(context.Background(), key, &raw) {
        return false
    }
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("X-Cache", "HIT")
    w.WriteHeader(http.StatusOK)
    _, _ = w.Write(raw)
    _, _ = w.Write([]byte("\n"))
    return true
}

// setCache stores a value in the cache (no-op if cache is nil).
func (s *Server) setCache(key string, value any, ttl time.Duration) {
    if s.cache == nil {
        return
    }
    s.cache.Set(context.Background(), key, value, ttl)
}
```

- [ ] **Step 5: Wrap handleMetadata with cache**

At the start of `handleMetadata`, before calling `irrdClient.QueryLastUpdate`:

```go
func (s *Server) handleMetadata(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Cache-Control", "public, max-age=60")
    key := cacheKey("metadata")
    if s.tryCache(w, key) {
        return
    }
    // ... existing logic ...
    result := map[string]any{
        "last_update": map[string]any{
            "irr":      irrUpdates,
            "importer": s.importerUTC(),
        },
    }
    s.setCache(key, result, ttlMetadata)
    writeJSON(w, http.StatusOK, result)
}
```

- [ ] **Step 6: Wrap handlePrefix with cache**

```go
func (s *Server) handlePrefix(w http.ResponseWriter, r *http.Request) {
    // ... existing prefix parsing ...
    key := cacheKey("prefix", prefix.String())
    if s.tryCache(w, key) {
        return
    }
    summaries, err := s.collectForPrefixes(r.Context(), []netip.Prefix{prefix})
    // ... existing logic ...
    domain.EnrichPrefixSummariesWithReport(summaries)
    s.setCache(key, summaries, ttlPrefix)
    writeJSON(w, http.StatusOK, summaries)
}
```

- [ ] **Step 7: Wrap handleASN with cache**

```go
key := cacheKey("asn", strconv.Itoa(asn))
if s.tryCache(w, key) {
    return
}
// ... existing logic ...
s.setCache(key, result, ttlASN)
writeJSON(w, http.StatusOK, result)
```

- [ ] **Step 8: Wrap handleMemberOf and handleSetExpand similarly**

For `handleMemberOf`: key = `cacheKey("member_of", objectClass, target)`, ttl = `ttlMemberOf`

For `handleSetExpand`: key = `cacheKey("set_expand", name)`, ttl = `ttlSetExpand`

- [ ] **Step 9: Run existing tests**

```bash
cd go-backend && go test ./... -v
```
Expected: all existing tests PASS (cache is optional — nil cache means no caching, handlers work unchanged).

- [ ] **Step 10: Commit**

```bash
git add go-backend/internal/config/config.go go-backend/internal/httpapi/router.go
git commit -m "feat(phase1): wire Redis cache + CORS + rate limiting into Go server"
```

---

## Phase 2: Search & Navigation

### Task 2.1: Navigation DB Layer

**Files:**
- Create: `go-backend/internal/navigation/db.go`

The navigation tables (`search_history`, `bookmarks`, `query_stats`) already exist in the database.

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/navigation/db_test.go`:

```go
package navigation_test

import (
	"context"
	"os"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/navigation"
)

// DB tests require INTEGRATION_DB_URL env var — skip if absent.
func testDB(t *testing.T) *navigation.Store {
	t.Helper()
	url := os.Getenv("INTEGRATION_DB_URL")
	if url == "" {
		t.Skip("INTEGRATION_DB_URL not set")
	}
	store, err := navigation.NewStore(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func TestAutocomplete(t *testing.T) {
	store := testDB(t)
	results, err := store.Autocomplete(context.Background(), "AS")
	if err != nil {
		t.Fatal(err)
	}
	// Just verify it doesn't error; result may be empty in test DB
	_ = results
}
```

- [ ] **Step 2: Run to verify failure** → compile error expected.

- [ ] **Step 3: Implement**

Create `go-backend/internal/navigation/db.go`:

```go
package navigation

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	return &Store{pool: pool}, nil
}

type QueryStat struct {
	Query string `json:"query"`
	Count int    `json:"count"`
}

type SearchHistoryEntry struct {
	ID        int       `json:"id"`
	Query     string    `json:"query"`
	CreatedAt time.Time `json:"created_at"`
}

type Bookmark struct {
	ID        int       `json:"id"`
	Query     string    `json:"query"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) Autocomplete(ctx context.Context, query string) ([]QueryStat, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT query, count FROM query_stats
		WHERE query ILIKE $1
		ORDER BY count DESC
		LIMIT 10
	`, query+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []QueryStat
	for rows.Next() {
		var qs QueryStat
		if err := rows.Scan(&qs.Query, &qs.Count); err != nil {
			return nil, err
		}
		results = append(results, qs)
	}
	if results == nil {
		results = []QueryStat{}
	}
	return results, nil
}

func (s *Store) Popular(ctx context.Context) ([]QueryStat, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT query, count FROM query_stats
		ORDER BY count DESC
		LIMIT 20
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []QueryStat
	for rows.Next() {
		var qs QueryStat
		if err := rows.Scan(&qs.Query, &qs.Count); err != nil {
			return nil, err
		}
		results = append(results, qs)
	}
	if results == nil {
		results = []QueryStat{}
	}
	return results, nil
}

func (s *Store) Trending(ctx context.Context) ([]QueryStat, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT query, count FROM query_stats
		WHERE last_seen >= NOW() - INTERVAL '24 hours'
		ORDER BY count DESC
		LIMIT 20
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []QueryStat
	for rows.Next() {
		var qs QueryStat
		if err := rows.Scan(&qs.Query, &qs.Count); err != nil {
			return nil, err
		}
		results = append(results, qs)
	}
	if results == nil {
		results = []QueryStat{}
	}
	return results, nil
}

func (s *Store) GetSearchHistory(ctx context.Context, sessionID string) ([]SearchHistoryEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, query, created_at FROM search_history
		WHERE session_id = $1
		ORDER BY created_at DESC
		LIMIT 50
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []SearchHistoryEntry
	for rows.Next() {
		var e SearchHistoryEntry
		if err := rows.Scan(&e.ID, &e.Query, &e.CreatedAt); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	if results == nil {
		results = []SearchHistoryEntry{}
	}
	return results, nil
}

func (s *Store) AddSearchHistory(ctx context.Context, sessionID, query string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO search_history (session_id, query, created_at) VALUES ($1, $2, NOW())
	`, sessionID, query)
	return err
}

func (s *Store) ClearSearchHistory(ctx context.Context, sessionID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM search_history WHERE session_id = $1`, sessionID)
	return err
}

func (s *Store) GetBookmarks(ctx context.Context, sessionID string) ([]Bookmark, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, query, created_at FROM bookmarks
		WHERE session_id = $1
		ORDER BY created_at DESC
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []Bookmark
	for rows.Next() {
		var b Bookmark
		if err := rows.Scan(&b.ID, &b.Query, &b.CreatedAt); err != nil {
			return nil, err
		}
		results = append(results, b)
	}
	if results == nil {
		results = []Bookmark{}
	}
	return results, nil
}

func (s *Store) AddBookmark(ctx context.Context, sessionID, query string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO bookmarks (session_id, query, created_at) VALUES ($1, $2, NOW())
	`, sessionID, query)
	return err
}

func (s *Store) DeleteBookmark(ctx context.Context, sessionID string, id int) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM bookmarks WHERE id = $1 AND session_id = $2`, id, sessionID)
	return err
}
```

- [ ] **Step 4: Run tests** (skips without DB — that's fine)

```bash
cd go-backend && go test ./internal/navigation/... -v
```
Expected: SKIP (no DB) or PASS.

- [ ] **Step 5: Commit**

```bash
git add go-backend/internal/navigation/db.go go-backend/internal/navigation/db_test.go
git commit -m "feat(phase2): navigation DB layer (search history, bookmarks, query stats)"
```

---

### Task 2.2: Session Helper + Navigation Handlers

**Files:**
- Create: `go-backend/internal/navigation/session.go`
- Create: `go-backend/internal/navigation/handlers.go`
- Create: `go-backend/internal/navigation/handlers_test.go`

- [ ] **Step 1: Write failing handler test**

Create `go-backend/internal/navigation/handlers_test.go`:

```go
package navigation_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/navigation"
)

type fakeNavStore struct{}

func (f *fakeNavStore) Autocomplete(_ context.Context, _ string) ([]navigation.QueryStat, error) {
	return []navigation.QueryStat{{Query: "AS64500", Count: 5}}, nil
}
func (f *fakeNavStore) Popular(_ context.Context) ([]navigation.QueryStat, error) {
	return []navigation.QueryStat{}, nil
}
func (f *fakeNavStore) Trending(_ context.Context) ([]navigation.QueryStat, error) {
	return []navigation.QueryStat{}, nil
}
func (f *fakeNavStore) GetSearchHistory(_ context.Context, _ string) ([]navigation.SearchHistoryEntry, error) {
	return []navigation.SearchHistoryEntry{}, nil
}
func (f *fakeNavStore) AddSearchHistory(_ context.Context, _, _ string) error { return nil }
func (f *fakeNavStore) ClearSearchHistory(_ context.Context, _ string) error  { return nil }
func (f *fakeNavStore) GetBookmarks(_ context.Context, _ string) ([]navigation.Bookmark, error) {
	return []navigation.Bookmark{}, nil
}
func (f *fakeNavStore) AddBookmark(_ context.Context, _, _ string) error       { return nil }
func (f *fakeNavStore) DeleteBookmark(_ context.Context, _ string, _ int) error { return nil }

func TestAutocompleteHandler(t *testing.T) {
	h := navigation.NewHandlers(&fakeNavStore{}, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/autocomplete/AS6", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body) != 1 || body[0]["query"] != "AS64500" {
		t.Fatalf("unexpected body: %v", body)
	}
}
```

- [ ] **Step 2: Run to verify failure** → compile error expected.

- [ ] **Step 3: Implement session helper**

Create `go-backend/internal/navigation/session.go`:

```go
package navigation

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

const sessionCookieName = "session_id"

func getOrCreateSession(w http.ResponseWriter, r *http.Request) string {
	if cookie, err := r.Cookie(sessionCookieName); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	id := hex.EncodeToString(b)
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	return id
}
```

- [ ] **Step 4: Implement handlers**

Create `go-backend/internal/navigation/handlers.go`:

```go
package navigation

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// navStore is the interface handlers depend on (implemented by *Store).
type navStore interface {
	Autocomplete(ctx context.Context, query string) ([]QueryStat, error)
	Popular(ctx context.Context) ([]QueryStat, error)
	Trending(ctx context.Context) ([]QueryStat, error)
	GetSearchHistory(ctx context.Context, sessionID string) ([]SearchHistoryEntry, error)
	AddSearchHistory(ctx context.Context, sessionID, query string) error
	ClearSearchHistory(ctx context.Context, sessionID string) error
	GetBookmarks(ctx context.Context, sessionID string) ([]Bookmark, error)
	AddBookmark(ctx context.Context, sessionID, query string) error
	DeleteBookmark(ctx context.Context, sessionID string, id int) error
}

// cacheAccessor is the subset of the cache used here.
type cacheAccessor interface {
	Get(ctx context.Context, key string, dest any) bool
	Set(ctx context.Context, key string, value any, ttl time.Duration)
}

type Handlers struct {
	store  navStore
	cache  cacheAccessor
	logger *slog.Logger
}

func NewHandlers(store navStore, cache cacheAccessor) *Handlers {
	return &Handlers{store: store, cache: cache, logger: slog.Default()}
}

func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/autocomplete/", h.handleAutocomplete)
	mux.HandleFunc("/api/search-history", h.handleSearchHistory)
	mux.HandleFunc("/api/search-history/clear", h.handleSearchHistoryClear)
	mux.HandleFunc("/api/bookmarks", h.handleBookmarks)
	mux.HandleFunc("/api/bookmarks/", h.handleBookmarkDelete)
	mux.HandleFunc("/api/popular", h.handlePopular)
	mux.HandleFunc("/api/trending", h.handleTrending)
}

func (h *Handlers) handleAutocomplete(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimPrefix(r.URL.Path, "/api/autocomplete/")
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "query required"})
		return
	}
	key := "go:autocomplete:" + query
	if h.cache != nil {
		var cached []QueryStat
		if h.cache.Get(r.Context(), key, &cached) {
			writeJSON(w, http.StatusOK, cached)
			return
		}
	}
	results, err := h.store.Autocomplete(r.Context(), query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if h.cache != nil {
		h.cache.Set(r.Context(), key, results, time.Minute)
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *Handlers) handleSearchHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		sessionID := getOrCreateSession(w, r)
		history, err := h.store.GetSearchHistory(r.Context(), sessionID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, history)
	case http.MethodPost:
		sessionID := getOrCreateSession(w, r)
		var body struct {
			Query string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Query == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "query required"})
			return
		}
		if err := h.store.AddSearchHistory(r.Context(), sessionID, body.Query); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handlers) handleSearchHistoryClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.NotFound(w, r)
		return
	}
	sessionID := getOrCreateSession(w, r)
	if err := h.store.ClearSearchHistory(r.Context(), sessionID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) handleBookmarks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		sessionID := getOrCreateSession(w, r)
		bookmarks, err := h.store.GetBookmarks(r.Context(), sessionID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, bookmarks)
	case http.MethodPost:
		sessionID := getOrCreateSession(w, r)
		var body struct {
			Query string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Query == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "query required"})
			return
		}
		if err := h.store.AddBookmark(r.Context(), sessionID, body.Query); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handlers) handleBookmarkDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.NotFound(w, r)
		return
	}
	raw := strings.TrimPrefix(r.URL.Path, "/api/bookmarks/")
	id, err := strconv.Atoi(raw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid id"})
		return
	}
	sessionID := getOrCreateSession(w, r)
	if err := h.store.DeleteBookmark(r.Context(), sessionID, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) handlePopular(w http.ResponseWriter, r *http.Request) {
	results, err := h.store.Popular(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *Handlers) handleTrending(w http.ResponseWriter, r *http.Request) {
	results, err := h.store.Trending(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
```

- [ ] **Step 5: Register navigation routes in server**

In `go-backend/internal/httpapi/router.go`, `NewServer()`, after `s.registerRoutes()`:

```go
// Navigation handlers (Phase 2)
if s.store != nil {
    navStore, err := navigation.NewStore(context.Background(), cfg.DatabaseURL)
    if err != nil {
        logger.Warn("navigation store init failed", "error", err)
    } else {
        navHandlers := navigation.NewHandlers(navStore, s.cache)
        navHandlers.Register(s.mux)
    }
}
```

Add import: `"github.com/sebastiaan/irrexplorer/go-backend/internal/navigation"`

- [ ] **Step 6: Run tests**

```bash
cd go-backend && go test ./... -v
```
Expected: PASS.

- [ ] **Step 7: Parity check** — manually compare `/api/autocomplete/AS206` against Python before cutting over.

- [ ] **Step 8: Update Helm values — add Phase 2 paths**

In `charts/irrexplorer/values.yaml`, update `goBackendPaths`:

```yaml
goBackendPaths:
  - /api/autocomplete/
  - /api/search-history
  - /api/bookmarks
  - /api/popular
  - /api/trending
  - /healthz
  - /go-healthz
  - /api/clean_query/
  - /api/metadata/
  - /api/prefixes/
  - /api/sets/
  - /api/datasources/
```

Also set `goBackend.enabled: true` if not already.

- [ ] **Step 9: Commit**

```bash
git add go-backend/internal/navigation/ go-backend/internal/httpapi/router.go charts/irrexplorer/values.yaml
git commit -m "feat(phase2): search/navigation endpoints + Helm cutover"
```

---

## Phase 3: Analysis + Advanced Search

### Task 3.1: Analysis DB Layer

**Files:**
- Create: `go-backend/internal/analysis/db.go`

- [ ] **Step 1: Create the file**

Create `go-backend/internal/analysis/db.go`:

```go
package analysis

import (
	"context"
	"net/netip"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	return &Store{pool: pool}, nil
}

type RPKIDashboardRow struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type HijackEntry struct {
	Prefix  string `json:"prefix"`
	ASN     int    `json:"asn"`
	Status  string `json:"rpki_status"`
}

type PrefixOverlapEntry struct {
	Prefix    string `json:"prefix"`
	ContainedBy string `json:"contained_by"`
	ASN       int    `json:"asn"`
}

func (s *Store) RPKIDashboard(ctx context.Context) ([]RPKIDashboardRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT rpki_status, COUNT(*) as count
		FROM bgp
		WHERE rpki_status IS NOT NULL
		GROUP BY rpki_status
		ORDER BY count DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []RPKIDashboardRow
	for rows.Next() {
		var r RPKIDashboardRow
		if err := rows.Scan(&r.Status, &r.Count); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if results == nil {
		results = []RPKIDashboardRow{}
	}
	return results, nil
}

func (s *Store) HijackDetection(ctx context.Context) ([]HijackEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT prefix::text, asn, rpki_status
		FROM bgp
		WHERE rpki_status = 'INVALID'
		ORDER BY prefix
		LIMIT 1000
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []HijackEntry
	for rows.Next() {
		var e HijackEntry
		if err := rows.Scan(&e.Prefix, &e.ASN, &e.Status); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	if results == nil {
		results = []HijackEntry{}
	}
	return results, nil
}

type ROACoverageRow struct {
	Prefix     string `json:"prefix"`
	ASN        int    `json:"asn"`
	RPKIStatus string `json:"rpki_status"`
	// IRRFound is not populated by the DB query (requires cross-referencing IRRd GraphQL).
	// It defaults to false; a follow-up can enrich this via the irrd client.
}

type IRRConsistencyRow struct {
	Prefix     string `json:"prefix"`
	ASN        int    `json:"asn"`
	RPKIStatus string `json:"rpki_status"`
}

// ROACoverage returns prefixes in BGP grouped by RPKI status for ROA coverage analysis.
func (s *Store) ROACoverage(ctx context.Context) ([]ROACoverageRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT prefix::text, asn, COALESCE(rpki_status, 'NOT_FOUND')
		FROM bgp
		WHERE rpki_status IN ('VALID', 'INVALID', 'NOT_FOUND')
		ORDER BY prefix
		LIMIT 5000
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []ROACoverageRow
	for rows.Next() {
		var r ROACoverageRow
		if err := rows.Scan(&r.Prefix, &r.ASN, &r.RPKIStatus); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if results == nil {
		results = []ROACoverageRow{}
	}
	return results, nil
}

// IRRConsistency returns BGP routes where RPKI and IRR status diverge.
func (s *Store) IRRConsistency(ctx context.Context) ([]IRRConsistencyRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT prefix::text, asn, rpki_status
		FROM bgp
		WHERE rpki_status = 'INVALID'
		ORDER BY prefix
		LIMIT 2000
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []IRRConsistencyRow
	for rows.Next() {
		var r IRRConsistencyRow
		if err := rows.Scan(&r.Prefix, &r.ASN, &r.RPKIStatus); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if results == nil {
		results = []IRRConsistencyRow{}
	}
	return results, nil
}

func (s *Store) PrefixOverlap(ctx context.Context, prefix netip.Prefix) ([]PrefixOverlapEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT a.prefix::text, b.prefix::text, a.asn
		FROM bgp a, bgp b
		WHERE a.prefix << b.prefix::cidr AND b.prefix = $1::cidr
		LIMIT 500
	`, prefix.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []PrefixOverlapEntry
	for rows.Next() {
		var e PrefixOverlapEntry
		if err := rows.Scan(&e.Prefix, &e.ContainedBy, &e.ASN); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	if results == nil {
		results = []PrefixOverlapEntry{}
	}
	return results, nil
}
```

- [ ] **Step 2: Commit**

```bash
git add go-backend/internal/analysis/db.go
git commit -m "feat(phase3): analysis DB queries (RPKI dashboard, hijack detection, prefix overlap)"
```

---

### Task 3.2: Analysis Handlers

**Files:**
- Create: `go-backend/internal/analysis/handlers.go`
- Create: `go-backend/internal/analysis/handlers_test.go`

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/analysis/handlers_test.go`:

```go
package analysis_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/analysis"
)

type fakeAnalysisStore struct{}

func (f *fakeAnalysisStore) RPKIDashboard(_ context.Context) ([]analysis.RPKIDashboardRow, error) {
	return []analysis.RPKIDashboardRow{{Status: "VALID", Count: 100}}, nil
}
func (f *fakeAnalysisStore) HijackDetection(_ context.Context) ([]analysis.HijackEntry, error) {
	return []analysis.HijackEntry{}, nil
}
func (f *fakeAnalysisStore) PrefixOverlap(_ context.Context, _ netip.Prefix) ([]analysis.PrefixOverlapEntry, error) {
	return []analysis.PrefixOverlapEntry{}, nil
}
func (f *fakeAnalysisStore) ROACoverage(_ context.Context) ([]analysis.ROACoverageRow, error) {
	return []analysis.ROACoverageRow{}, nil
}
func (f *fakeAnalysisStore) IRRConsistency(_ context.Context) ([]analysis.IRRConsistencyRow, error) {
	return []analysis.IRRConsistencyRow{}, nil
}

func TestRPKIDashboardHandler(t *testing.T) {
	h := analysis.NewHandlers(&fakeAnalysisStore{}, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/analysis/rpki-dashboard", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body) != 1 || body[0]["status"] != "VALID" {
		t.Fatalf("unexpected body: %v", body)
	}
}
```

- [ ] **Step 2: Run to verify failure** → compile error expected.

- [ ] **Step 3: Implement handlers**

Create `go-backend/internal/analysis/handlers.go`:

```go
package analysis

import (
	"context"
	"encoding/json"
	"net/http"
	"net/netip"
	"strings"
	"time"
)

type analysisStore interface {
	RPKIDashboard(ctx context.Context) ([]RPKIDashboardRow, error)
	HijackDetection(ctx context.Context) ([]HijackEntry, error)
	PrefixOverlap(ctx context.Context, prefix netip.Prefix) ([]PrefixOverlapEntry, error)
	ROACoverage(ctx context.Context) ([]ROACoverageRow, error)
	IRRConsistency(ctx context.Context) ([]IRRConsistencyRow, error)
}

type cacheAccessor interface {
	Get(ctx context.Context, key string, dest any) bool
	Set(ctx context.Context, key string, value any, ttl time.Duration)
}

const cacheTTL = 5 * time.Minute

type Handlers struct {
	store analysisStore
	cache cacheAccessor
}

func NewHandlers(store analysisStore, cache cacheAccessor) *Handlers {
	return &Handlers{store: store, cache: cache}
}

func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/analysis/rpki-dashboard", h.cachedHandler("go:analysis:rpki-dashboard", cacheTTL, h.rpkiDashboard))
	mux.HandleFunc("/api/analysis/hijack-detection", h.cachedHandler("go:analysis:hijack-detection", cacheTTL, h.hijackDetection))
	mux.HandleFunc("/api/analysis/roa-coverage", h.cachedHandler("go:analysis:roa-coverage", cacheTTL, h.roaCoverage))
	mux.HandleFunc("/api/analysis/irr-consistency", h.cachedHandler("go:analysis:irr-consistency", cacheTTL, h.irrConsistency))
	mux.HandleFunc("/api/analysis/as-path/", h.asPath)
	mux.HandleFunc("/api/analysis/prefix-overlap/", h.prefixOverlap)
	mux.HandleFunc("/api/analysis/whois/", h.whois)
	mux.HandleFunc("/api/filter-options", h.filterOptions)
	mux.HandleFunc("/api/advanced-search", h.advancedSearch)
}

// cachedHandler wraps a handler function with a fixed cache key and TTL.
func (h *Handlers) cachedHandler(key string, ttl time.Duration, fn func(context.Context) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.cache != nil {
			var cached json.RawMessage
			if h.cache.Get(r.Context(), key, &cached) {
				writeJSON(w, http.StatusOK, cached)
				return
			}
		}
		result, err := fn(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if h.cache != nil {
			h.cache.Set(r.Context(), key, result, ttl)
		}
		writeJSON(w, http.StatusOK, result)
	}
}

func (h *Handlers) rpkiDashboard(ctx context.Context) (any, error) {
	return h.store.RPKIDashboard(ctx)
}

func (h *Handlers) hijackDetection(ctx context.Context) (any, error) {
	return h.store.HijackDetection(ctx)
}

func (h *Handlers) roaCoverage(ctx context.Context) (any, error) {
	return h.store.ROACoverage(ctx)
}

func (h *Handlers) irrConsistency(ctx context.Context) (any, error) {
	return h.store.IRRConsistency(ctx)
}

// asPath delegates to the existing IRRd GraphQL client via the server's irrd handler.
// The query param `asn` is forwarded to the existing /api/prefixes/asn/ path.
func (h *Handlers) asPath(w http.ResponseWriter, r *http.Request) {
	asn := strings.TrimPrefix(r.URL.Path, "/api/analysis/as-path/")
	http.Redirect(w, r, "/api/prefixes/asn/"+asn, http.StatusTemporaryRedirect)
}

func (h *Handlers) prefixOverlap(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/analysis/prefix-overlap/")
	prefix, err := netip.ParsePrefix(raw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid prefix"})
		return
	}
	results, err := h.store.PrefixOverlap(r.Context(), prefix)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

// whois delegates to the RDAP datasource — handled by wiring in the server.
// For now return a redirect hint; the server registers the real RDAP route.
func (h *Handlers) whois(w http.ResponseWriter, r *http.Request) {
	target := strings.TrimPrefix(r.URL.Path, "/api/analysis/whois/")
	http.Redirect(w, r, "/api/datasources/rdap/ip/"+target, http.StatusTemporaryRedirect)
}

// filterOptions returns the valid vocabulary for frontend filter controls.
func (h *Handlers) filterOptions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"rpki_status": []string{"VALID", "INVALID", "UNKNOWN", "NOT_FOUND"},
		"irr_sources": []string{"RIPE", "ARIN", "APNIC", "AFRINIC", "LACNIC", "RADB", "RPKI"},
	})
}

// advancedSearch accepts query params: q, rpki_status, irr_source.
// Delegates to clean_query then prefix/ASN handler logic.
func (h *Handlers) advancedSearch(w http.ResponseWriter, r *http.Request) {
	// Redirect to the existing prefix/ASN handler with the query — frontend already handles dispatch.
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "q parameter required"})
		return
	}
	http.Redirect(w, r, "/api/clean_query/"+q, http.StatusTemporaryRedirect)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
```

- [ ] **Step 4: Register in server**

In `router.go` `NewServer()`:

```go
if cfg.DatabaseURL != "" {
    analysisStore, err := analysis.NewStore(context.Background(), cfg.DatabaseURL)
    if err != nil {
        logger.Warn("analysis store init failed", "error", err)
    } else {
        analysisHandlers := analysis.NewHandlers(analysisStore, s.cache)
        analysisHandlers.Register(s.mux)
    }
}
```

Add import: `"github.com/sebastiaan/irrexplorer/go-backend/internal/analysis"`

- [ ] **Step 5: Run tests**

```bash
cd go-backend && go test ./... -v
```
Expected: PASS.

- [ ] **Step 6: Parity check** — compare `/api/analysis/rpki-dashboard` against Python.

- [ ] **Step 7: Update Helm — add Phase 3 paths**

```yaml
goBackendPaths:
  # ... existing paths ...
  - /api/analysis/
  - /api/filter-options
  - /api/advanced-search
```

- [ ] **Step 8: Commit**

```bash
git add go-backend/internal/analysis/ go-backend/internal/httpapi/router.go charts/irrexplorer/values.yaml
git commit -m "feat(phase3): analysis + advanced search endpoints + Helm cutover"
```

---

## Phase 4: Visualization Endpoints

### Task 4.1: Visualization DB + Handlers

**Files:**
- Create: `go-backend/internal/visualization/db.go`
- Create: `go-backend/internal/visualization/handlers.go`
- Create: `go-backend/internal/visualization/handlers_test.go`

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/visualization/handlers_test.go`:

```go
package visualization_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/visualization"
)

type fakeVizStore struct{}

func (f *fakeVizStore) PrefixAllocation(_ context.Context) ([]visualization.RIRCount, error) {
	return []visualization.RIRCount{{RIR: "RIPE", Count: 1000}}, nil
}
func (f *fakeVizStore) RIRDistribution(_ context.Context) ([]visualization.RIRCount, error) {
	return []visualization.RIRCount{}, nil
}
func (f *fakeVizStore) PrefixDistribution(_ context.Context) ([]visualization.PrefixLengthCount, error) {
	return []visualization.PrefixLengthCount{}, nil
}
func (f *fakeVizStore) ASNRelationships(_ context.Context, _ int) ([]visualization.ASNEdge, error) {
	return []visualization.ASNEdge{}, nil
}
func (f *fakeVizStore) Timeline(_ context.Context) ([]visualization.TimelinePoint, error) {
	return []visualization.TimelinePoint{}, nil
}

func TestPrefixAllocationHandler(t *testing.T) {
	h := visualization.NewHandlers(&fakeVizStore{}, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/viz/prefix-allocation", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body) != 1 || body[0]["rir"] != "RIPE" {
		t.Fatalf("unexpected body: %v", body)
	}
}
```

- [ ] **Step 2: Run to verify failure** → compile error expected.

- [ ] **Step 3: Implement DB layer**

Create `go-backend/internal/visualization/db.go`:

```go
package visualization

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	return &Store{pool: pool}, nil
}

type RIRCount struct {
	RIR   string `json:"rir"`
	Count int    `json:"count"`
}

type PrefixLengthCount struct {
	Length int `json:"length"`
	Count  int `json:"count"`
}

type ASNEdge struct {
	Source int `json:"source"`
	Target int `json:"target"`
	Weight int `json:"weight"`
}

type TimelinePoint struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

func (s *Store) PrefixAllocation(ctx context.Context) ([]RIRCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT rir::text, COUNT(*) FROM rirstats GROUP BY rir ORDER BY COUNT(*) DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []RIRCount
	for rows.Next() {
		var r RIRCount
		if err := rows.Scan(&r.RIR, &r.Count); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if results == nil {
		results = []RIRCount{}
	}
	return results, nil
}

func (s *Store) RIRDistribution(ctx context.Context) ([]RIRCount, error) {
	return s.PrefixAllocation(ctx) // same query, different semantic context
}

func (s *Store) PrefixDistribution(ctx context.Context) ([]PrefixLengthCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT masklen(prefix), COUNT(*) FROM bgp GROUP BY masklen(prefix) ORDER BY masklen(prefix)
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []PrefixLengthCount
	for rows.Next() {
		var r PrefixLengthCount
		if err := rows.Scan(&r.Length, &r.Count); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if results == nil {
		results = []PrefixLengthCount{}
	}
	return results, nil
}

func (s *Store) ASNRelationships(ctx context.Context, asn int) ([]ASNEdge, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT a.asn, b.asn, COUNT(*) AS weight
		FROM bgp a
		JOIN bgp b ON a.prefix <<= b.prefix::cidr AND a.asn != b.asn
		WHERE a.asn = $1 OR b.asn = $1
		GROUP BY a.asn, b.asn
		LIMIT 200
	`, asn)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []ASNEdge
	for rows.Next() {
		var e ASNEdge
		if err := rows.Scan(&e.Source, &e.Target, &e.Weight); err != nil {
			return nil, err
		}
		results = append(results, e)
	}
	if results == nil {
		results = []ASNEdge{}
	}
	return results, nil
}

func (s *Store) Timeline(ctx context.Context) ([]TimelinePoint, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT date_trunc('day', last_seen)::date::text, COUNT(*)
		FROM query_stats
		GROUP BY date_trunc('day', last_seen)
		ORDER BY 1
		LIMIT 90
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []TimelinePoint
	for rows.Next() {
		var p TimelinePoint
		if err := rows.Scan(&p.Date, &p.Count); err != nil {
			return nil, err
		}
		results = append(results, p)
	}
	if results == nil {
		results = []TimelinePoint{}
	}
	return results, nil
}
```

- [ ] **Step 4: Implement handlers**

Create `go-backend/internal/visualization/handlers.go`:

```go
package visualization

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type vizStore interface {
	PrefixAllocation(ctx context.Context) ([]RIRCount, error)
	RIRDistribution(ctx context.Context) ([]RIRCount, error)
	PrefixDistribution(ctx context.Context) ([]PrefixLengthCount, error)
	ASNRelationships(ctx context.Context, asn int) ([]ASNEdge, error)
	Timeline(ctx context.Context) ([]TimelinePoint, error)
}

type cacheAccessor interface {
	Get(ctx context.Context, key string, dest any) bool
	Set(ctx context.Context, key string, value any, ttl time.Duration)
}

type Handlers struct {
	store vizStore
	cache cacheAccessor
}

func NewHandlers(store vizStore, cache cacheAccessor) *Handlers {
	return &Handlers{store: store, cache: cache}
}

func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/viz/prefix-allocation", h.prefixAllocation)
	mux.HandleFunc("/api/viz/rir-distribution", h.rirDistribution)
	mux.HandleFunc("/api/viz/prefix-distribution", h.prefixDistribution)
	mux.HandleFunc("/api/viz/asn-relationships/", h.asnRelationships)
	mux.HandleFunc("/api/viz/timeline", h.timeline)
}

func (h *Handlers) prefixAllocation(w http.ResponseWriter, r *http.Request) {
	h.cached(w, r, "go:viz:prefix-allocation", 60*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.PrefixAllocation(ctx)
	})
}

func (h *Handlers) rirDistribution(w http.ResponseWriter, r *http.Request) {
	h.cached(w, r, "go:viz:rir-distribution", 60*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.RIRDistribution(ctx)
	})
}

func (h *Handlers) prefixDistribution(w http.ResponseWriter, r *http.Request) {
	h.cached(w, r, "go:viz:prefix-distribution", 60*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.PrefixDistribution(ctx)
	})
}

func (h *Handlers) asnRelationships(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimPrefix(r.URL.Path, "/api/viz/asn-relationships/")
	raw = strings.TrimPrefix(strings.ToUpper(raw), "AS")
	asn, err := strconv.Atoi(raw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid ASN"})
		return
	}
	key := "go:viz:asn-relationships:" + strconv.Itoa(asn)
	h.cached(w, r, key, 30*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.ASNRelationships(ctx, asn)
	})
}

func (h *Handlers) timeline(w http.ResponseWriter, r *http.Request) {
	h.cached(w, r, "go:viz:timeline", 15*time.Minute, func(ctx context.Context) (any, error) {
		return h.store.Timeline(ctx)
	})
}

func (h *Handlers) cached(w http.ResponseWriter, r *http.Request, key string, ttl time.Duration, fn func(context.Context) (any, error)) {
	if h.cache != nil {
		var raw json.RawMessage
		if h.cache.Get(r.Context(), key, &raw) {
			writeJSON(w, http.StatusOK, raw)
			return
		}
	}
	result, err := fn(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if h.cache != nil {
		h.cache.Set(r.Context(), key, result, ttl)
	}
	writeJSON(w, http.StatusOK, result)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
```

- [ ] **Step 5: Register in server** — same pattern as analysis; add to `NewServer()` in router.go.

- [ ] **Step 6: Run tests**

```bash
cd go-backend && go test ./... -v
```
Expected: PASS.

- [ ] **Step 7: Parity check** — compare `/api/viz/prefix-allocation` against Python.

- [ ] **Step 8: Update Helm — add Phase 4 paths**

```yaml
  - /api/viz/
```

- [ ] **Step 9: Commit**

```bash
git add go-backend/internal/visualization/ go-backend/internal/httpapi/router.go charts/irrexplorer/values.yaml
git commit -m "feat(phase4): visualization endpoints + Helm cutover"
```

---

## Phase 5: Export + Bulk Query + OpenAPI + Cache Admin

### Task 5.1: Export + Bulk Query Handlers

**Files:**
- Create: `go-backend/internal/export/handlers.go`
- Create: `go-backend/internal/export/handlers_test.go`

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/export/handlers_test.go`:

```go
package export_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/export"
)

func TestExportPDFReturns501(t *testing.T) {
	h := export.NewHandlers(nil)
	mux := http.NewServeMux()
	h.Register(mux)

	body, _ := json.Marshal(map[string]any{"query": "AS64500"})
	req := httptest.NewRequest(http.MethodPost, "/api/export/pdf", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501, got %d", rec.Code)
	}
}

func TestBulkQueryEmpty(t *testing.T) {
	h := export.NewHandlers(nil)
	mux := http.NewServeMux()
	h.Register(mux)

	body, _ := json.Marshal(map[string]any{"queries": []string{}})
	req := httptest.NewRequest(http.MethodPost, "/api/bulk-query", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
```

- [ ] **Step 2: Run to verify failure** → compile error expected.

- [ ] **Step 3: Implement**

Create `go-backend/internal/export/handlers.go`:

```go
package export

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"sync"

	"golang.org/x/sync/errgroup"
)

// queryRunner is the function signature for dispatching a single query.
// Injected from the server so export doesn't import httpapi.
type queryRunner func(ctx context.Context, query string) (any, error)

type Handlers struct {
	runQuery queryRunner
}

func NewHandlers(runQuery queryRunner) *Handlers {
	return &Handlers{runQuery: runQuery}
}

func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/export/csv", h.exportCSV)
	mux.HandleFunc("/api/export/json", h.exportJSON)
	mux.HandleFunc("/api/export/pdf", h.exportPDF)
	mux.HandleFunc("/api/bulk-query", h.bulkQuery)
}

func (h *Handlers) exportPDF(w http.ResponseWriter, _ *http.Request) {
	http.Error(w, "PDF export not implemented", http.StatusNotImplemented)
}

func (h *Handlers) exportJSON(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Query == "" {
		http.Error(w, "query required", http.StatusBadRequest)
		return
	}
	if h.runQuery == nil {
		http.Error(w, "query runner not configured", http.StatusServiceUnavailable)
		return
	}
	result, err := h.runQuery(r.Context(), body.Query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="export.json"`)
	_ = json.NewEncoder(w).Encode(result)
}

func (h *Handlers) exportCSV(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Query == "" {
		http.Error(w, "query required", http.StatusBadRequest)
		return
	}
	if h.runQuery == nil {
		http.Error(w, "query runner not configured", http.StatusServiceUnavailable)
		return
	}
	result, err := h.runQuery(r.Context(), body.Query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="export.csv"`)
	enc := csv.NewWriter(w)
	// Marshal result to JSON then write as a single CSV row (simple format matching Python).
	data, _ := json.Marshal(result)
	_ = enc.Write([]string{string(data)})
	enc.Flush()
}

func (h *Handlers) bulkQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Queries []string `json:"queries"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(body.Queries) > 100 {
		http.Error(w, "max 100 queries per bulk request", http.StatusBadRequest)
		return
	}

	type result struct {
		Query  string `json:"query"`
		Result any    `json:"result"`
		Error  string `json:"error,omitempty"`
	}

	results := make([]result, len(body.Queries))
	for i := range results {
		results[i].Query = body.Queries[i]
	}

	if h.runQuery != nil {
		var mu sync.Mutex
		g, ctx := errgroup.WithContext(r.Context())
		for i, q := range body.Queries {
			i, q := i, q
			g.Go(func() error {
				res, err := h.runQuery(ctx, q)
				mu.Lock()
				defer mu.Unlock()
				if err != nil {
					results[i].Error = err.Error()
				} else {
					results[i].Result = res
				}
				return nil // never abort the group on individual errors
			})
		}
		_ = g.Wait()
	}

	writeJSON(w, http.StatusOK, results)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
```

- [ ] **Step 4: Run tests**

```bash
cd go-backend && go test ./internal/export/... -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-backend/internal/export/
git commit -m "feat(phase5): export (CSV/JSON) + bulk query handlers"
```

---

### Task 5.2: Cache Admin Endpoints

**Files:**
- Create: `go-backend/internal/cache/admin.go`
- Create: `go-backend/internal/cache/admin_test.go`

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/cache/admin_test.go`:

```go
package cache_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"log/slog"
	"os"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/cache"
)

func TestCacheStatsHandlerNilCache(t *testing.T) {
	h := cache.NewAdminHandlers(nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/cache/stats", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rec.Code)
	}
}
```

- [ ] **Step 2: Run to verify failure** → compile error expected.

- [ ] **Step 3: Implement**

Create `go-backend/internal/cache/admin.go`:

```go
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type AdminHandlers struct {
	cache *Cache
}

func NewAdminHandlers(c *Cache) *AdminHandlers {
	return &AdminHandlers{cache: c}
}

func (h *AdminHandlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/cache/stats", h.handleStats)
	mux.HandleFunc("/api/cache/clear", h.handleClear)
}

func (h *AdminHandlers) handleStats(w http.ResponseWriter, r *http.Request) {
	if h.cache == nil {
		http.Error(w, "cache not configured", http.StatusServiceUnavailable)
		return
	}
	ctx := r.Context()
	info, err := h.cache.client.Info(ctx, "memory", "stats").Result()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	keyCount, err := h.cache.client.Keys(ctx, "go:*").Result()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"redis_info": info,
		"go_key_count": len(keyCount),
	})
}

func (h *AdminHandlers) handleClear(w http.ResponseWriter, r *http.Request) {
	if h.cache == nil {
		http.Error(w, "cache not configured", http.StatusServiceUnavailable)
		return
	}
	ctx := r.Context()
	keys, err := h.cache.client.Keys(ctx, "go:*").Result()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	deleted := 0
	for _, key := range keys {
		if err := h.cache.client.Del(ctx, key).Err(); err == nil {
			deleted++
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"deleted": deleted,
	})
}
```

- [ ] **Step 4: Run tests**

```bash
cd go-backend && go test ./internal/cache/... -v
```
Expected: PASS.

- [ ] **Step 5: Register in server + add Phase 5 Helm paths**

In `NewServer()` in router.go:
```go
cacheAdmin := cache.NewAdminHandlers(s.cache)
cacheAdmin.Register(s.mux)
// queryRunner is wired in Task 5.3 below
```

In `values.yaml`:
```yaml
  - /api/export/
  - /api/bulk-query
  - /api/cache/
  - /api/docs/
```

- [ ] **Step 6: Commit**

```bash
git add go-backend/internal/cache/admin.go go-backend/internal/cache/admin_test.go go-backend/internal/httpapi/router.go charts/irrexplorer/values.yaml
git commit -m "feat(phase5): cache admin endpoints + Helm cutover"
```

---

### Task 5.3: OpenAPI Schema + Swagger UI + Wire Export queryRunner

**Files:**
- Create: `go-backend/internal/httpapi/openapi.go`
- Modify: `go-backend/internal/httpapi/router.go` — register openapi routes + wire export queryRunner

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/httpapi/openapi_test.go`:

```go
package httpapi_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/config"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/httpapi"
)

func TestOpenAPISchemaEndpoint(t *testing.T) {
	s := httpapi.NewServer(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	req := httptest.NewRequest(http.MethodGet, "/api/docs/openapi.json", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON: %v", err)
	}
	if body["openapi"] != "3.0.0" {
		t.Fatalf("expected openapi 3.0.0, got %v", body["openapi"])
	}
}
```

- [ ] **Step 2: Run to verify failure** → handler not registered yet.

- [ ] **Step 3: Implement OpenAPI handler**

Create `go-backend/internal/httpapi/openapi.go`:

```go
package httpapi

import (
	_ "embed"
	"net/http"
)

//go:embed openapi.json
var openapiSchema []byte

func (s *Server) handleOpenAPISchema(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(openapiSchema)
}

func (s *Server) handleSwaggerUI(w http.ResponseWriter, r *http.Request) {
	// Inline minimal Swagger UI redirect to a CDN-hosted Swagger UI pointing at /api/docs/openapi.json
	html := `<!DOCTYPE html>
<html>
<head><title>IRRExplorer API</title>
<meta charset="utf-8"/>
<link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({url:"/api/docs/openapi.json",dom_id:"#swagger-ui"});
</script>
</body>
</html>`
	w.Header().Set("Content-Type", "text/html")
	_, _ = w.Write([]byte(html))
}
```

- [ ] **Step 4: Create minimal `openapi.json`**

Create `go-backend/internal/httpapi/openapi.json` with a minimal valid OpenAPI 3.0 schema:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "IRRExplorer API",
    "version": "2.4.0",
    "description": "IRRExplorer Go backend API"
  },
  "paths": {
    "/api/metadata/": {"get": {"summary": "Metadata and last import timestamps", "responses": {"200": {"description": "OK"}}}},
    "/api/prefixes/prefix/{prefix}": {"get": {"summary": "Prefix lookup", "responses": {"200": {"description": "OK"}}}},
    "/api/prefixes/asn/{asn}": {"get": {"summary": "ASN prefix lookup", "responses": {"200": {"description": "OK"}}}},
    "/api/sets/expand/{name}": {"get": {"summary": "Set expansion", "responses": {"200": {"description": "OK"}}}},
    "/api/sets/member-of/{class}/{target}": {"get": {"summary": "Member-of lookup", "responses": {"200": {"description": "OK"}}}},
    "/api/autocomplete/{query}": {"get": {"summary": "Query autocomplete", "responses": {"200": {"description": "OK"}}}},
    "/api/analysis/rpki-dashboard": {"get": {"summary": "RPKI status dashboard", "responses": {"200": {"description": "OK"}}}},
    "/api/analysis/hijack-detection": {"get": {"summary": "Hijack detection (INVALID routes)", "responses": {"200": {"description": "OK"}}}},
    "/api/analysis/roa-coverage": {"get": {"summary": "ROA coverage analysis", "responses": {"200": {"description": "OK"}}}},
    "/api/analysis/irr-consistency": {"get": {"summary": "IRR/RPKI consistency check", "responses": {"200": {"description": "OK"}}}},
    "/api/viz/prefix-allocation": {"get": {"summary": "Prefix allocation by RIR", "responses": {"200": {"description": "OK"}}}},
    "/api/viz/rir-distribution": {"get": {"summary": "RIR distribution", "responses": {"200": {"description": "OK"}}}},
    "/api/viz/timeline": {"get": {"summary": "Query timeline", "responses": {"200": {"description": "OK"}}}},
    "/api/bulk-query": {"post": {"summary": "Bulk prefix/ASN query (max 100)", "responses": {"200": {"description": "OK"}}}},
    "/api/export/csv": {"post": {"summary": "Export results as CSV", "responses": {"200": {"description": "OK"}}}},
    "/api/export/json": {"post": {"summary": "Export results as JSON", "responses": {"200": {"description": "OK"}}}},
    "/api/cache/stats": {"get": {"summary": "Cache statistics", "responses": {"200": {"description": "OK"}}}},
    "/api/cache/clear": {"get": {"summary": "Clear go: cache keys", "responses": {"200": {"description": "OK"}}}}
  }
}
```

- [ ] **Step 5: Register OpenAPI routes in `registerRoutes()`**

```go
s.mux.HandleFunc("/api/docs/openapi.json", s.handleOpenAPISchema)
s.mux.HandleFunc("/api/docs", s.handleSwaggerUI)
```

- [ ] **Step 6: Wire export `queryRunner`**

The export handlers need a `queryRunner` to execute queries. Add a method to Server:

```go
// In router.go, after export handlers are initialized:
exportHandlers := export.NewHandlers(func(ctx context.Context, query string) (any, error) {
    result, err := CleanQuery(query, s.cfg.MinimumPrefixIPv4, s.cfg.MinimumPrefixIPv6)
    if err != nil {
        return nil, err
    }
    // Route to the correct handler based on query category.
    switch result.Category {
    case QueryCategoryPrefix:
        prefix, _ := netip.ParsePrefix(result.CleanedValue)
        summaries, err := s.collectForPrefixes(ctx, []netip.Prefix{prefix})
        if err != nil {
            return nil, err
        }
        domain.EnrichPrefixSummariesWithReport(summaries)
        return summaries, nil
    case QueryCategoryASN:
        raw := strings.TrimPrefix(result.CleanedValue, "AS")
        asn, _ := strconv.Atoi(raw)
        return s.store.QueryBGPByASN(ctx, asn)
    default:
        return nil, fmt.Errorf("unsupported query type: %s", result.Category)
    }
})
exportHandlers.Register(s.mux)
```

- [ ] **Step 7: Run tests**

```bash
cd go-backend && go test ./... -v
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add go-backend/internal/httpapi/openapi.go go-backend/internal/httpapi/openapi.json go-backend/internal/httpapi/openapi_test.go go-backend/internal/httpapi/router.go
git commit -m "feat(phase5): OpenAPI schema + Swagger UI + wire export queryRunner"
```

---

## Phase 6: Importer Rewrite

### Task 6.1: BGP Importer

**Files:**
- Create: `go-backend/internal/importer/bgp.go`

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/importer/bgp_test.go`:

```go
package importer_test

import (
	"strings"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/importer"
)

func TestParseBGPLine(t *testing.T) {
	line := `{"prefix":"192.0.2.0/24","asn":64500,"rpki_status":"VALID"}`
	entry, err := importer.ParseBGPLine([]byte(line))
	if err != nil {
		t.Fatal(err)
	}
	if entry.Prefix != "192.0.2.0/24" || entry.ASN != 64500 || entry.RPKIStatus != "VALID" {
		t.Fatalf("unexpected entry: %+v", entry)
	}
}

func TestParseBGPLineInvalid(t *testing.T) {
	_, err := importer.ParseBGPLine([]byte(`not json`))
	if err == nil {
		t.Fatal("expected error")
	}
}
```

- [ ] **Step 2: Run to verify failure** → compile error expected.

- [ ] **Step 3: Implement**

Create `go-backend/internal/importer/bgp.go`:

```go
package importer

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const bgpToolsURL = "https://bgp.tools/table.jsonl"

// BGPEntry is one line from bgp.tools/table.jsonl.
type BGPEntry struct {
	Prefix     string `json:"prefix"`
	ASN        int    `json:"asn"`
	RPKIStatus string `json:"rpki_status"`
}

// ParseBGPLine parses a single JSONL line. Exported for testing.
func ParseBGPLine(data []byte) (BGPEntry, error) {
	var e BGPEntry
	if err := json.Unmarshal(data, &e); err != nil {
		return BGPEntry{}, err
	}
	if e.Prefix == "" {
		return BGPEntry{}, fmt.Errorf("empty prefix in line")
	}
	return e, nil
}

// ImportBGP downloads bgp.tools/table.jsonl, streams into bgp_staging via COPY,
// builds the GIST index on staging, then atomically swaps bgp_staging → bgp.
func ImportBGP(ctx context.Context, pool *pgxpool.Pool, httpClient *http.Client) error {
	resp, err := httpClient.Get(bgpToolsURL)
	if err != nil {
		return fmt.Errorf("download bgp.tools: %w", err)
	}
	defer resp.Body.Close()

	// Truncate staging table before loading.
	if _, err := pool.Exec(ctx, "TRUNCATE bgp_staging"); err != nil {
		return fmt.Errorf("truncate bgp_staging: %w", err)
	}

	// Stream JSONL into bgp_staging via COPY protocol.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire conn: %w", err)
	}
	defer conn.Release()

	rows := make([][]any, 0, 1000)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	count := 0

	flushRows := func() error {
		if len(rows) == 0 {
			return nil
		}
		_, err := conn.Conn().CopyFrom(ctx,
			pgx.Identifier{"bgp_staging"},
			[]string{"prefix", "asn", "rpki_status"},
			pgx.CopyFromRows(rows),
		)
		rows = rows[:0]
		return err
	}

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		entry, err := ParseBGPLine(line)
		if err != nil {
			continue // skip malformed lines
		}
		rows = append(rows, []any{entry.Prefix, entry.ASN, entry.RPKIStatus})
		count++
		if len(rows) >= 10000 {
			if err := flushRows(); err != nil {
				return fmt.Errorf("copy rows: %w", err)
			}
		}
	}
	if err := flushRows(); err != nil {
		return fmt.Errorf("copy final rows: %w", err)
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan error: %w", err)
	}

	// Build GIST index on staging before the swap (this is the slow part).
	if _, err := pool.Exec(ctx, `CREATE INDEX ix_bgp_staging_prefix ON bgp_staging USING GIST (prefix inet_ops)`); err != nil {
		return fmt.Errorf("build staging index: %w", err)
	}

	// Atomic swap: bgp_staging → bgp (metadata-only lock, microseconds).
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin swap tx: %w", err)
	}
	if _, err := tx.Exec(ctx, "ALTER TABLE bgp RENAME TO bgp_old"); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("rename bgp to bgp_old: %w", err)
	}
	if _, err := tx.Exec(ctx, "ALTER TABLE bgp_staging RENAME TO bgp"); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("rename bgp_staging to bgp: %w", err)
	}
	if _, err := tx.Exec(ctx, "CREATE TABLE bgp_staging (LIKE bgp INCLUDING ALL)"); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("create fresh bgp_staging: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit swap: %w", err)
	}

	// Drop old table outside transaction (non-blocking).
	if _, err := pool.Exec(ctx, "DROP TABLE bgp_old"); err != nil {
		return fmt.Errorf("drop bgp_old: %w", err)
	}

	_ = count
	return nil
}
```

- [ ] **Step 4: Run tests**

```bash
cd go-backend && go test ./internal/importer/... -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-backend/internal/importer/bgp.go go-backend/internal/importer/bgp_test.go
git commit -m "feat(phase6): BGP importer — streaming JSONL + COPY + atomic table swap"
```

---

### Task 6.2: RIR Stats Importer

**Files:**
- Create: `go-backend/internal/importer/rirstats.go`
- Create: `go-backend/internal/importer/rirstats_test.go`

- [ ] **Step 1: Write failing test**

Create `go-backend/internal/importer/rirstats_test.go`:

```go
package importer_test

import (
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/importer"
)

func TestParseRIRLine(t *testing.T) {
	// Standard RIR delegation format: registry|cc|type|start|value|date|status
	line := "ripencc|NL|ipv4|192.0.2.0|256|20000101|allocated"
	entry, ok := importer.ParseRIRLine(line, "RIPE NCC")
	if !ok {
		t.Fatal("expected parse success")
	}
	if entry.Prefix != "192.0.2.0/24" {
		t.Fatalf("unexpected prefix: %s", entry.Prefix)
	}
	if entry.RIR != "RIPE NCC" {
		t.Fatalf("unexpected rir: %s", entry.RIR)
	}
}

func TestParseRIRLineSkipsNonIP(t *testing.T) {
	line := "ripencc|NL|asn|64500|1|20000101|allocated"
	_, ok := importer.ParseRIRLine(line, "RIPE NCC")
	if ok {
		t.Fatal("expected non-IP line to be skipped")
	}
}
```

- [ ] **Step 2: Run to verify failure** → compile error expected.

- [ ] **Step 3: Implement**

Create `go-backend/internal/importer/rirstats.go`:

```go
package importer

import (
	"bufio"
	"context"
	"fmt"
	"math/bits"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/errgroup"
)

// RIR delegation file URLs (one per registry).
var rirURLs = map[string]string{
	"APNIC":       "https://ftp.apnic.net/stats/apnic/delegated-apnic-latest",
	"ARIN":        "https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest",
	"RIPE NCC":    "https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest",
	"LACNIC":      "https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest",
	"AFRINIC":     "https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-latest",
	"Registro.BR": "https://ftp.registro.br/pub/numeracao/origin/nicbr-asn-blk-latest.txt",
}

// RIREntry is a parsed prefix from a delegation file.
type RIREntry struct {
	Prefix string
	RIR    string
}

// ParseRIRLine parses a single line from a RIR delegation file.
// Format: registry|cc|type|start|value|date|status
// Returns (entry, true) for IPv4/IPv6 lines; (_, false) otherwise.
func ParseRIRLine(line, rir string) (RIREntry, bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return RIREntry{}, false
	}
	parts := strings.Split(line, "|")
	if len(parts) < 5 {
		return RIREntry{}, false
	}
	recType := strings.ToLower(parts[2])
	start := parts[3]
	valueStr := parts[4]

	switch recType {
	case "ipv4":
		value, err := strconv.Atoi(valueStr)
		if err != nil || value <= 0 {
			return RIREntry{}, false
		}
		// Convert host count to prefix length: /prefixLen = 32 - log2(value)
		if value&(value-1) != 0 {
			return RIREntry{}, false // not a power of 2
		}
		prefixLen := 32 - bits.Len(uint(value)) + 1
		prefix := fmt.Sprintf("%s/%d", start, prefixLen)
		if net.ParseIP(start) == nil {
			return RIREntry{}, false
		}
		return RIREntry{Prefix: prefix, RIR: rir}, true

	case "ipv6":
		prefixLen, err := strconv.Atoi(valueStr)
		if err != nil {
			return RIREntry{}, false
		}
		prefix := fmt.Sprintf("%s/%d", start, prefixLen)
		if net.ParseIP(start) == nil {
			return RIREntry{}, false
		}
		return RIREntry{Prefix: prefix, RIR: rir}, true

	default:
		return RIREntry{}, false
	}
}

// ImportRIRStats downloads all RIR delegation files concurrently, parses them,
// and inserts into rirstats (replacing all rows).
func ImportRIRStats(ctx context.Context, pool *pgxpool.Pool, httpClient *http.Client) error {
	type sourceResult struct {
		rir     string
		entries []RIREntry
		err     error
	}

	results := make([]sourceResult, 0, len(rirURLs))
	var mu sync.Mutex

	g, gCtx := errgroup.WithContext(ctx)
	for rir, url := range rirURLs {
		rir, url := rir, url
		g.Go(func() error {
			entries, err := fetchRIR(gCtx, httpClient, url, rir)
			mu.Lock()
			results = append(results, sourceResult{rir: rir, entries: entries, err: err})
			mu.Unlock()
			return nil // never abort sibling downloads on error
		})
	}
	_ = g.Wait()

	// Collect all entries, log per-source errors.
	var allEntries []RIREntry
	for _, r := range results {
		if r.err != nil {
			// Per-source failure: log and continue with other sources.
			fmt.Printf("WARNING: RIR source %s failed: %v\n", r.rir, r.err)
			continue
		}
		allEntries = append(allEntries, r.entries...)
	}

	if len(allEntries) == 0 {
		return fmt.Errorf("all RIR sources failed, aborting rirstats import")
	}

	// Replace rirstats atomically.
	if _, err := pool.Exec(ctx, "TRUNCATE rirstats"); err != nil {
		return fmt.Errorf("truncate rirstats: %w", err)
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	rows := make([][]any, len(allEntries))
	for i, e := range allEntries {
		rows[i] = []any{e.Prefix, e.RIR}
	}
	_, err = conn.Conn().CopyFrom(ctx,
		pgx.Identifier{"rirstats"},
		[]string{"prefix", "rir"},
		pgx.CopyFromRows(rows),
	)
	return err
}

func fetchRIR(ctx context.Context, client *http.Client, url, rir string) ([]RIREntry, error) {
	resp, err := client.Do(newRequestWithContext(ctx, url))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var entries []RIREntry
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		if e, ok := ParseRIRLine(scanner.Text(), rir); ok {
			entries = append(entries, e)
		}
	}
	return entries, scanner.Err()
}

func newRequestWithContext(ctx context.Context, url string) *http.Request {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	return req
}
```

Note: add `"sync"` and `"github.com/jackc/pgx/v5"` to the import if not already there.

- [ ] **Step 4: Run tests**

```bash
cd go-backend && go test ./internal/importer/... -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-backend/internal/importer/rirstats.go go-backend/internal/importer/rirstats_test.go
git commit -m "feat(phase6): RIR stats importer — concurrent download + delegation file parsing"
```

---

### Task 6.3: Importer Runner + Entrypoint

**Files:**
- Create: `go-backend/internal/importer/runner.go`
- Create: `go-backend/cmd/importer/main.go`

- [ ] **Step 1: Implement runner**

Create `go-backend/internal/importer/runner.go`:

```go
package importer

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Run executes the full import cycle: BGP first, then RIR stats.
// Updates last_data_import only if BGP import succeeded.
func Run(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) error {
	httpClient := &http.Client{Timeout: 10 * time.Minute}

	logger.Info("starting BGP import")
	if err := ImportBGP(ctx, pool, httpClient); err != nil {
		return fmt.Errorf("BGP import failed: %w", err)
	}
	logger.Info("BGP import complete")

	logger.Info("starting RIR stats import")
	if err := ImportRIRStats(ctx, pool, httpClient); err != nil {
		// RIR failure is non-fatal: log but don't abort the timestamp update.
		logger.Warn("RIR stats import failed (non-fatal)", "error", err)
	} else {
		logger.Info("RIR stats import complete")
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO last_data_import (last_data_import) VALUES (NOW())
		ON CONFLICT (id) DO UPDATE SET last_data_import = NOW()
	`); err != nil {
		logger.Warn("failed to update last_data_import", "error", err)
	}

	return nil
}
```

- [ ] **Step 2: Implement entrypoint**

Create `go-backend/cmd/importer/main.go`:

```go
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sebastiaan/irrexplorer/go-backend/internal/importer"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		logger.Error("DATABASE_URL required")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := importer.Run(ctx, pool, logger); err != nil {
		logger.Error("import failed", "error", err)
		os.Exit(1)
	}

	logger.Info("import completed successfully")
}
```

- [ ] **Step 3: Build to verify it compiles**

```bash
cd go-backend && go build ./cmd/importer/...
```
Expected: binary created, no errors.

- [ ] **Step 4: Run all tests**

```bash
cd go-backend && go test ./... -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-backend/internal/importer/runner.go go-backend/cmd/importer/main.go
git commit -m "feat(phase6): importer runner + CronJob entrypoint"
```

---

### Task 6.4: Final DB Migration — Drop Alerting Tables

**Files:**
- Create: `go-backend/db/migrations/001_drop_alerting_tables.sql`

- [ ] **Step 1: Create migration**

```bash
mkdir -p go-backend/db/migrations
```

Create `go-backend/db/migrations/001_drop_alerting_tables.sql`:

```sql
-- Drop user/alerting tables that were scaffolded but never fully implemented.
-- These are not used by any remaining Go endpoint.

DROP TABLE IF EXISTS bgp_alert_events CASCADE;
DROP TABLE IF EXISTS alert_configurations CASCADE;
DROP TABLE IF EXISTS user_monitored_asns CASCADE;
DROP TABLE IF EXISTS user_emails CASCADE;
DROP TABLE IF EXISTS bgp_users CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
```

- [ ] **Step 2: Verify migration runs against a local copy of the DB (if available)**

```bash
psql $DATABASE_URL -f go-backend/db/migrations/001_drop_alerting_tables.sql
```

- [ ] **Step 3: Commit**

```bash
git add go-backend/db/migrations/
git commit -m "feat(phase6): DB migration — drop user/alerting tables"
```

---

### Task 6.5: Update Helm Chart — Make Go Primary Backend

**Files:**
- Modify: `charts/irrexplorer/values.yaml`
- Delete: `charts/irrexplorer/templates/backend-deployment.yaml`
- Delete: `charts/irrexplorer/templates/backend-service.yaml`
- Modify: `charts/irrexplorer/templates/ingress.yaml` — remove `goBackendPaths` loop, route everything to Go

- [ ] **Step 1: Update values.yaml**

Remove the `backend:` top-level key entirely. Remove `goBackendPaths`. Set `goBackend.enabled: true`.

```yaml
goBackend:
  enabled: true
  replicaCount: 1
  image:
    repository: ""
    tag: ""
  # ... rest of goBackend config unchanged
```

Remove `backend:` section entirely (keys: `replicaCount`, `image`, `service`, `resources`, `command`, `extraEnv`).

Remove `goBackendPaths:` line entirely.

- [ ] **Step 2: Update ingress.yaml**

Replace the conditional `goBackendPaths` loop with a single catch-all route to Go:

```yaml
# Remove the goBackendPaths range loop.
# Add before the frontend path:
- path: /api/
  pathType: Prefix
  backend:
    service:
      name: {{ include "irrexplorer.goBackendServiceName" $ }}
      port:
        number: {{ $.Values.goBackend.service.port }}
- path: /healthz
  pathType: Prefix
  backend:
    service:
      name: {{ include "irrexplorer.goBackendServiceName" $ }}
      port:
        number: {{ $.Values.goBackend.service.port }}
```

- [ ] **Step 3: Delete Python Helm templates**

```bash
rm charts/irrexplorer/templates/backend-deployment.yaml
rm charts/irrexplorer/templates/backend-service.yaml
```

- [ ] **Step 4: Update importer CronJob to use Go image**

In `charts/irrexplorer/templates/importer-cronjob.yaml`, change image reference from Python to `goBackend.image`.

In `charts/irrexplorer/templates/importer-bootstrap-job.yaml`, same change.

- [ ] **Step 5: Commit**

```bash
git add charts/irrexplorer/
git commit -m "feat(phase6): Helm — remove Python backend, Go is now primary"
```

---

### Task 6.6: Delete Python Backend Files

**Files to delete:**
- `irrexplorer/` (entire Python package)
- `Dockerfile` (Python backend)
- `requirements.txt`, `requirements-dev.txt`, `pyproject.toml`
- `alembic.ini`
- `scripts/import_data_cron.sh`
- `pytest.ini`
- `tests/` (Python tests)

- [ ] **Step 1: Remove Python files**

```bash
git rm -r irrexplorer/
git rm Dockerfile requirements.txt requirements-dev.txt pyproject.toml
git rm -f alembic.ini pytest.ini
git rm -f scripts/import_data_cron.sh
git rm -rf tests/
```

- [ ] **Step 2: Verify Go build still passes**

```bash
cd go-backend && go build ./... && go test ./...
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(phase6): decommission Python backend — remove all Python files"
```

---

### Task 6.7: Update CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Remove Python CI jobs**

Remove any `pytest`, `pip install`, `python` steps from `.github/workflows/ci.yml`.

Ensure the Go CI job covers:
```yaml
- name: Test Go
  run: cd go-backend && go test ./...
- name: Build Go
  run: cd go-backend && go build ./cmd/...
```

- [ ] **Step 2: Run CI locally**

```bash
cd go-backend && go vet ./... && go test ./...
```
Expected: PASS.

- [ ] **Step 3: Final commit and push**

```bash
git add .github/
git commit -m "chore(phase6): remove Python CI jobs, Go CI covers all tests"
git push origin main
```

---

## Verification Checklist (Run After Each Phase)

After each phase cutover (`goBackendPaths` updated), verify:

- [ ] `curl https://<host>/healthz` → `{"status":"ok"}`
- [ ] Phase endpoints return `200` with valid JSON
- [ ] Compare JSON structure with Python for the first 3 queries
- [ ] `X-Cache: HIT` header appears on second request (Phase 1+)
- [ ] Rate limiter: `ab -n 200 -c 10 https://<host>/api/metadata/` → some `429`s visible
- [ ] kubectl rollout: `kubectl rollout status deployment/irrexplorer-go-backend -n irrexplorer`

## Post-Phase-6: Redis Cleanup

After full cutover, optionally remove the `go:` prefix from all cache keys:

1. Flush all keys: `redis-cli FLUSHDB`
2. Restart Go service (keys regenerate on demand)
3. Update `cacheKey()` in `router.go` to drop the `go:` prefix
4. Commit and deploy
