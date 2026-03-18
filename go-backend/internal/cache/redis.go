package cache

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache wraps a Redis client with gzipped JSON storage.
type Cache struct {
	client *redis.Client
	logger *slog.Logger
}

// New creates a Cache connected to the given Redis URL.
// Returns an error if the URL is invalid or Redis is unreachable.
func New(redisURL string, logger *slog.Logger) (*Cache, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, err
	}

	return &Cache{client: client, logger: logger}, nil
}

// Get decodes a gzipped JSON value from Redis into dest.
// Returns false on a cache miss or any error (non-miss errors are logged).
func (c *Cache) Get(ctx context.Context, key string, dest any) bool {
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false
		}
		c.logger.Warn("cache get error", "key", key, "err", err)
		return false
	}

	gr, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		c.logger.Warn("cache decompress error", "key", key, "err", err)
		return false
	}
	defer gr.Close()

	raw, err := io.ReadAll(gr)
	if err != nil {
		c.logger.Warn("cache read error", "key", key, "err", err)
		return false
	}

	if err := json.Unmarshal(raw, dest); err != nil {
		c.logger.Warn("cache unmarshal error", "key", key, "err", err)
		return false
	}

	return true
}

// Set encodes value as gzipped JSON and stores it in Redis with the given TTL.
// Errors are logged; this method never panics or returns an error to callers.
func (c *Cache) Set(ctx context.Context, key string, value any, ttl time.Duration) {
	raw, err := json.Marshal(value)
	if err != nil {
		c.logger.Warn("cache marshal error", "key", key, "err", err)
		return
	}

	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	if _, err := gw.Write(raw); err != nil {
		c.logger.Warn("cache compress error", "key", key, "err", err)
		return
	}
	if err := gw.Close(); err != nil {
		c.logger.Warn("cache compress close error", "key", key, "err", err)
		return
	}

	if err := c.client.Set(ctx, key, buf.Bytes(), ttl).Err(); err != nil {
		c.logger.Warn("cache set error", "key", key, "err", err)
	}
}

// Del removes a key from Redis. Used in tests and admin operations.
func (c *Cache) Del(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

// Client exposes the underlying redis.Client for admin operations.
func (c *Cache) Client() *redis.Client {
	return c.client
}
