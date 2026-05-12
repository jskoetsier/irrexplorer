package httputil

import (
	"encoding/json"
	"net/http"
)

// WriteJSON marshals payload as JSON and writes it to w with the given status code.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
