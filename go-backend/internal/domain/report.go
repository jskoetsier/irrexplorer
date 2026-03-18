package domain

import "net/netip"

type specialUsePrefix struct {
	Name   string
	Prefix netip.Prefix
}

var specialUseSpace = []specialUsePrefix{
	{Name: "RFC1122", Prefix: netip.MustParsePrefix("0.0.0.0/8")},
	{Name: "RFC1918", Prefix: netip.MustParsePrefix("10.0.0.0/8")},
	{Name: "RFC6598", Prefix: netip.MustParsePrefix("100.64.0.0/10")},
	{Name: "LOOPBACK", Prefix: netip.MustParsePrefix("127.0.0.0/8")},
	{Name: "RFC1918", Prefix: netip.MustParsePrefix("172.16.0.0/12")},
	{Name: "RFC5736", Prefix: netip.MustParsePrefix("192.0.0.0/24")},
	{Name: "RFC1918", Prefix: netip.MustParsePrefix("192.168.0.0/16")},
	{Name: "RFC3927", Prefix: netip.MustParsePrefix("169.254.0.0/16")},
	{Name: "RFC5737", Prefix: netip.MustParsePrefix("192.0.2.0/24")},
	{Name: "RFC2544", Prefix: netip.MustParsePrefix("198.18.0.0/15")},
	{Name: "RFC5737", Prefix: netip.MustParsePrefix("198.51.100.0/24")},
	{Name: "RFC5737", Prefix: netip.MustParsePrefix("203.0.113.0/24")},
	{Name: "CLASS-E", Prefix: netip.MustParsePrefix("240.0.0.0/4")},
	{Name: "IPv4-mapped", Prefix: netip.MustParsePrefix("::ffff:0:0/96")},
	{Name: "IPv4-compatible", Prefix: netip.MustParsePrefix("::/96")},
	{Name: "IPv6-ULA", Prefix: netip.MustParsePrefix("fc00::/7")},
}

func EnrichPrefixSummariesWithReport(prefixSummaries []PrefixSummary) {
	for idx := range prefixSummaries {
		s := &prefixSummaries[idx]
		irrOrigins := s.IRROrigins()
		rpkiOrigins := s.RPKIOrigins()

		if len(s.BGPOrigins) == 0 && len(irrOrigins) > 0 {
			s.Info("Route objects exist, but prefix not seen in DFZ")
		}
		if len(s.BGPOrigins) == 0 && len(rpkiOrigins) > 0 && !equalIntSets(rpkiOrigins, []int{0}) {
			s.Info("RPKI ROA exists, but prefix not seen in DFZ")
		}
		if s.IRRExpectedRIR() != "" && len(s.IRRRoutes) > 0 && len(s.IRRRoutesExpectedRIR()) == 0 {
			s.Warning("Expected route object in " + s.IRRExpectedRIR() + ", but only found in other IRRs")
		}
		if diffIntSets(s.BGPOrigins, irrOrigins) {
			if intersectsIntSets(s.BGPOrigins, irrOrigins) {
				s.Danger("No route objects for some DFZ origins")
			} else {
				s.Danger("No route objects match DFZ origin")
			}
		} else if len(s.IRRRoutesExpectedRIR()) > 0 && diffIntSets(s.BGPOrigins, s.IRROriginsExpectedRIR()) {
			s.Danger("Expected route object in " + s.IRRExpectedRIR() + ", but BGP origin does not match. Objects from other IRRs do match BGP origin")
		} else if len(s.IRROriginsNotExpectedRIR()) > 0 && diffIntSets(s.BGPOrigins, s.IRROriginsNotExpectedRIR()) {
			s.Warning("Expected route object in " + s.IRRExpectedRIR() + " matches BGP origin, but non-matching objects exist in other IRRs")
		} else if len(irrOrigins) > 1 && len(s.BGPOrigins) == 1 {
			s.Warning("Multiple route objects exist with different origins, but DFZ only has one")
		}
		if len(rpkiOrigins) > 0 && diffIntSets(s.BGPOrigins, rpkiOrigins) {
			s.Danger("RPKI origin does not match BGP origin")
		}
		irrRoutesAll := flattenDetails(s.IRRRoutes)
		if anyStatus(irrRoutesAll, "INVALID") {
			s.Danger("RPKI-invalid route objects found")
		} else if len(irrRoutesAll) > 0 && allStatus(irrRoutesAll, "NOT_FOUND") {
			s.Info("No (covering) RPKI ROA found for route objects")
		}
		for _, special := range specialUseSpace {
			if Overlaps(s.Prefix, special.Prefix) {
				s.Danger("Overlaps with " + special.Name + " special use prefix " + special.Prefix.String())
			}
		}
		s.FinalizeStatus()
	}
}

func Overlaps(a, b netip.Prefix) bool {
	return a.Contains(b.Addr()) || b.Contains(a.Addr())
}

func diffIntSets(a, b []int) bool {
	for _, item := range a {
		if !containsInt(b, item) {
			return true
		}
	}
	return false
}

func intersectsIntSets(a, b []int) bool {
	for _, item := range a {
		if containsInt(b, item) {
			return true
		}
	}
	return false
}

func equalIntSets(a, b []int) bool {
	return len(a) == len(b) && !diffIntSets(a, b) && !diffIntSets(b, a)
}

func containsInt(values []int, target int) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func anyStatus(items []PrefixIRRDetail, status string) bool {
	for _, item := range items {
		if item.RPKIStatus == status {
			return true
		}
	}
	return false
}

func allStatus(items []PrefixIRRDetail, status string) bool {
	for _, item := range items {
		if item.RPKIStatus != status {
			return false
		}
	}
	return len(items) > 0
}
