package httpapi

import (
	"errors"
	"fmt"
	"net/netip"
	"regexp"
	"strconv"
	"strings"
)

const maxQueryLength = 255

var rpslNamePattern = regexp.MustCompile(`(?i)^[A-Z][A-Z0-9_:-]*[A-Z0-9]$`)

type invalidQueryError struct {
	message string
}

func (e invalidQueryError) Error() string {
	return e.message
}

type QueryCategory string

const (
	QueryCategoryASN      QueryCategory = "asn"
	QueryCategoryPrefix   QueryCategory = "prefix"
	QueryCategoryASSet    QueryCategory = "as-set"
	QueryCategoryRouteSet QueryCategory = "route-set"
)

type QueryResponse struct {
	Category     QueryCategory `json:"category"`
	CleanedValue string        `json:"cleanedValue"`
}

func CleanQuery(raw string, minimumPrefixIPv4, minimumPrefixIPv6 int) (QueryResponse, error) {
	raw = strings.TrimSpace(raw)
	if len(raw) > maxQueryLength {
		return QueryResponse{}, fmt.Errorf("query too long (max %d characters)", maxQueryLength)
	}

	if cleaned, ok := cleanASN(raw); ok {
		return QueryResponse{Category: QueryCategoryASN, CleanedValue: cleaned}, nil
	}

	if cleaned, err := cleanPrefix(raw, minimumPrefixIPv4, minimumPrefixIPv6); err == nil {
		return QueryResponse{Category: QueryCategoryPrefix, CleanedValue: cleaned}, nil
	} else {
		var invalidErr invalidQueryError
		if errors.As(err, &invalidErr) {
			return QueryResponse{}, err
		}
	}

	if rpslNamePattern.MatchString(raw) {
		cleaned := strings.ToUpper(raw)
		category := QueryCategoryASSet
		if strings.HasPrefix(cleaned, "RS-") || strings.Contains(cleaned, ":RS-") {
			category = QueryCategoryRouteSet
		}
		return QueryResponse{Category: category, CleanedValue: cleaned}, nil
	}

	return QueryResponse{}, errors.New("not a valid prefix, IP, ASN or AS-set")
}

func cleanASN(raw string) (string, bool) {
	upper := strings.ToUpper(raw)
	trimmed := raw
	if strings.HasPrefix(upper, "AS") && !strings.HasPrefix(upper, "AS-") {
		trimmed = raw[2:]
	}
	value, err := strconv.Atoi(trimmed)
	if err != nil {
		return "", false
	}
	return fmt.Sprintf("AS%d", value), true
}

func cleanPrefix(raw string, minimumPrefixIPv4, minimumPrefixIPv6 int) (string, error) {
	if strings.Contains(raw, "/") {
		prefix, err := netip.ParsePrefix(normalizePrefixInput(raw))
		if err != nil {
			return "", err
		}
		prefix = prefix.Masked()
		minimum := minimumPrefix(prefix, minimumPrefixIPv4, minimumPrefixIPv6)
		if minimum > prefix.Bits() {
			return "", invalidQueryError{message: fmt.Sprintf("query too large: the minimum prefix length is %d.", minimum)}
		}
		return prefix.String(), nil
	}

	addr, err := netip.ParseAddr(raw)
	if err != nil {
		return "", err
	}
	bits := 32
	if addr.Is6() {
		bits = 128
	}
	return netip.PrefixFrom(addr, bits).Masked().String(), nil
}

func normalizePrefixInput(raw string) string {
	if !strings.Contains(raw, "/") {
		return raw
	}

	parts := strings.SplitN(raw, "/", 2)
	addrPart := parts[0]
	if strings.Contains(addrPart, ":") {
		return raw
	}

	octets := strings.Split(addrPart, ".")
	for len(octets) < 4 {
		octets = append(octets, "0")
	}
	return strings.Join(octets, ".") + "/" + parts[1]
}

func minimumPrefix(prefix netip.Prefix, minimumPrefixIPv4, minimumPrefixIPv6 int) int {
	if prefix.Addr().Is6() {
		return minimumPrefixIPv6
	}
	return minimumPrefixIPv4
}
