package importer_test

import (
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/importer"
)

func TestParseBGPLine(t *testing.T) {
	line := `{"prefix":"192.0.2.0/24","asn":64500,"rpki_status":"VALID"}`
	entry, err := importer.ParseBGPLine([]byte(line))
	if err != nil {
		t.Fatal(err)
	}
	if entry.Prefix != "192.0.2.0/24" || entry.ASN != 64500 || entry.RPKIStatus != "VALID" {
		t.Fatalf("unexpected entry: %+v", entry)
	}
}

func TestParseBGPLineInvalid(t *testing.T) {
	_, err := importer.ParseBGPLine([]byte(`not json`))
	if err == nil {
		t.Fatal("expected error")
	}
}
