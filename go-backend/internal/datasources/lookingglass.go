package datasources

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type LookingGlassClient struct {
	httpClient *http.Client
	baseURL    string
}

func NewLookingGlassClient(baseURL string, timeout time.Duration) *LookingGlassClient {
	if baseURL == "" {
		baseURL = "https://lg.ring.nlnog.net"
	}
	return &LookingGlassClient{
		httpClient: &http.Client{Timeout: timeout},
		baseURL:    trimTrailingSlash(baseURL),
	}
}

func (c *LookingGlassClient) QueryPrefix(ctx context.Context, prefix string) map[string]any {
	data, err := c.get(ctx, fmt.Sprintf("%s/api/prefix?q=%s&all=all", c.baseURL, url.QueryEscape(prefix)))
	if err != nil {
		return map[string]any{"prefix": prefix, "routes": []any{}, "error": err.Error()}
	}
	routes := make([]map[string]any, 0)
	if routesData, ok := data["routes"].(map[string]any); ok {
		for prefixKey, rawList := range routesData {
			for _, rawRoute := range toAnySlice(rawList) {
				route, ok := rawRoute.(map[string]any)
				if !ok {
					continue
				}
				asPath := flattenPath(route["aspath"])
				routes = append(routes, map[string]any{
					"prefix":      prefixKey,
					"as_path":     asPath,
					"origin_asn":  lastOrNil(asPath),
					"next_hop":    route["exit_nexthop"],
					"peer":        route["ip"],
					"communities": flattenPath(route["communities"]),
					"local_pref":  route["local_prf"],
					"med":         route["med"],
				})
			}
		}
	}
	return map[string]any{"prefix": prefix, "routes": routes, "total_routes": len(routes)}
}

func (c *LookingGlassClient) QueryASN(ctx context.Context, asn int) map[string]any {
	data, err := c.get(ctx, fmt.Sprintf("https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS%d", asn))
	if err != nil {
		return map[string]any{"asn": asn, "prefixes": []any{}, "error": err.Error()}
	}
	prefixes := make([]map[string]any, 0)
	dataObj, _ := data["data"].(map[string]any)
	for _, raw := range toAnySlice(dataObj["prefixes"]) {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		prefixes = append(prefixes, map[string]any{
			"prefix": item["prefix"],
			"origin": fmt.Sprintf("AS%d", asn),
			"peers":  []any{},
		})
	}
	return map[string]any{"asn": asn, "prefixes": prefixes, "total_prefixes": len(prefixes), "as_name": nil}
}

func (c *LookingGlassClient) QueryRoute(ctx context.Context, prefix, peer string) map[string]any {
	endpoint := fmt.Sprintf("%s/api/v1/route/%s", c.baseURL, url.PathEscape(prefix))
	if peer != "" {
		endpoint += "?peer=" + url.QueryEscape(peer)
	}
	data, err := c.get(ctx, endpoint)
	if err != nil {
		return map[string]any{"prefix": prefix, "peer": peer, "route": nil, "error": err.Error()}
	}
	route, _ := data["route"].(map[string]any)
	if route == nil {
		return map[string]any{"route": nil}
	}
	path := flattenPath(route["as_path"])
	return map[string]any{
		"prefix":           route["prefix"],
		"as_path":          path,
		"origin_asn":       lastOrNil(path),
		"next_hop":         route["next_hop"],
		"peer":             route["peer"],
		"communities":      toAnySlice(route["communities"]),
		"local_pref":       route["local_pref"],
		"med":              route["med"],
		"atomic_aggregate": route["atomic_aggregate"],
		"aggregator":       route["aggregator"],
		"originator_id":    route["originator_id"],
		"cluster_list":     toAnySlice(route["cluster_list"]),
	}
}

func (c *LookingGlassClient) Peers(ctx context.Context) []any {
	data, err := c.get(ctx, fmt.Sprintf("%s/api/v1/peers", c.baseURL))
	if err != nil {
		return []any{}
	}
	return toAnySlice(data["peers"])
}

func (c *LookingGlassClient) get(ctx context.Context, endpoint string) (map[string]any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error: %d", resp.StatusCode)
	}
	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	return data, nil
}

func flattenPath(value any) []any {
	items := make([]any, 0)
	for _, raw := range toAnySlice(value) {
		if nested, ok := raw.([]any); ok && len(nested) > 0 {
			items = append(items, nested[0])
		} else {
			items = append(items, raw)
		}
	}
	return items
}

func lastOrNil(items []any) any {
	if len(items) == 0 {
		return nil
	}
	return items[len(items)-1]
}

func trimTrailingSlash(value string) string {
	for len(value) > 0 && value[len(value)-1] == '/' {
		value = value[:len(value)-1]
	}
	return value
}
