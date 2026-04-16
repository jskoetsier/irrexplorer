package irrd

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/netip"
	"sync"
	"time"
)

const (
	lastUpdateQuery       = `query lastUpdate { databaseStatus { source lastUpdate } }`
	queryASN              = `query getRoutes ($asn: [ASN!]!, $limit: Int) { rpslObjects(asn: $asn, objectClass: ["route", "route6"], rpkiStatus: [valid,invalid,not_found], limit: $limit) { rpslPk source objectText ... on RPSLRoute { prefix asn rpkiStatus rpkiMaxLength } ... on RPSLRoute6 { prefix asn rpkiStatus rpkiMaxLength } } }`
	queryPrefix           = `query getRoutes ($prefix: IP!, $object_class: [String!]!) { rpslObjects(ipAny: $prefix, objectClass: $object_class, rpkiStatus: [valid,invalid,not_found]) { rpslPk source objectText ... on RPSLRoute { prefix asn rpkiStatus rpkiMaxLength } ... on RPSLRoute6 { prefix asn rpkiStatus rpkiMaxLength } } }`
	queryMemberOfASSet    = `query getMemberOf($target: String!) { set: rpslObjects(members: [$target], objectClass: ["as-set"], rpkiStatus: [valid, invalid, not_found]) { rpslPk source } autNum: rpslObjects(rpslPk: [$target], objectClass: ["aut-num"], rpkiStatus: [valid, invalid, not_found]) { rpslPk source mntBy ... on RPSLAutNum { memberOfObjs { rpslPk source mbrsByRef } } } }`
	queryMemberOfRouteSet = `query getMemberOf($target: String!) { set: rpslObjects(members: [$target], objectClass: ["route-set"], rpkiStatus: [valid, invalid, not_found]) { rpslPk source } }`
	querySetMembers       = `query setMembers($names: [String!]!) { recursiveSetMembers(setNames:$names, depth:1) { rpslPk rootSource members } }`

	// Max IRRd results per query to prevent timeouts on large ASNs
	maxIRRdResults = 5000
)

type Client struct {
	endpoint   string
	httpClient *http.Client
}

type RouteInfo struct {
	Prefix        netip.Prefix
	ASN           int
	RPSLPK        string
	IRRSource     string
	RPSLText      string
	RPKIStatus    string
	RPKIMaxLength *int
}

type graphqlResponse struct {
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
	Data struct {
		DatabaseStatus []struct {
			Source     string `json:"source"`
			LastUpdate string `json:"lastUpdate"`
		} `json:"databaseStatus"`
		RPSLObjects []struct {
			RPSLPK        string `json:"rpslPk"`
			Source        string `json:"source"`
			ObjectText    string `json:"objectText"`
			Prefix        string `json:"prefix"`
			ASN           *int   `json:"asn"`
			RPKIStatus    string `json:"rpkiStatus"`
			RPKIMaxLength *int   `json:"rpkiMaxLength"`
		} `json:"rpslObjects"`
		Set []struct {
			RPSLPK string `json:"rpslPk"`
			Source string `json:"source"`
		} `json:"set"`
		AutNum []struct {
			RPSLPK       string   `json:"rpslPk"`
			Source       string   `json:"source"`
			MntBy        []string `json:"mntBy"`
			MemberOfObjs []struct {
				RPSLPK    string   `json:"rpslPk"`
				Source    string   `json:"source"`
				MbrsByRef []string `json:"mbrsByRef"`
			} `json:"memberOfObjs"`
		} `json:"autNum"`
		RecursiveSetMembers []struct {
			RPSLPK     string   `json:"rpslPk"`
			RootSource string   `json:"rootSource"`
			Members    []string `json:"members"`
		} `json:"recursiveSetMembers"`
	} `json:"data"`
}

type MemberOfSet struct {
	RPSLPK string
	Source string
}

type MemberOfAutNum struct {
	RPSLPK       string
	Source       string
	MntBy        []string
	MemberOfObjs []MemberOfObj
}

type MemberOfObj struct {
	RPSLPK    string
	Source    string
	MbrsByRef []string
}

type MemberOfResult struct {
	Set    []MemberOfSet
	AutNum []MemberOfAutNum
}

type SetMemberResult struct {
	RPSLPK     string
	RootSource string
	Members    []string
}

func New(endpoint string) *Client {
	return &Client{
		endpoint: endpoint,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) QueryLastUpdate(ctx context.Context) (map[string]string, error) {
	if c.endpoint == "" {
		return map[string]string{}, nil
	}

	var decoded graphqlResponse
	if err := c.execute(ctx, lastUpdateQuery, nil, &decoded); err != nil {
		return map[string]string{}, err
	}

	result := make(map[string]string, len(decoded.Data.DatabaseStatus))
	for _, status := range decoded.Data.DatabaseStatus {
		t, err := time.Parse(time.RFC3339Nano, status.LastUpdate)
		if err != nil {
			continue
		}
		result[status.Source] = FormatPythonTime(t)
	}
	return result, nil
}

func (c *Client) QueryASN(ctx context.Context, asn int) ([]RouteInfo, error) {
	if c.endpoint == "" {
		return []RouteInfo{}, nil
	}

	var decoded graphqlResponse
	if err := c.execute(ctx, queryASN, map[string]any{
		"asn":   []int{asn},
		"limit": maxIRRdResults,
	}, &decoded); err != nil {
		return []RouteInfo{}, err
	}
	return toRouteInfo(decoded), nil
}

func (c *Client) QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]RouteInfo, error) {
	if c.endpoint == "" {
		return []RouteInfo{}, nil
	}

	if len(prefixes) == 0 {
		return []RouteInfo{}, nil
	}

	// Use parallel processing for large prefix lists
	const maxConcurrency = 10

	type result struct {
		routes []RouteInfo
		err    error
	}

	resultsChan := make(chan result, len(prefixes))
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, maxConcurrency)

	for _, prefix := range prefixes {
		wg.Add(1)
		go func(p netip.Prefix) {
			defer wg.Done()

			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			objectClass := []string{"route"}
			if p.Addr().Is6() {
				objectClass = []string{"route6"}
			}

			var decoded graphqlResponse
			if err := c.execute(ctx, queryPrefix, map[string]any{
				"prefix":       p.String(),
				"object_class": objectClass,
			}, &decoded); err != nil {
				resultsChan <- result{err: err}
				return
			}

			resultsChan <- result{routes: toRouteInfo(decoded)}
		}(prefix)
	}

	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	allResults := make([]RouteInfo, 0)
	for res := range resultsChan {
		if res.err != nil {
			return []RouteInfo{}, res.err
		}
		allResults = append(allResults, res.routes...)
	}

	return allResults, nil
}

func (c *Client) QueryMemberOf(ctx context.Context, target string, objectClass string) (MemberOfResult, error) {
	if c.endpoint == "" {
		return MemberOfResult{}, nil
	}

	query := queryMemberOfASSet
	if objectClass == "route-set" {
		query = queryMemberOfRouteSet
	}

	var decoded graphqlResponse
	if err := c.execute(ctx, query, map[string]any{"target": target}, &decoded); err != nil {
		return MemberOfResult{}, err
	}

	result := MemberOfResult{
		Set:    make([]MemberOfSet, 0, len(decoded.Data.Set)),
		AutNum: make([]MemberOfAutNum, 0, len(decoded.Data.AutNum)),
	}
	for _, item := range decoded.Data.Set {
		result.Set = append(result.Set, MemberOfSet{RPSLPK: item.RPSLPK, Source: item.Source})
	}
	for _, item := range decoded.Data.AutNum {
		autNum := MemberOfAutNum{
			RPSLPK:       item.RPSLPK,
			Source:       item.Source,
			MntBy:        item.MntBy,
			MemberOfObjs: make([]MemberOfObj, 0, len(item.MemberOfObjs)),
		}
		for _, memberOf := range item.MemberOfObjs {
			autNum.MemberOfObjs = append(autNum.MemberOfObjs, MemberOfObj{
				RPSLPK:    memberOf.RPSLPK,
				Source:    memberOf.Source,
				MbrsByRef: memberOf.MbrsByRef,
			})
		}
		result.AutNum = append(result.AutNum, autNum)
	}
	return result, nil
}

func (c *Client) QuerySetMembers(ctx context.Context, names []string) ([]SetMemberResult, error) {
	if c.endpoint == "" {
		return []SetMemberResult{}, nil
	}

	var decoded graphqlResponse
	if err := c.execute(ctx, querySetMembers, map[string]any{"names": names}, &decoded); err != nil {
		return []SetMemberResult{}, err
	}

	results := make([]SetMemberResult, 0, len(decoded.Data.RecursiveSetMembers))
	for _, item := range decoded.Data.RecursiveSetMembers {
		results = append(results, SetMemberResult{
			RPSLPK:     item.RPSLPK,
			RootSource: item.RootSource,
			Members:    item.Members,
		})
	}
	return results, nil
}

func (c *Client) execute(ctx context.Context, query string, variables map[string]any, target any) error {
	payload, err := json.Marshal(map[string]any{
		"query":     query,
		"variables": variables,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("irrd returned http %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return err
	}

	if response, ok := target.(*graphqlResponse); ok && len(response.Errors) > 0 {
		return fmt.Errorf("irrd graphql error: %s", response.Errors[0].Message)
	}

	return nil
}

func toRouteInfo(decoded graphqlResponse) []RouteInfo {
	results := make([]RouteInfo, 0, len(decoded.Data.RPSLObjects))
	for _, obj := range decoded.Data.RPSLObjects {
		prefix, err := netip.ParsePrefix(obj.Prefix)
		if err != nil {
			continue
		}
		asn := 0
		if obj.ASN != nil {
			asn = *obj.ASN
		}
		results = append(results, RouteInfo{
			Prefix:        prefix.Masked(),
			ASN:           asn,
			RPSLPK:        obj.RPSLPK,
			IRRSource:     obj.Source,
			RPSLText:      obj.ObjectText,
			RPKIStatus:    NormalizeRPKIStatus(obj.RPKIStatus),
			RPKIMaxLength: obj.RPKIMaxLength,
		})
	}
	return results
}

func NormalizeRPKIStatus(status string) string {
	switch status {
	case "valid", "VALID":
		return "VALID"
	case "invalid", "INVALID":
		return "INVALID"
	case "not_found", "NOT_FOUND":
		return "NOT_FOUND"
	default:
		return status
	}
}

func FormatPythonTime(t time.Time) string {
	t = t.UTC()
	if t.Nanosecond() == 0 {
		return t.Format("2006-01-02 15:04:05Z07:00")
	}
	return t.Format("2006-01-02 15:04:05.999999Z07:00")
}
