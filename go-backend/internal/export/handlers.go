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
