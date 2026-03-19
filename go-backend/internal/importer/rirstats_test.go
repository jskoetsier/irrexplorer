package importer_test

import (
	"testing"

	"github.com/sebastiaan/irrexplorer/go-backend/internal/importer"
)

func TestParseRIRLine(t *testing.T) {
	// Standard RIR delegation format: registry|cc|type|start|value|date|status
	line := "ripencc|NL|ipv4|192.0.2.0|256|20000101|allocated"
	entry, ok := importer.ParseRIRLine(line, "RIPE NCC")
	if !ok {
		t.Fatal("expected parse success")
	}
	if entry.Prefix != "192.0.2.0/24" {
		t.Fatalf("unexpected prefix: %s", entry.Prefix)
	}
	if entry.RIR != "RIPE NCC" {
		t.Fatalf("unexpected rir: %s", entry.RIR)
	}
}

func TestParseRIRLineSkipsNonIP(t *testing.T) {
	line := "ripencc|NL|asn|64500|1|20000101|allocated"
	_, ok := importer.ParseRIRLine(line, "RIPE NCC")
	if ok {
		t.Fatal("expected non-IP line to be skipped")
	}
}
