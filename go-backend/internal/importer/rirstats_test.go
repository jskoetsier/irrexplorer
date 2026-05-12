package importer_test

import (
	"testing"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/importer"
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

func TestParseRIRLineMasksHostBits(t *testing.T) {
	// Some RIR delegations report a start address with host bits set; Postgres CIDR
	// rejects these, so we must mask them off in the importer.
	line := "ripencc|NL|ipv4|192.0.2.5|256|20000101|allocated"
	entry, ok := importer.ParseRIRLine(line, "RIPENCC")
	if !ok {
		t.Fatal("expected parse success after masking")
	}
	if entry.Prefix != "192.0.2.0/24" {
		t.Fatalf("expected masked prefix 192.0.2.0/24, got: %s", entry.Prefix)
	}
}

func TestParseRIRLineSkipsInvalidIPv4(t *testing.T) {
	line := "ripencc|NL|ipv4|not-an-ip|256|20000101|allocated"
	if _, ok := importer.ParseRIRLine(line, "RIPENCC"); ok {
		t.Fatal("expected invalid IPv4 to be rejected")
	}
}

func TestParseRIRLineSkipsInvalidIPv6(t *testing.T) {
	line := "ripencc|NL|ipv6|not-an-ip|48|20000101|allocated"
	if _, ok := importer.ParseRIRLine(line, "RIPENCC"); ok {
		t.Fatal("expected invalid IPv6 to be rejected")
	}
}

func TestParseRIRLineIPv6(t *testing.T) {
	line := "ripencc|NL|ipv6|2001:db8::|32|20000101|allocated"
	entry, ok := importer.ParseRIRLine(line, "RIPENCC")
	if !ok {
		t.Fatal("expected parse success")
	}
	if entry.Prefix != "2001:db8::/32" {
		t.Fatalf("unexpected prefix: %s", entry.Prefix)
	}
}
