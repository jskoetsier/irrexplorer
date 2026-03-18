package httpapi

import (
	"strings"
	"testing"
)

func TestCleanQuery(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    QueryResponse
		wantErr string
	}{
		{
			name:  "prefix",
			input: "192.0.2/24",
			want:  QueryResponse{CleanedValue: "192.0.2.0/24", Category: QueryCategoryPrefix},
		},
		{
			name:  "misaligned prefix",
			input: "192.0.2.3/24",
			want:  QueryResponse{CleanedValue: "192.0.2.0/24", Category: QueryCategoryPrefix},
		},
		{
			name:  "bare asn",
			input: "192",
			want:  QueryResponse{CleanedValue: "AS192", Category: QueryCategoryASN},
		},
		{
			name:  "asn",
			input: "AS64500",
			want:  QueryResponse{CleanedValue: "AS64500", Category: QueryCategoryASN},
		},
		{
			name:  "as-set",
			input: "foobar",
			want:  QueryResponse{CleanedValue: "FOOBAR", Category: QueryCategoryASSet},
		},
		{
			name:  "route-set",
			input: "RS-DEMo",
			want:  QueryResponse{CleanedValue: "RS-DEMO", Category: QueryCategoryRouteSet},
		},
		{
			name:    "invalid",
			input:   "--invalid-",
			wantErr: "valid prefix",
		},
		{
			name:    "v4 prefix too large",
			input:   "192.0.0.0/8",
			wantErr: "minimum prefix length is 9",
		},
		{
			name:    "v6 prefix too large",
			input:   "2001::/16",
			wantErr: "minimum prefix length is 29",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := CleanQuery(tt.input, 9, 29)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.wantErr)
				}
				if !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("expected error containing %q, got %q", tt.wantErr, err.Error())
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("unexpected result: got %+v want %+v", got, tt.want)
			}
		})
	}
}
