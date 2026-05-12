package httpapi

import (
	"context"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/domain"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
)

func (s *Server) handleMemberOf(w http.ResponseWriter, r *http.Request) {
	trimmed := strings.TrimPrefix(r.URL.Path, "/api/sets/member-of/")
	parts := strings.Split(trimmed, "/")

	objectClass := "as-set"
	target := ""
	switch len(parts) {
	case 1:
		target = parts[0]
	case 2:
		objectClass = parts[0]
		target = parts[1]
	default:
		http.NotFound(w, r)
		return
	}

	if objectClass != "as-set" && objectClass != "route-set" {
		http.Error(w, "Unknown object class: "+objectClass, http.StatusNotFound)
		return
	}
	if _, err := strconv.ParseInt(target, 10, 64); err == nil {
		target = "AS" + target
	}

	key := cacheKey("member_of", objectClass, target)
	if s.tryCache(w, key) {
		return
	}

	result, err := s.irrdClient.QueryMemberOf(r.Context(), target, objectClass)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	memberOf := domain.MemberOf{
		IRRsSeen:   []string{},
		SetsPerIRR: map[string][]string{},
	}
	irrsSeen := make(map[string]struct{})
	setsPerIRR := make(map[string]map[string]struct{})

	for _, foundSet := range result.Set {
		irrsSeen[foundSet.Source] = struct{}{}
		addSet(setsPerIRR, foundSet.Source, foundSet.RPSLPK)
	}

	if objectClass == "as-set" {
		for _, autNum := range result.AutNum {
			for _, memberOfObj := range autNum.MemberOfObjs {
				expected := make(map[string]struct{})
				for _, ref := range memberOfObj.MbrsByRef {
					expected[ref] = struct{}{}
				}
				if _, ok := expected["ANY"]; ok || intersectsStringSets(autNum.MntBy, memberOfObj.MbrsByRef) {
					irrsSeen[memberOfObj.Source] = struct{}{}
					addSet(setsPerIRR, memberOfObj.Source, memberOfObj.RPSLPK)
				}
			}
		}
	}

	for irr := range irrsSeen {
		memberOf.IRRsSeen = append(memberOf.IRRsSeen, irr)
	}
	slices.Sort(memberOf.IRRsSeen)
	for irr, values := range setsPerIRR {
		items := make([]string, 0, len(values))
		for value := range values {
			items = append(items, value)
		}
		slices.Sort(items)
		memberOf.SetsPerIRR[irr] = items
	}

	s.setCache(key, memberOf, ttlMemberOf)
	httputil.WriteJSON(w, http.StatusOK, memberOf)
}

func (s *Server) handleSetExpand(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/sets/expand/")

	key := cacheKey("set_expand", name)
	if s.tryCache(w, key) {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	resolved := map[string]map[string][]string{name: {}}
	toResolve := map[string]struct{}{name: {}}

	for depth := 0; depth < 20 && len(toResolve) > 0; depth++ {
		names := make([]string, 0, len(toResolve))
		for item := range toResolve {
			names = append(names, item)
		}
		results, err := s.irrdClient.QuerySetMembers(ctx, names)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		next := make(map[string]struct{})
		for _, item := range results {
			if _, ok := resolved[item.RPSLPK]; !ok {
				resolved[item.RPSLPK] = map[string][]string{}
			}
			resolved[item.RPSLPK][item.RootSource] = item.Members
			for _, member := range item.Members {
				if isSet(member) {
					if _, done := resolved[member]; !done {
						next[member] = struct{}{}
					}
				}
			}
		}
		toResolve = next
		if len(toResolve) > 1000 || len(resolved) > 1000 {
			break
		}
	}

	results := make([]domain.SetExpansion, 0)
	var traverse func(string, int, []string)
	traverse = func(stub string, depth int, path []string) {
		if slices.Contains(path, stub) {
			return
		}
		path = append(append([]string{}, path...), stub)
		depth++
		for source, members := range resolved[stub] {
			items := append([]string{}, members...)
			slices.Sort(items)
			results = append(results, domain.SetExpansion{
				Name:    stub,
				Source:  source,
				Depth:   depth,
				Path:    path,
				Members: items,
			})
		}
		for _, members := range resolved[stub] {
			for _, member := range members {
				if _, ok := resolved[member]; ok {
					traverse(member, depth, path)
				}
			}
		}
	}

	traverse(name, 0, nil)
	slices.SortStableFunc(results, func(a, b domain.SetExpansion) int {
		if a.Depth != b.Depth {
			return a.Depth - b.Depth
		}
		if a.Name < b.Name {
			return -1
		}
		if a.Name > b.Name {
			return 1
		}
		if a.Source < b.Source {
			return -1
		}
		if a.Source > b.Source {
			return 1
		}
		return 0
	})

	s.setCache(key, results, ttlSetExpand)
	httputil.WriteJSON(w, http.StatusOK, results)
}

func addSet(sets map[string]map[string]struct{}, key, value string) {
	if _, ok := sets[key]; !ok {
		sets[key] = map[string]struct{}{}
	}
	sets[key][value] = struct{}{}
}

func isSet(name string) bool {
	if !strings.HasPrefix(name, "AS") {
		return true
	}
	if len(name) <= 2 {
		return true
	}
	for _, ch := range name[2:] {
		if ch < '0' || ch > '9' {
			return true
		}
	}
	return false
}

// intersectsStringSets returns true if a and b share at least one element.
func intersectsStringSets(a, b []string) bool {
	for _, left := range a {
		if slices.Contains(b, left) {
			return true
		}
	}
	return false
}
