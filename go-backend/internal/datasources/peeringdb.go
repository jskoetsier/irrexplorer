package datasources

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type PeeringDBClient struct {
	httpClient *http.Client
	baseURL    string
}

func NewPeeringDBClient(timeout time.Duration) *PeeringDBClient {
	return &PeeringDBClient{
		httpClient: &http.Client{Timeout: timeout},
		baseURL:    "https://api.peeringdb.com/api",
	}
}

func (c *PeeringDBClient) QueryASN(ctx context.Context, asn int) map[string]any {
	data, err := c.get(ctx, fmt.Sprintf("%s/net?asn=%d", c.baseURL, asn))
	if err != nil {
		return map[string]any{"asn": asn, "error": err.Error()}
	}
	networks := nestedData(data)
	if len(networks) == 0 {
		return map[string]any{"asn": asn, "error": "Not found"}
	}
	network, _ := networks[0].(map[string]any)
	return map[string]any{
		"asn":                          network["asn"],
		"name":                         network["name"],
		"aka":                          network["aka"],
		"website":                      network["website"],
		"looking_glass":                network["looking_glass"],
		"route_server":                 network["route_server"],
		"irr_as_set":                   network["irr_as_set"],
		"info_type":                    network["info_type"],
		"info_scope":                   network["info_scope"],
		"info_prefixes4":               network["info_prefixes4"],
		"info_prefixes6":               network["info_prefixes6"],
		"info_traffic":                 network["info_traffic"],
		"info_ratio":                   network["info_ratio"],
		"info_unicast":                 network["info_unicast"],
		"info_multicast":               network["info_multicast"],
		"info_ipv6":                    network["info_ipv6"],
		"info_never_via_route_servers": network["info_never_via_route_servers"],
		"policy_general":               network["policy_general"],
		"policy_locations":             network["policy_locations"],
		"policy_ratio":                 network["policy_ratio"],
		"policy_contracts":             network["policy_contracts"],
		"notes":                        network["notes"],
		"created":                      network["created"],
		"updated":                      network["updated"],
		"facilities":                   []any{},
		"ix_connections":               []any{},
	}
}

func (c *PeeringDBClient) QueryFacility(ctx context.Context, facilityID int) map[string]any {
	data, err := c.get(ctx, fmt.Sprintf("%s/fac/%d", c.baseURL, facilityID))
	if err != nil {
		return map[string]any{"facility_id": facilityID, "error": err.Error()}
	}
	items := nestedData(data)
	if len(items) == 0 {
		return map[string]any{"facility_id": facilityID, "error": "Not found"}
	}
	facility, _ := items[0].(map[string]any)
	return facility
}

func (c *PeeringDBClient) QueryIX(ctx context.Context, ixID int) map[string]any {
	data, err := c.get(ctx, fmt.Sprintf("%s/ix/%d", c.baseURL, ixID))
	if err != nil {
		return map[string]any{"ix_id": ixID, "error": err.Error()}
	}
	items := nestedData(data)
	if len(items) == 0 {
		return map[string]any{"ix_id": ixID, "error": "Not found"}
	}
	ix, _ := items[0].(map[string]any)
	return ix
}

func (c *PeeringDBClient) SearchNetworks(ctx context.Context, query string) []map[string]any {
	data, err := c.get(ctx, fmt.Sprintf("%s/net?name__contains=%s", c.baseURL, url.QueryEscape(query)))
	if err != nil {
		return []map[string]any{}
	}
	items := nestedData(data)
	results := make([]map[string]any, 0)
	for _, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		results = append(results, map[string]any{
			"asn":        item["asn"],
			"name":       item["name"],
			"aka":        item["aka"],
			"website":    item["website"],
			"info_type":  item["info_type"],
			"info_scope": item["info_scope"],
		})
		if len(results) >= 20 {
			break
		}
	}
	return results
}

func (c *PeeringDBClient) get(ctx context.Context, endpoint string) (map[string]any, error) {
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

func nestedData(data map[string]any) []any {
	if items, ok := data["data"].([]any); ok {
		return items
	}
	return []any{}
}
