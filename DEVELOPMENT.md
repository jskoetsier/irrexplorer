# Development Workflow

Complete guide for developing IRRExplorer with best practices and coding standards.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Code Structure](#code-structure)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing](#testing)
6. [Git Workflow](#git-workflow)
7. [Code Review](#code-review)
8. [Performance Guidelines](#performance-guidelines)

## Development Setup

### Quick Start

```bash
# Clone repository
git clone https://github.com/jskoetsier/irrexplorer.git
cd irrexplorer

# Start development environment with Docker
docker compose up -d

# Or start manually - see sections below
```

Access:
- Frontend: http://localhost:8080 (hot reload enabled in dev)
- Backend API: http://localhost:8080/api
- Database: localhost:5432

### Local Development (Without Docker)

#### 1. Setup Go Backend

```bash
cd go-backend

# Install dependencies
go mod download

# Run tests
go test ./...

# Start backend with auto-reload (requires air or similar)
go run ./cmd/api
```

#### 2. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install
# or: yarn install

# Start development server with hot reload
npm run dev
```

## Code Structure

### Go Backend Structure

```
go-backend/
├── cmd/
│   ├── api/           # Main API server
│   └── importer/     # Data importer
├── internal/
│   ├── httpapi/      # HTTP handlers and routing
│   ├── store/        # Database operations
│   ├── cache/        # Redis caching
│   ├── irrd/         # IRRd GraphQL client
│   ├── config/       # Configuration
│   ├── middleware/   # HTTP middleware (CORS, rate limiting)
│   ├── domain/       # Domain models
│   ├── datasources/  # External data sources (RDAP, PeeringDB)
│   ├── navigation/   # Search history and bookmarks
│   ├── analysis/     # Analysis endpoints
│   ├── visualization/# Visualization data
│   └── export/       # Export handlers
└── db/
    └── migrations/   # SQL migrations
```

### Frontend Structure

```
frontend/src/
├── components/            # React components
│   ├── prefixTable/      # Prefix display
│   ├── setExpansionTable/ # Set expansion display
│   └── visualizations/   # Graph visualizations
├── services/             # API clients
│   └── api.ts           # Backend API client
├── types/                # TypeScript types
├── utils/                # Utility functions
├── App.tsx               # Main application
└── main.tsx              # Entry point
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow coding standards (see below) and keep commits atomic:

```bash
# Make changes
vim go-backend/internal/httpapi/query.go

# Test changes
go test ./internal/httpapi/...

# Commit with clear message
git add go-backend/internal/httpapi/query.go
git commit -m "Add input validation to query parser"
```

### 3. Run Tests

```bash
# Go backend tests
cd go-backend
go test ./...

# Frontend tests
cd frontend
npm test

# Integration tests (with Docker)
docker compose up -d
# ... run tests
docker compose down
```

### 4. Format and Lint

```bash
# Go
cd go-backend
go fmt ./...
go vet ./...
golangci-lint run

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
# Create pull request on GitHub
```

## Coding Standards

### Go (Backend)

#### Style Guide

Follow standard Go conventions:

```go
// Line length: 100 characters max
// Indentation: Tabs (not spaces)
// Package names: lowercase, short

package httpapi

import (
    "context"
    "encoding/json"
    "net/http"
    
    "github.com/sebastiaan/irrexplorer/go-backend/internal/config"
)

// Good: Use context for cancellation
func (s *Server) handlePrefix(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    
    // Process request
    result, err := s.collectForPrefixes(ctx, prefixes)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    writeJSON(w, http.StatusOK, result)
}
```

#### Error Handling

Be specific with errors:

```go
// Good
if err != nil {
    return nil, fmt.Errorf("failed to query prefix %s: %w", prefix, err)
}

// Good: Use sentinel errors for expected conditions
var ErrNotFound = errors.New("resource not found")

if errors.Is(err, ErrNotFound) {
    // Handle not found
}

// Bad: Don't swallow errors
if err != nil {
    // Do nothing
}
```

#### Logging

Use structured logging:

```go
logger.Info("request completed",
    "method", r.Method,
    "path", r.URL.Path,
    "duration", time.Since(start),
)
```

### TypeScript/React (Frontend)

#### Component Style

Use functional components with hooks:

```typescript
// Good
import React, { useState, useEffect, useMemo } from 'react';

interface PrefixTableProps {
    data: PrefixData[];
    onSelect: (prefix: string) => void;
}

function PrefixTable({ data, onSelect }: PrefixTableProps) {
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => 
            sortOrder === 'asc' ? a.prefix.localeCompare(b.prefix) 
            : b.prefix.localeCompare(a.prefix)
        );
    }, [data, sortOrder]);

    return (
        <table>
            {/* ... */}
        </table>
    );
}

// Bad: Class components
class PrefixTable extends React.Component { ... }
```

#### Naming Conventions

```typescript
// Components: PascalCase
const PrefixTable = () => {};

// Functions: camelCase
const handlePrefixSelect = () => {};

// Constants: UPPER_SNAKE_CASE
const MAX_RESULTS = 1000;

// Types/Interfaces: PascalCase
interface RouteInfo { ... }
type QueryCategory = 'prefix' | 'asn' | 'as-set';
```

### SQL

```sql
-- Use uppercase for keywords
-- Use meaningful aliases

SELECT
    p.prefix,
    p.asn,
    r.country_code
FROM bgp AS p
INNER JOIN rirstats AS r
    ON r.prefix >>= p.prefix
WHERE
    p.asn = 64512
    AND p.prefix <<= '192.0.2.0/24'
ORDER BY p.prefix;
```

## Testing

### Go Backend Testing

#### Unit Tests

```go
package httpapi

import (
    "testing"
)

func TestCleanQuery(t *testing.T) {
    tests := []struct {
        name    string
        query   string
        want    QueryCategory
        wantErr bool
    }{
        {"valid prefix", "192.0.2.0/24", QueryCategoryPrefix, false},
        {"valid ASN", "AS15169", QueryCategoryASN, false},
        {"valid AS-SET", "AS-MYCOMPANY", QueryCategoryASSet, false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := CleanQuery(tt.query, 9, 29)
            if (err != nil) != tt.wantErr {
                t.Errorf("CleanQuery() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if !tt.wantErr && got.Category != tt.want {
                t.Errorf("CleanQuery() = %v, want %v", got.Category, tt.want)
            }
        })
    }
}
```

#### Integration Tests

```go
func TestServerIntegration(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration test")
    }
    
    // Setup test database
    // Run tests
    // Teardown
}
```

#### Running Tests

```bash
# All tests
go test ./...

# Specific package
go test ./internal/httpapi/...

# With coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Verbose
go test -v ./...

# Stop on first failure
go test -failfast ./...
```

### Frontend Testing

#### Component Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { PrefixTable } from './PrefixTable';

test('renders prefix table', () => {
    const prefixes = [
        { prefix: '192.0.2.0/24', asn: 64512 }
    ];

    render(<PrefixTable data={prefixes} onSelect={jest.fn()} />);

    expect(screen.getByText('192.0.2.0/24')).toBeInTheDocument();
    expect(screen.getByText('64512')).toBeInTheDocument();
});
```

#### Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

## Git Workflow

### Branch Naming

```bash
feature/add-rpki-validation
bugfix/fix-prefix-overlap
hotfix/security-cors-update
docs/update-installation-guide
refactor/optimize-database-queries
```

### Commit Messages

Follow Conventional Commits:

```
type(scope): short description

Longer description if needed.

Closes #123
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Testing changes
- `chore`: Build/tooling changes

Examples:
```bash
feat(api): add RPKI validation endpoint

Add new endpoint for validating prefixes against RPKI ROAs.
Includes caching layer for improved performance.

Closes #456

---

fix(frontend): resolve table sorting issue

Fixed bug where table sorting would reset on data update.

Fixes #789
```

### Pull Request Process

1. **Create PR with description**:
   - What: What changes were made
   - Why: Why these changes are needed
   - How: How to test the changes

2. **Ensure CI passes**:
   - All tests pass
   - Linters pass
   - No security vulnerabilities

3. **Request reviews**:
   - At least one approval required
   - Address feedback promptly

4. **Merge strategy**:
   - Use "Squash and merge" for feature branches
   - Delete branch after merge

## Code Review

### As a Reviewer

#### Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Error handling is appropriate
- [ ] No code duplication
- [ ] API changes are backward compatible

### As an Author

- Respond to all comments
- Ask for clarification if needed
- Be open to feedback
- Update PR based on review

## Performance Guidelines

### Backend Performance (Go)

#### Database Queries

```go
// Good: Use parameterized queries with pgx
rows, err := s.pool.Query(ctx, `
    SELECT prefix::text, asn, rpki_status FROM bgp
    WHERE prefix <<= $1::cidr OR prefix >> $1::cidr
    LIMIT 10000
`, prefix.String())

// Bad: String concatenation (SQL injection risk)
query := "SELECT * FROM bgp WHERE asn = " + asn
```

#### Caching

```go
// Check cache first
var result []RouteInfo
if c.cache.Get(ctx, cacheKey, &result) {
    return result, nil
}

// Cache misses - query database
result, err := queryDatabase(ctx, key)

// Store in cache with TTL
c.cache.Set(ctx, cacheKey, result, 5*time.Minute)
```

#### Concurrent Queries

```go
// Use goroutines for parallel operations
var wg sync.WaitGroup
semaphore := make(chan struct{}, maxConcurrency)

for _, item := range items {
    wg.Add(1)
    go func(item Item) {
        defer wg.Done()
        
        semaphore <- struct{}{}
        defer func() { <-semaphore }()
        
        // Process item
    }(item)
}
wg.Wait()
```

### Frontend Performance

#### Memoization

```typescript
const expensiveCalculation = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
}, [data]);
```

#### Lazy Loading

```typescript
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

function App() {
    return (
        <Suspense fallback={<Loading />}>
            <HeavyComponent />
        </Suspense>
    );
}
```

## Additional Resources

- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Effective Go](https://go.dev/doc/effective_go)
- [React Best Practices](https://reactjs.org/docs/thinking-in-react.html)
- [PostgreSQL Performance](https://wiki.postgresql.org/wiki/Performance_Optimization)