package navigation

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

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

type cacheAccessor interface {
	Get(ctx context.Context, key string, dest any) bool
	Set(ctx context.Context, key string, value any, ttl time.Duration)
}

// Handlers provides HTTP handlers for navigation endpoints.
type Handlers struct {
	store navStore
	cache cacheAccessor
}

// NewHandlers creates a new Handlers with the given store and optional cache.
func NewHandlers(store navStore, cache cacheAccessor) *Handlers {
	return &Handlers{store: store, cache: cache}
}

// Register registers all navigation routes on the given mux.
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
		http.Error(w, "missing query", http.StatusBadRequest)
		return
	}

	cacheKey := "go:autocomplete:" + query
	if h.cache != nil {
		var cached []QueryStat
		if h.cache.Get(r.Context(), cacheKey, &cached) {
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
		h.cache.Set(context.Background(), cacheKey, results, 1*time.Minute)
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
		var req struct {
			Query string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		sessionID := getOrCreateSession(w, r)
		if err := h.store.AddSearchHistory(r.Context(), sessionID, req.Query); err != nil {
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
		var req struct {
			Query string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		sessionID := getOrCreateSession(w, r)
		if err := h.store.AddBookmark(r.Context(), sessionID, req.Query); err != nil {
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
	rawID := strings.TrimPrefix(r.URL.Path, "/api/bookmarks/")
	id, err := strconv.Atoi(rawID)
	if err != nil {
		http.Error(w, "invalid bookmark id", http.StatusBadRequest)
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
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	results, err := h.store.Popular(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *Handlers) handleTrending(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
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
