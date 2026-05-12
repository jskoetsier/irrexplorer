package cache_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/cache"
)

func newTestCache(t *testing.T) *cache.Cache {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	c, err := cache.New("redis://localhost:6379", logger)
	if err != nil {
		t.Skip("Redis unavailable:", err)
	}
	return c
}

func TestCacheGetMiss(t *testing.T) {
	c := newTestCache(t)
	ctx := context.Background()

	var dest map[string]any
	got := c.Get(ctx, "irrexplorer:test:nonexistent-key-12345", &dest)
	if got {
		t.Fatalf("expected false for cache miss, got true")
	}
}

func TestCacheSetAndGet(t *testing.T) {
	c := newTestCache(t)
	ctx := context.Background()

	key := "irrexplorer:test:set-and-get"
	type payload struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	// Clean up before and after
	_ = c.Del(ctx, key)
	t.Cleanup(func() { _ = c.Del(ctx, key) })

	original := payload{Name: "test", Value: 42}
	c.Set(ctx, key, original, 30*time.Second)

	var result payload
	ok := c.Get(ctx, key, &result)
	if !ok {
		t.Fatal("expected cache hit, got miss")
	}
	if result.Name != original.Name || result.Value != original.Value {
		t.Fatalf("round-trip mismatch: got %+v, want %+v", result, original)
	}
}
