package domain

import (
	"encoding/json"
	"net/netip"
	"slices"
)

type MessageCategory string

const (
	MessageDanger  MessageCategory = "danger"
	MessageWarning MessageCategory = "warning"
	MessageInfo    MessageCategory = "info"
	MessageSuccess MessageCategory = "success"
)

type PrefixIRRDetail struct {
	ASN           int64  `json:"asn"`
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
	Prefix          netip.Prefix                 `json:"-"`
	RIR             *string                      `json:"rir"`
	RPKIRoutes      []PrefixIRRDetail            `json:"rpkiRoutes"`
	BGPOrigins      []int64                      `json:"bgpOrigins"`
	IRRRoutes       map[string][]PrefixIRRDetail `json:"irrRoutes"`
	Messages        []ReportMessage              `json:"messages"`
	CategoryOverall *MessageCategory             `json:"categoryOverall"`
	GoodnessOverall int                          `json:"goodnessOverall"`
}

func (p PrefixSummary) MarshalJSON() ([]byte, error) {
	if p.IRRRoutes == nil {
		p.IRRRoutes = map[string][]PrefixIRRDetail{}
	}
	type Alias PrefixSummary
	return json.Marshal(struct {
		Alias
		Prefix string `json:"prefix"`
	}{
		Alias:  Alias(p),
		Prefix: p.Prefix.String(),
	})
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
	ASN           int64
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

func (p *PrefixSummary) FinalizeStatus() {
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

func (p *PrefixSummary) IRROrigins() []int64 {
	return uniqueSortedASNs(flattenDetails(p.IRRRoutes))
}

func (p *PrefixSummary) RPKIOrigins() []int64 {
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

func (p *PrefixSummary) IRROriginsExpectedRIR() []int64 {
	return uniqueSortedASNs(p.IRRRoutesExpectedRIR())
}

func (p *PrefixSummary) IRROriginsNotExpectedRIR() []int64 {
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

func uniqueSortedASNs(items []PrefixIRRDetail) []int64 {
	seen := make(map[int64]struct{})
	for _, item := range items {
		seen[item.ASN] = struct{}{}
	}
	result := make([]int64, 0, len(seen))
	for asn := range seen {
		result = append(result, asn)
	}
	slices.Sort(result)
	return result
}
