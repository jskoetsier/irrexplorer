package httpapi

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/analysis"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/cache"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/config"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/datasources"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/domain"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/export"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/httputil"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/irrd"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/middleware"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/store"
	"gitlab.int.koetsier.org/sebas/irrexplorer/go-backend/internal/visualization"
)

type Server struct {
	cfg         config.Config
	logger      *slog.Logger
	mux         *http.ServeMux
	irrdClient  irrdClient
	store       prefixStore
	rdapClient  *datasources.RDAPClient
	pdbClient   *datasources.PeeringDBClient
	lgClient    *datasources.LookingGlassClient
	cache       *cache.Cache
	rateLimiter *middleware.RateLimiter
}

type irrdClient interface {
	QueryLastUpdate(ctx context.Context) (map[string]string, error)
	QueryASN(ctx context.Context, asn int64) ([]irrd.RouteInfo, error)
	QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]irrd.RouteInfo, error)
	QueryMemberOf(ctx context.Context, target string, objectClass string) (irrd.MemberOfResult, error)
	QuerySetMembers(ctx context.Context, names []string) ([]irrd.SetMemberResult, error)
}

type prefixStore interface {
	QueryPrefixesAny(ctx context.Context, prefixes []netip.Prefix) ([]domain.RouteInfo, []domain.RouteInfo, error)
	QueryBGPByASN(ctx context.Context, asn int64, limit, offset int) ([]domain.RouteInfo, int, error)
	GetLastImporterUpdate(ctx context.Context) (*time.Time, error)
	QueryRIRFreshness(ctx context.Context) (map[string]int64, error)
}

// NewServer creates a fully-initialized Server or returns an error.
// A database pool is required; the server does not start in a degraded state.
func NewServer(cfg config.Config, logger *slog.Logger, pool *pgxpool.Pool) (*Server, error) {
	if pool == nil {
		return nil, fmt.Errorf("database pool is required")
	}

	var redisCache *cache.Cache
	if cfg.RedisURL != "" {
		c, err := cache.New(cfg.RedisURL, logger)
		if err != nil {
			return nil, fmt.Errorf("redis cache init: %w", err)
		}
		redisCache = c
	}

	s := &Server{
		cfg:         cfg,
		logger:      logger,
		mux:         http.NewServeMux(),
		irrdClient:  irrd.NewCachedClient(irrd.New(cfg.IRRDEndpoint), redisCache),
		store:       store.New(pool),
		rdapClient:  datasources.NewRDAPClient(30 * time.Second),
		pdbClient:   datasources.NewPeeringDBClient(30 * time.Second),
		lgClient:    datasources.NewLookingGlassClient(cfg.LookingGlassURL, 30*time.Second),
		cache:       redisCache,
		rateLimiter: middleware.NewRateLimiter(100),
	}

	analysis.NewHandlers(analysis.NewStore(pool), redisCache).Register(s.mux)
	visualization.NewHandlers(visualization.NewStore(pool), redisCache).Register(s.mux)
	cache.NewAdminHandlers(redisCache).Register(s.mux)

	exportHandlers := export.NewHandlers(func(ctx context.Context, query string) (any, error) {
		result, err := CleanQuery(query, s.cfg.MinimumPrefixIPv4, s.cfg.MinimumPrefixIPv6)
		if err != nil {
			return nil, err
		}
		switch result.Category {
		case QueryCategoryPrefix:
			prefix, err := netip.ParsePrefix(result.CleanedValue)
			if err != nil {
				return nil, fmt.Errorf("invalid prefix %q: %w", result.CleanedValue, err)
			}
			summaries, err := s.collectForPrefixes(ctx, []netip.Prefix{prefix})
			if err != nil {
				return nil, err
			}
			domain.EnrichPrefixSummariesWithReport(summaries)
			return summaries, nil
		case QueryCategoryASN:
			raw := strings.TrimPrefix(result.CleanedValue, "AS")
			asn, err := strconv.ParseInt(raw, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid ASN %q: %w", result.CleanedValue, err)
			}
			routes, _, err := s.store.QueryBGPByASN(ctx, asn, 10000, 0)
			return routes, err
		default:
			return nil, fmt.Errorf("unsupported query type: %s", result.Category)
		}
	})
	exportHandlers.Register(s.mux)

	s.registerRoutes()
	return s, nil
}

func (s *Server) Handler() http.Handler {
	return s.rateLimiter.Middleware(
		middleware.CORS(s.cfg.AllowedOrigins)(
			s.loggingMiddleware(s.mux),
		),
	)
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("/api/docs/openapi.json", s.handleOpenAPISchema)
	s.mux.HandleFunc("/api/docs", s.handleSwaggerUI)
	s.mux.HandleFunc("/healthz", s.handleHealthz)
	s.mux.HandleFunc("/go-healthz", s.handleHealthz)
	s.mux.HandleFunc("/api/clean_query/", s.handleCleanQuery)
	s.mux.HandleFunc("/api/metadata/", s.handleMetadata)
	s.mux.HandleFunc("/api/prefixes/prefix/", s.handlePrefix)
	s.mux.HandleFunc("/api/prefixes/asn/", s.handleASN)
	s.mux.HandleFunc("/api/sets/member-of/", s.handleMemberOf)
	s.mux.HandleFunc("/api/sets/expand/", s.handleSetExpand)
	s.mux.HandleFunc("/api/datasources/lg/prefix/", s.handleLookingGlassPrefix)
	s.mux.HandleFunc("/api/datasources/lg/asn/", s.handleLookingGlassASN)
	s.mux.HandleFunc("/api/datasources/lg/route/", s.handleLookingGlassRoute)
	s.mux.HandleFunc("/api/datasources/lg/peers", s.handleLookingGlassPeers)
	s.mux.HandleFunc("/api/datasources/rdap/ip/", s.handleRDAPIP)
	s.mux.HandleFunc("/api/datasources/rdap/asn/", s.handleRDAPASN)
	s.mux.HandleFunc("/api/datasources/rdap/domain/", s.handleRDAPDomain)
	s.mux.HandleFunc("/api/datasources/peeringdb/asn/", s.handlePeeringDBASN)
	s.mux.HandleFunc("/api/datasources/peeringdb/facility/", s.handlePeeringDBFacility)
	s.mux.HandleFunc("/api/datasources/peeringdb/ix/", s.handlePeeringDBIX)
	s.mux.HandleFunc("/api/datasources/peeringdb/search", s.handlePeeringDBSearch)
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "irrexplorer-go-backend",
	})
}

func (s *Server) handleMetadata(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=60")

	key := cacheKey("metadata")
	if s.tryCache(w, r, key) {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	irrUpdates, err := s.irrdClient.QueryLastUpdate(ctx)
	if err != nil {
		s.logger.Warn("irrd last-update query failed", "error", err)
		irrUpdates = map[string]string{}
	}

	var importerValue any
	if t, err := s.store.GetLastImporterUpdate(ctx); err == nil && t != nil {
		importerValue = irrd.FormatPythonTime(*t)
	} else if s.cfg.ImporterLastUpdate != "" {
		if parsed, parseErr := time.Parse(time.RFC3339Nano, s.cfg.ImporterLastUpdate); parseErr == nil {
			importerValue = irrd.FormatPythonTime(parsed)
		} else {
			importerValue = s.cfg.ImporterLastUpdate
		}
	}

	rirFreshness, err := s.store.QueryRIRFreshness(ctx)
	if err != nil {
		s.logger.Warn("rir freshness query failed", "error", err)
		rirFreshness = map[string]int64{}
	}

	result := map[string]any{
		"last_update": map[string]any{
			"irr":      irrUpdates,
			"importer": importerValue,
		},
		"rir_freshness": rirFreshness,
	}
	s.setCache(key, result, ttlMetadata)
	httputil.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) handleCleanQuery(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimPrefix(r.URL.Path, "/api/clean_query/")
	if query == "" {
		http.Error(w, "missing query", http.StatusBadRequest)
		return
	}

	result, err := CleanQuery(query, s.cfg.MinimumPrefixIPv4, s.cfg.MinimumPrefixIPv6)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"remote_addr", r.RemoteAddr,
		)
		next.ServeHTTP(w, r)
	})
}
