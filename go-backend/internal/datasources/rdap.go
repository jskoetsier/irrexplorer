package datasources

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type RDAPClient struct {
	httpClient *http.Client
}

var rdapBootstrapServers = map[string]string{
	"arin":    "https://rdap.arin.net/registry",
	"ripe":    "https://rdap.db.ripe.net",
	"apnic":   "https://rdap.apnic.net",
	"lacnic":  "https://rdap.lacnic.net/rdap",
	"afrinic": "https://rdap.afrinic.net/rdap",
}

func NewRDAPClient(timeout time.Duration) *RDAPClient {
	return &RDAPClient{
		httpClient: &http.Client{Timeout: timeout},
	}
}

func (c *RDAPClient) QueryIP(ctx context.Context, ipAddress string, rir string) map[string]any {
	if rir != "" {
		if base, ok := rdapBootstrapServers[rir]; ok {
			return c.queryRIR(ctx, ipAddress, rir, base, "ip")
		}
	}
	for rirName, base := range rdapBootstrapServers {
		result := c.queryRIR(ctx, ipAddress, rirName, base, "ip")
		if result["error"] == nil {
			return result
		}
	}
	return map[string]any{"ip": ipAddress, "error": "Not found in any RIR"}
}

func (c *RDAPClient) QueryASN(ctx context.Context, asn int64, rir string) map[string]any {
	resource := fmt.Sprintf("%d", asn)
	if rir != "" {
		if base, ok := rdapBootstrapServers[rir]; ok {
			return c.queryRIR(ctx, resource, rir, base, "autnum")
		}
	}
	for rirName, base := range rdapBootstrapServers {
		result := c.queryRIR(ctx, resource, rirName, base, "autnum")
		if result["error"] == nil {
			return result
		}
	}
	return map[string]any{"asn": asn, "error": "Not found in any RIR"}
}

func (c *RDAPClient) QueryDomain(ctx context.Context, domain string) map[string]any {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://rdap.org/domain/"+url.PathEscape(domain), nil)
	if err != nil {
		return map[string]any{"domain": domain, "error": err.Error()}
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return map[string]any{"domain": domain, "error": err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return map[string]any{"domain": domain, "error": "Not found"}
	}
	if resp.StatusCode != http.StatusOK {
		return map[string]any{"domain": domain, "error": fmt.Sprintf("API error: %d", resp.StatusCode)}
	}

	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return map[string]any{"domain": domain, "error": err.Error()}
	}
	return parseDomainResponse(data)
}

func (c *RDAPClient) queryRIR(ctx context.Context, resource, rir, base, resourceType string) map[string]any {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/"+resourceType+"/"+url.PathEscape(resource), nil)
	if err != nil {
		return map[string]any{"resource": resource, "rir": rir, "error": err.Error()}
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return map[string]any{"resource": resource, "rir": rir, "error": err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return map[string]any{"resource": resource, "rir": rir, "error": "Not found"}
	}
	if resp.StatusCode != http.StatusOK {
		return map[string]any{"resource": resource, "rir": rir, "error": fmt.Sprintf("API error: %d", resp.StatusCode)}
	}

	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return map[string]any{"resource": resource, "rir": rir, "error": err.Error()}
	}
	if resourceType == "ip" {
		return parseIPResponse(data, rir)
	}
	return parseASNResponse(data, rir)
}

func parseIPResponse(data map[string]any, rir string) map[string]any {
	return map[string]any{
		"start_address":     data["startAddress"],
		"end_address":       data["endAddress"],
		"ip_version":        data["ipVersion"],
		"name":              data["name"],
		"type":              data["type"],
		"country":           data["country"],
		"entities":          parseEntities(data),
		"status":            toAnySlice(data["status"]),
		"rir":               rir,
		"handle":            data["handle"],
		"registration_date": eventDate(data, "registration"),
		"last_changed_date": eventDate(data, "last changed"),
	}
}

func parseASNResponse(data map[string]any, rir string) map[string]any {
	return map[string]any{
		"asn":               data["startAutnum"],
		"name":              data["name"],
		"type":              data["type"],
		"country":           data["country"],
		"entities":          parseEntities(data),
		"status":            toAnySlice(data["status"]),
		"rir":               rir,
		"handle":            data["handle"],
		"registration_date": eventDate(data, "registration"),
		"last_changed_date": eventDate(data, "last changed"),
	}
}

func parseDomainResponse(data map[string]any) map[string]any {
	nameservers := make([]any, 0)
	for _, raw := range toAnySlice(data["nameservers"]) {
		if ns, ok := raw.(map[string]any); ok {
			nameservers = append(nameservers, ns["ldhName"])
		}
	}
	return map[string]any{
		"domain":            data["ldhName"],
		"unicode_name":      data["unicodeName"],
		"status":            toAnySlice(data["status"]),
		"nameservers":       nameservers,
		"entities":          parseEntities(data),
		"registration_date": eventDate(data, "registration"),
		"expiration_date":   eventDate(data, "expiration"),
		"last_changed_date": eventDate(data, "last changed"),
	}
}

func parseEntities(data map[string]any) []map[string]any {
	entities := make([]map[string]any, 0)
	for _, raw := range toAnySlice(data["entities"]) {
		entity, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		entities = append(entities, map[string]any{
			"handle": entity["handle"],
			"name":   vcardField(entity, "fn"),
			"roles":  toAnySlice(entity["roles"]),
			"email":  vcardField(entity, "email"),
		})
	}
	return entities
}

func vcardField(entity map[string]any, field string) any {
	vcardArray, ok := entity["vcardArray"].([]any)
	if !ok || len(vcardArray) < 2 {
		return nil
	}
	items, ok := vcardArray[1].([]any)
	if !ok {
		return nil
	}
	for _, raw := range items {
		entry, ok := raw.([]any)
		if !ok || len(entry) < 4 {
			continue
		}
		if key, ok := entry[0].(string); ok && key == field {
			return entry[3]
		}
	}
	return nil
}

func eventDate(data map[string]any, action string) any {
	for _, raw := range toAnySlice(data["events"]) {
		event, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		if event["eventAction"] == action {
			return event["eventDate"]
		}
	}
	return nil
}
