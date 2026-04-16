package irrd

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestQueryASNSendsASNListVariable(t *testing.T) {
	var payload struct {
		Query     string         `json:"query"`
		Variables map[string]any `json:"variables"`
	}

	client := New("http://example.test/graphql")
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Fatalf("decode payload: %v", err)
			}
			return jsonResponse(`{"data":{"rpslObjects":[{"rpslPk":"192.0.2.0/24AS64500","source":"TEST","objectText":"route: 192.0.2.0/24","prefix":"192.0.2.0/24","asn":64500,"rpkiStatus":"valid"}]}}`), nil
		}),
	}
	routes, err := client.QueryASN(context.Background(), 64500)
	if err != nil {
		t.Fatalf("QueryASN returned error: %v", err)
	}

	rawASN, ok := payload.Variables["asn"]
	if !ok {
		t.Fatalf("missing asn variable in payload")
	}
	asnList, ok := rawASN.([]any)
	if !ok {
		t.Fatalf("asn variable has unexpected type %T", rawASN)
	}
	if len(asnList) != 1 || asnList[0] != float64(64500) {
		t.Fatalf("unexpected asn variable value: %#v", rawASN)
	}
	if len(routes) != 1 || routes[0].ASN != 64500 {
		t.Fatalf("unexpected routes: %#v", routes)
	}
}

func TestExecuteReturnsGraphQLError(t *testing.T) {
	client := New("http://example.test/graphql")
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return jsonResponse(`{"errors":[{"message":"invalid ASN variable"}],"data":{"rpslObjects":[]}}`), nil
		}),
	}
	if _, err := client.QueryASN(context.Background(), 64500); err == nil {
		t.Fatal("expected graphql error, got nil")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func jsonResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
