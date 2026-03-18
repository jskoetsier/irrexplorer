package middleware

import (
	"net/http"
)

// CORS returns a middleware that sets CORS headers.
// allowedOrigins: "*" to allow all, or a specific origin string.
// Intentionally expands over Python baseline to support POST/DELETE from Phase 2.
func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// If Origin header is present AND (allowedOrigins == "*" OR origin matches allowedOrigins): set Access-Control-Allow-Origin
			if origin != "" && (allowedOrigins == "*" || origin == allowedOrigins) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			// Always set Access-Control-Allow-Methods
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")

			// Always set Access-Control-Allow-Headers
			w.Header().Set("Access-Control-Allow-Headers", "Cache-Control, Pragma, Expires, Content-Type")

			// Always set Access-Control-Max-Age
			w.Header().Set("Access-Control-Max-Age", "3600")

			// For OPTIONS preflight requests: return 204 No Content immediately (don't call next)
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			// For all other requests: call next
			next.ServeHTTP(w, r)
		})
	}
}
