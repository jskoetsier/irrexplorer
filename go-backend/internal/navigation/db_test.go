package navigation_test

import (
	"context"
	"os"
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/navigation"
)

func testDB(t *testing.T) *navigation.Store {
	t.Helper()
	url := os.Getenv("INTEGRATION_DB_URL")
	if url == "" {
		t.Skip("INTEGRATION_DB_URL not set")
	}
	store, err := navigation.NewStore(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func TestAutocomplete(t *testing.T) {
	store := testDB(t)
	results, err := store.Autocomplete(context.Background(), "AS")
	if err != nil {
		t.Fatal(err)
	}
	_ = results
}
