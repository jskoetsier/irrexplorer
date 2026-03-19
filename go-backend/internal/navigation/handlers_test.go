package navigation_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/navigation"
)

// fakeNavStore implements navStore with configurable return values.
type fakeNavStore struct {
	autocompleteResult []navigation.QueryStat
	popularResult      []navigation.QueryStat
	trendingResult     []navigation.QueryStat
	historyResult      []navigation.SearchHistoryEntry
	bookmarksResult    []navigation.Bookmark
}

func (f *fakeNavStore) Autocomplete(_ context.Context, _ string) ([]navigation.QueryStat, error) {
	if f.autocompleteResult != nil {
		return f.autocompleteResult, nil
	}
	return []navigation.QueryStat{}, nil
}

func (f *fakeNavStore) Popular(_ context.Context) ([]navigation.QueryStat, error) {
	if f.popularResult != nil {
		return f.popularResult, nil
	}
	return []navigation.QueryStat{}, nil
}

func (f *fakeNavStore) Trending(_ context.Context) ([]navigation.QueryStat, error) {
	if f.trendingResult != nil {
		return f.trendingResult, nil
	}
	return []navigation.QueryStat{}, nil
}

func (f *fakeNavStore) GetSearchHistory(_ context.Context, _ string) ([]navigation.SearchHistoryEntry, error) {
	if f.historyResult != nil {
		return f.historyResult, nil
	}
	return []navigation.SearchHistoryEntry{}, nil
}

func (f *fakeNavStore) AddSearchHistory(_ context.Context, _, _ string) error {
	return nil
}

func (f *fakeNavStore) ClearSearchHistory(_ context.Context, _ string) error {
	return nil
}

func (f *fakeNavStore) GetBookmarks(_ context.Context, _ string) ([]navigation.Bookmark, error) {
	if f.bookmarksResult != nil {
		return f.bookmarksResult, nil
	}
	return []navigation.Bookmark{}, nil
}

func (f *fakeNavStore) AddBookmark(_ context.Context, _, _ string) error {
	return nil
}

func (f *fakeNavStore) DeleteBookmark(_ context.Context, _ string, _ int) error {
	return nil
}

func TestAutocompleteHandler(t *testing.T) {
	store := &fakeNavStore{
		autocompleteResult: []navigation.QueryStat{
			{Query: "AS64500", Count: 5},
		},
	}
	h := navigation.NewHandlers(store, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/autocomplete/AS6", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body []navigation.QueryStat
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body) != 1 {
		t.Fatalf("expected 1 item, got %d", len(body))
	}
	if body[0].Query != "AS64500" {
		t.Fatalf("expected query AS64500, got %q", body[0].Query)
	}
}

func TestAutocompleteHandlerEmptyQuery(t *testing.T) {
	h := navigation.NewHandlers(&fakeNavStore{}, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/autocomplete/", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestSearchHistoryGetHandler(t *testing.T) {
	store := &fakeNavStore{
		historyResult: []navigation.SearchHistoryEntry{
			{ID: 1, Query: "AS64500", CreatedAt: time.Now()},
		},
	}
	h := navigation.NewHandlers(store, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/search-history", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestSearchHistoryClearHandler(t *testing.T) {
	h := navigation.NewHandlers(&fakeNavStore{}, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodDelete, "/api/search-history/clear", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestBookmarksGetHandler(t *testing.T) {
	store := &fakeNavStore{
		bookmarksResult: []navigation.Bookmark{
			{ID: 1, Query: "AS64500", CreatedAt: time.Now()},
		},
	}
	h := navigation.NewHandlers(store, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/bookmarks", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestBookmarkDeleteHandler(t *testing.T) {
	h := navigation.NewHandlers(&fakeNavStore{}, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodDelete, "/api/bookmarks/42", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestPopularHandler(t *testing.T) {
	store := &fakeNavStore{
		popularResult: []navigation.QueryStat{
			{Query: "AS64500", Count: 100},
		},
	}
	h := navigation.NewHandlers(store, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/popular", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestTrendingHandler(t *testing.T) {
	store := &fakeNavStore{
		trendingResult: []navigation.QueryStat{
			{Query: "AS64501", Count: 50},
		},
	}
	h := navigation.NewHandlers(store, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/trending", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
