package importer_test

import (
	"testing"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/importer"
)

func TestParseBGPLine(t *testing.T) {
	// bgp.tools uses uppercase JSON keys; rpki_status is not provided by this feed.
	line := `{"CIDR":"192.0.2.0/24","ASN":64500}`
	entry, err := importer.ParseBGPLine([]byte(line))
	if err != nil {
		t.Fatal(err)
	}
	if entry.Prefix != "192.0.2.0/24" || entry.ASN != 64500 {
		t.Fatalf("unexpected entry: %+v", entry)
	}
}

func TestParseBGPLine4ByteASN(t *testing.T) {
	// 4-byte ASN (>2^31) must fit; matches DB column bigint.
	line := `{"CIDR":"203.0.113.0/24","ASN":4200001401}`
	entry, err := importer.ParseBGPLine([]byte(line))
	if err != nil {
		t.Fatal(err)
	}
	if entry.ASN != 4200001401 {
		t.Fatalf("expected 4200001401, got %d", entry.ASN)
	}
}

func TestParseBGPLineInvalid(t *testing.T) {
	_, err := importer.ParseBGPLine([]byte(`not json`))
	if err == nil {
		t.Fatal("expected error")
	}
}
