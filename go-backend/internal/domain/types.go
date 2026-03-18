package domain

import (
	"encoding/json"
	"math/big"
	"net/netip"
	"slices"
	"strconv"
)

type MessageCategory string

const (
	MessageDanger  MessageCategory = "danger"
	MessageWarning MessageCategory = "warning"
	MessageInfo    MessageCategory = "info"
	MessageSuccess MessageCategory = "success"
)

type PrefixIRRDetail struct {
	ASN           int    `json:"asn"`
	RPSLText      string `json:"rpslText"`
	RPSLPK        string `json:"rpslPk,omitempty"`
	RPKIStatus    string `json:"rpkiStatus,omitempty"`
	RPKIMaxLength *int   `json:"rpkiMaxLength"`
}

type ReportMessage struct {
	Category MessageCategory `json:"category"`
	Text     string          `json:"text"`
}

type PrefixSummary struct {
	Prefix                        netip.Prefix                 `json:"-"`
	RIR                           *string                      `json:"rir"`
	RPKIRoutes                    []PrefixIRRDetail            `json:"rpkiRoutes"`
	BGPOrigins                    []int                        `json:"bgpOrigins"`
	IRRRoutes                     map[string][]PrefixIRRDetail `json:"irrRoutes"`
	Messages                      []ReportMessage              `json:"messages"`
	CategoryOverall               *MessageCategory             `json:"categoryOverall"`
	GoodnessOverall               int                          `json:"goodnessOverall"`
	PrefixSortKeyIPPrefix         string                       `json:"prefixSortKeyIpPrefix"`
	PrefixSortKeyReverseNetworkIP string                       `json:"prefixSortKeyReverseNetworklenIp"`
}

type prefixSummaryAlias struct {
	Prefix                        string                       `json:"prefix"`
	RIR                           *string                      `json:"rir"`
	RPKIRoutes                    []PrefixIRRDetail            `json:"rpkiRoutes"`
	BGPOrigins                    []int                        `json:"bgpOrigins"`
	IRRRoutes                     map[string][]PrefixIRRDetail `json:"irrRoutes"`
	Messages                      []ReportMessage              `json:"messages"`
	CategoryOverall               *MessageCategory             `json:"categoryOverall"`
	GoodnessOverall               int                          `json:"goodnessOverall"`
	PrefixSortKeyIPPrefix         string                       `json:"prefixSortKeyIpPrefix"`
	PrefixSortKeyReverseNetworkIP string                       `json:"prefixSortKeyReverseNetworklenIp"`
}

type ASNPrefixes struct {
	DirectOrigin []PrefixSummary `json:"directOrigin"`
	Overlaps     []PrefixSummary `json:"overlaps"`
}

type MemberOf struct {
	IRRsSeen   []string            `json:"irrsSeen"`
	SetsPerIRR map[string][]string `json:"setsPerIrr"`
}

type SetExpansion struct {
	Name    string   `json:"name"`
	Source  string   `json:"source"`
	Depth   int      `json:"depth"`
	Path    []string `json:"path"`
	Members []string `json:"members"`
}

type RouteInfo struct {
	Prefix        netip.Prefix
	ASN           int
	RIR           *string
	RPSLPK        string
	IRRSource     string
	RPSLText      string
	RPKIStatus    string
	RPKIMaxLength *int
}

var RIRExpectedIRR = map[string]string{
	"AFRINIC":     "AFRINIC",
	"APNIC":       "APNIC",
	"ARIN":        "ARIN",
	"LACNIC":      "LACNIC",
	"RIPE NCC":    "RIPE",
	"Registro.BR": "TC",
}

func (p PrefixSummary) MarshalJSON() ([]byte, error) {
	irrRoutes := p.IRRRoutes
	if irrRoutes == nil {
		irrRoutes = map[string][]PrefixIRRDetail{}
	}
	return json.Marshal(prefixSummaryAlias{
		Prefix:                        p.Prefix.String(),
		RIR:                           p.RIR,
		RPKIRoutes:                    p.RPKIRoutes,
		BGPOrigins:                    p.BGPOrigins,
		IRRRoutes:                     irrRoutes,
		Messages:                      p.Messages,
		CategoryOverall:               p.CategoryOverall,
		GoodnessOverall:               p.GoodnessOverall,
		PrefixSortKeyIPPrefix:         p.PrefixSortKeyIPPrefix,
		PrefixSortKeyReverseNetworkIP: p.PrefixSortKeyReverseNetworkIP,
	})
}

func (p *PrefixSummary) FinalizeStatus() {
	p.PrefixSortKeyIPPrefix = IPNumericString(p.Prefix.Addr()) + "/" + strconv.Itoa(p.Prefix.Bits())
	p.PrefixSortKeyReverseNetworkIP = strconv.Itoa(128-p.Prefix.Bits()) + "-" + IPNumericString(p.Prefix.Addr())

	if len(p.Messages) == 0 {
		p.Success("Everything looks good")
	}

	order := []MessageCategory{MessageDanger, MessageWarning, MessageInfo, MessageSuccess}
	slices.SortStableFunc(p.Messages, func(a, b ReportMessage) int {
		return slices.Index(order, a.Category) - slices.Index(order, b.Category)
	})

	for idx, category := range order {
		for _, message := range p.Messages {
			if message.Category == category {
				c := category
				p.CategoryOverall = &c
				p.GoodnessOverall = idx
				return
			}
		}
	}
}

func (p *PrefixSummary) AddMessage(category MessageCategory, text string) {
	p.Messages = append(p.Messages, ReportMessage{Category: category, Text: text})
}

func (p *PrefixSummary) Success(text string) { p.AddMessage(MessageSuccess, text) }
func (p *PrefixSummary) Info(text string)    { p.AddMessage(MessageInfo, text) }
func (p *PrefixSummary) Warning(text string) { p.AddMessage(MessageWarning, text) }
func (p *PrefixSummary) Danger(text string)  { p.AddMessage(MessageDanger, text) }

func (p *PrefixSummary) IRROrigins() []int {
	return uniqueSortedASNs(flattenDetails(p.IRRRoutes))
}

func (p *PrefixSummary) RPKIOrigins() []int {
	return uniqueSortedASNs(p.RPKIRoutes)
}

func (p *PrefixSummary) IRRExpectedRIR() string {
	if p.RIR == nil {
		return ""
	}
	return RIRExpectedIRR[*p.RIR]
}

func (p *PrefixSummary) IRRRoutesExpectedRIR() []PrefixIRRDetail {
	expected := p.IRRExpectedRIR()
	if expected == "" {
		return nil
	}
	return p.IRRRoutes[expected]
}

func (p *PrefixSummary) IRROriginsExpectedRIR() []int {
	return uniqueSortedASNs(p.IRRRoutesExpectedRIR())
}

func (p *PrefixSummary) IRROriginsNotExpectedRIR() []int {
	expected := p.IRRExpectedRIR()
	items := make([]PrefixIRRDetail, 0)
	for source, details := range p.IRRRoutes {
		if source == expected {
			continue
		}
		items = append(items, details...)
	}
	return uniqueSortedASNs(items)
}

func flattenDetails(routes map[string][]PrefixIRRDetail) []PrefixIRRDetail {
	items := make([]PrefixIRRDetail, 0)
	for _, details := range routes {
		items = append(items, details...)
	}
	return items
}

func uniqueSortedASNs(items []PrefixIRRDetail) []int {
	seen := make(map[int]struct{})
	for _, item := range items {
		seen[item.ASN] = struct{}{}
	}
	result := make([]int, 0, len(seen))
	for asn := range seen {
		result = append(result, asn)
	}
	slices.Sort(result)
	return result
}

func IPNumericString(addr netip.Addr) string {
	raw := addr.AsSlice()
	if addr.Is4() {
		raw = raw[len(raw)-4:]
	}
	return new(big.Int).SetBytes(raw).String()
}
