package irrd

import (
	"context"
	"fmt"
	"net/netip"
	"time"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/cache"
)

const (
	// Cache TTL for IRRd prefix queries - 5 minutes
	prefixCacheTTL = 5 * time.Minute
	// Cache TTL for ASN queries - 10 minutes
	asnCacheTTL = 10 * time.Minute
)

// CachedClient wraps an IRRd client with Redis caching
type CachedClient struct {
	client *Client
	cache  *cache.Cache
}

// NewCachedClient creates a new cached IRRd client
func NewCachedClient(client *Client, cache *cache.Cache) *CachedClient {
	return &CachedClient{
		client: client,
		cache:  cache,
	}
}

// QueryASN queries IRRd for routes by ASN (uses cache)
func (c *CachedClient) QueryASN(ctx context.Context, asn int64) ([]RouteInfo, error) {
	if c.cache == nil {
		return c.client.QueryASN(ctx, asn)
	}

	cacheKey := fmt.Sprintf("irrd:asn:%d", asn)

	var cached []RouteInfo
	if c.cache.Get(ctx, cacheKey, &cached) {
		return cached, nil
	}

	result, err := c.client.QueryASN(ctx, asn)
	if err != nil {
		return nil, err
	}

	c.cache.Set(ctx, cacheKey, result, asnCacheTTL)
	return result, nil
}

// QueryPrefixesAny queries IRRd for routes by prefixes (uses cache per prefix)
func (c *CachedClient) QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]RouteInfo, error) {
	if c.cache == nil {
		return c.client.QueryPrefixesAny(ctx, prefixes)
	}

	// Check cache for each prefix
	var missingPrefixes []netip.Prefix
	allResults := make([]RouteInfo, 0)

	for _, prefix := range prefixes {
		cacheKey := fmt.Sprintf("irrd:prefix:%s", prefix.String())
		var cached []RouteInfo
		if c.cache.Get(ctx, cacheKey, &cached) {
			allResults = append(allResults, cached...)
		} else {
			missingPrefixes = append(missingPrefixes, prefix)
		}
	}

	// If all prefixes were cached, return immediately
	if len(missingPrefixes) == 0 {
		return allResults, nil
	}

	// Query IRRd for missing prefixes
	freshResults, err := c.client.QueryPrefixesAny(ctx, missingPrefixes)
	if err != nil {
		// Return cached results even if fresh query fails
		if len(allResults) > 0 {
			return allResults, nil
		}
		return nil, err
	}

	// Cache results per prefix
	resultsByPrefix := make(map[string][]RouteInfo)
	for _, route := range freshResults {
		key := route.Prefix.String()
		resultsByPrefix[key] = append(resultsByPrefix[key], route)
	}

	for prefix, routes := range resultsByPrefix {
		cacheKey := fmt.Sprintf("irrd:prefix:%s", prefix)
		c.cache.Set(ctx, cacheKey, routes, prefixCacheTTL)
	}

	// Also cache empty results for prefixes with no routes
	for _, prefix := range missingPrefixes {
		key := prefix.String()
		if _, found := resultsByPrefix[key]; !found {
			cacheKey := fmt.Sprintf("irrd:prefix:%s", key)
			c.cache.Set(ctx, cacheKey, []RouteInfo{}, prefixCacheTTL)
		}
	}

	return append(allResults, freshResults...), nil
}

// QueryMemberOf queries IRRd for member-of relationships (uses cache)
func (c *CachedClient) QueryMemberOf(ctx context.Context, target string, objectClass string) (MemberOfResult, error) {
	if c.cache == nil {
		return c.client.QueryMemberOf(ctx, target, objectClass)
	}

	cacheKey := fmt.Sprintf("irrd:memberof:%s:%s", objectClass, target)

	var cached MemberOfResult
	if c.cache.Get(ctx, cacheKey, &cached) {
		return cached, nil
	}

	result, err := c.client.QueryMemberOf(ctx, target, objectClass)
	if err != nil {
		return MemberOfResult{}, err
	}

	c.cache.Set(ctx, cacheKey, result, asnCacheTTL)
	return result, nil
}

// QueryLastUpdate queries IRRd for last update time (uses cache)
func (c *CachedClient) QueryLastUpdate(ctx context.Context) (map[string]string, error) {
	if c.cache == nil {
		return c.client.QueryLastUpdate(ctx)
	}

	cacheKey := "irrd:lastupdate"

	var cached map[string]string
	if c.cache.Get(ctx, cacheKey, &cached) {
		return cached, nil
	}

	result, err := c.client.QueryLastUpdate(ctx)
	if err != nil {
		return nil, err
	}

	c.cache.Set(ctx, cacheKey, result, time.Minute)
	return result, nil
}

// QuerySetMembers queries IRRd for set members (uses cache)
func (c *CachedClient) QuerySetMembers(ctx context.Context, names []string) ([]SetMemberResult, error) {
	if c.cache == nil || len(names) == 0 {
		return c.client.QuerySetMembers(ctx, names)
	}

	// For single set queries, use cache
	if len(names) == 1 {
		cacheKey := fmt.Sprintf("irrd:setmembers:%s", names[0])

		var cached []SetMemberResult
		if c.cache.Get(ctx, cacheKey, &cached) {
			return cached, nil
		}

		result, err := c.client.QuerySetMembers(ctx, names)
		if err != nil {
			return nil, err
		}

		c.cache.Set(ctx, cacheKey, result, asnCacheTTL)
		return result, nil
	}

	// For multiple sets, don't cache (too complex)
	return c.client.QuerySetMembers(ctx, names)
}
