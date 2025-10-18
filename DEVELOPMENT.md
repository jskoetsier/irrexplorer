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
8. [Debugging](#debugging)
9. [Performance Guidelines](#performance-guidelines)

## Development Setup

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/irrexplorer.git
cd irrexplorer

# Start development environment
docker-compose -f docker-compose.dev.yml up
```

Access:
- Frontend: http://localhost:3000 (hot reload enabled)
- Backend: http://localhost:8000 (hot reload enabled)
- Database: localhost:5432

### Local Development (Without Docker)

#### 1. Setup Backend

```bash
# Install Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Activate virtual environment
poetry shell

# Setup database
createdb irrexplorer
alembic upgrade head

# Start backend with auto-reload
uvicorn irrexplorer.app:app --reload --port 8000
```

#### 2. Setup Frontend

```bash
cd frontend

# Install dependencies
yarn install

# Start development server
yarn start
```

#### 3. Setup Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Setup hooks
pre-commit install

# Run manually on all files
pre-commit run --all-files
```

## Code Structure

### Backend Structure

```
irrexplorer/
├── api/                    # API endpoints
│   ├── collectors.py      # Data collection logic
│   ├── queries.py         # Query handling
│   ├── report.py          # Report generation
│   ├── interfaces.py      # Type definitions
│   └── utils.py           # Utility functions
├── backends/              # Data source integrations
│   ├── bgp.py            # BGP data import
│   ├── irrd.py           # IRRd GraphQL client
│   ├── rirstats.py       # RIR statistics import
│   ├── registro.py       # LACNIC integration
│   └── common.py         # Shared backend utilities
├── commands/              # CLI commands
│   └── import_data.py    # Data import command
├── storage/               # Database layer
│   ├── tables.py         # SQLAlchemy models
│   └── migrations/       # Alembic migrations
├── app.py                 # FastAPI application
├── settings.py            # Configuration
└── state.py               # State management
```

### Frontend Structure

```
frontend/src/
├── components/            # React components
│   ├── common/           # Reusable components
│   ├── prefixTable/      # Prefix display
│   ├── setExpansionTable/ # Set expansion display
│   ├── asnQuery.jsx      # ASN search
│   ├── prefixQuery.jsx   # Prefix search
│   └── setQuery.jsx      # Set search
├── services/             # API clients
│   └── api.js           # Backend API client
├── utils/                # Utility functions
│   ├── prefixData.js    # Prefix data processing
│   └── setData.js       # Set data processing
├── App.js                # Main application
└── index.js              # Entry point
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
vim irrexplorer/api/queries.py

# Test changes
pytest irrexplorer/api/tests/

# Commit with clear message
git add irrexplorer/api/queries.py
git commit -m "Add input validation to query parser"
```

### 3. Run Tests

```bash
# Backend tests
poetry run pytest

# Frontend tests
cd frontend
yarn test

# Integration tests
docker-compose -f docker-compose.dev.yml run backend pytest
```

### 4. Format and Lint

```bash
# Backend
poetry run black irrexplorer/
poetry run isort irrexplorer/
poetry run flake8 irrexplorer/
poetry run mypy irrexplorer/

# Frontend
cd frontend
yarn lint
yarn format
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
# Create pull request on GitHub
```

## Coding Standards

### Python (Backend)

#### Style Guide

Follow PEP 8 with these specifics:

```python
# Line length: 100 characters max
# Indentation: 4 spaces
# Imports: grouped and sorted

# Good
from typing import List, Optional

import asyncio

from irrexplorer.api.interfaces import ObjectClass
from irrexplorer.backends.irrd import IRRDQuery


async def fetch_data(asn: int) -> Optional[List[str]]:
    """
    Fetch routing data for given ASN.

    Args:
        asn: Autonomous System Number

    Returns:
        List of prefixes or None if not found

    Raises:
        ValueError: If ASN is invalid
    """
    if asn < 0:
        raise ValueError("ASN must be positive")

    query = IRRDQuery()
    return await query.fetch_prefixes(asn)
```

#### Type Hints

Always use type hints:

```python
# Good
def process_prefix(prefix: str, asn: int) -> dict[str, Any]:
    pass

# Bad
def process_prefix(prefix, asn):
    pass
```

#### Async/Await

Use async for I/O operations:

```python
# Good
async def fetch_data():
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

# Bad (blocking)
def fetch_data():
    response = requests.get(url)
    return response.json()
```

#### Error Handling

Be specific with exceptions:

```python
# Good
try:
    data = await fetch_data()
except aiohttp.ClientError as e:
    logger.error(f"Network error: {e}")
    raise
except json.JSONDecodeError as e:
    logger.error(f"Invalid JSON: {e}")
    raise ValueError("Invalid response format")

# Bad
try:
    data = await fetch_data()
except Exception:
    pass
```

#### Logging

Use structured logging:

```python
import logging

logger = logging.getLogger(__name__)

# Good
logger.info("Processing ASN", extra={"asn": asn, "prefix_count": len(prefixes)})
logger.error("Import failed", extra={"error": str(e), "source": source})

# Bad
print(f"Processing ASN {asn}")
```

### JavaScript/React (Frontend)

#### Component Style

Use functional components with hooks:

```javascript
// Good
import React, { useState, useEffect, useMemo } from 'react';

function PrefixTable({ data, onSelect }) {
    const [sortOrder, setSortOrder] = useState('asc');

    const sortedData = useMemo(() => {
        return data.sort((a, b) => sortOrder === 'asc' ? a - b : b - a);
    }, [data, sortOrder]);

    useEffect(() => {
        console.log('Data updated');
    }, [data]);

    return (
        <table>
            {/* ... */}
        </table>
    );
}

// Bad
class PrefixTable extends React.Component {
    constructor(props) {
        super(props);
        this.state = { sortOrder: 'asc' };
    }

    render() {
        // ...
    }
}
```

#### Prop Types

Define prop types:

```javascript
import PropTypes from 'prop-types';

function PrefixTable({ prefixes, onSelect, loading }) {
    // ...
}

PrefixTable.propTypes = {
    prefixes: PropTypes.arrayOf(PropTypes.object).isRequired,
    onSelect: PropTypes.func.isRequired,
    loading: PropTypes.bool,
};

PrefixTable.defaultProps = {
    loading: false,
};
```

#### Naming Conventions

```javascript
// Components: PascalCase
const PrefixTable = () => {};

// Functions: camelCase
const handlePrefixSelect = () => {};

// Constants: UPPER_SNAKE_CASE
const MAX_RESULTS = 1000;

// Files: camelCase for utilities, PascalCase for components
// prefixUtils.js
// PrefixTable.jsx
```

### SQL

```sql
-- Use uppercase for keywords
-- Indent subqueries
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

### Backend Testing

#### Unit Tests

```python
import pytest
from irrexplorer.api.queries import Query, InvalidQueryError


def test_query_parsing_valid_prefix():
    query = Query("192.0.2.0/24")
    assert query.is_prefix
    assert not query.is_asn


def test_query_parsing_invalid_prefix():
    with pytest.raises(InvalidQueryError):
        Query("invalid")


@pytest.mark.asyncio
async def test_prefix_collector(mock_database):
    collector = PrefixCollector(mock_database)
    result = await collector.prefix_summary("192.0.2.0/24")
    assert result is not None
    assert len(result.bgp_origins) > 0
```

#### Integration Tests

```python
from httpx import AsyncClient
import pytest


@pytest.mark.asyncio
async def test_prefix_endpoint(test_client: AsyncClient):
    response = await test_client.get("/api/prefixes/prefix/192.0.2.0/24")
    assert response.status_code == 200
    data = response.json()
    assert "prefixes" in data
```

#### Running Tests

```bash
# All tests
pytest

# Specific file
pytest irrexplorer/api/tests/test_queries.py

# With coverage
pytest --cov=irrexplorer --cov-report=html

# Verbose
pytest -vv

# Stop on first failure
pytest -x
```

### Frontend Testing

#### Component Tests

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import PrefixTable from './PrefixTable';

test('renders prefix table', () => {
    const prefixes = [
        { prefix: '192.0.2.0/24', asn: 64512 }
    ];

    render(<PrefixTable prefixes={prefixes} />);

    expect(screen.getByText('192.0.2.0/24')).toBeInTheDocument();
    expect(screen.getByText('64512')).toBeInTheDocument();
});

test('handles prefix selection', () => {
    const handleSelect = jest.fn();
    const prefixes = [{ prefix: '192.0.2.0/24', asn: 64512 }];

    render(<PrefixTable prefixes={prefixes} onSelect={handleSelect} />);

    fireEvent.click(screen.getByText('192.0.2.0/24'));
    expect(handleSelect).toHaveBeenCalledWith('192.0.2.0/24');
});
```

#### Running Tests

```bash
# All tests
yarn test

# Watch mode
yarn test --watch

# Coverage
yarn test --coverage
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

---

perf(database): optimize prefix overlap queries

Replaced linear scan with GIST index lookup.
Query time reduced from 5s to 50ms.

Closes #321
```

### Pull Request Process

1. **Create PR with description**:
   - What: What changes were made
   - Why: Why these changes are needed
   - How: How to test the changes
   - Checklist: Tests, docs, changelog updated

2. **Ensure CI passes**:
   - All tests pass
   - Linters pass
   - No security vulnerabilities

3. **Request reviews**:
   - At least one approval required
   - Address feedback promptly

4. **Merge strategy**:
   - Use "Squash and merge" for feature branches
   - Use "Rebase and merge" for hotfixes
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

#### Review Comments

```
# Good feedback
"This could cause a race condition if two users import data simultaneously.
Consider adding a distributed lock using Redis."

# Constructive
"Nice optimization! Could we add a comment explaining the algorithm?"

# Offer alternatives
"This works, but using a generator here would reduce memory usage by 50%.
Would you like me to show an example?"
```

### As an Author

- Respond to all comments
- Ask for clarification if needed
- Be open to feedback
- Update PR based on review
- Mark conversations as resolved

## Debugging

### Backend Debugging

#### Using pdb

```python
import pdb

def process_prefix(prefix: str):
    pdb.set_trace()  # Debugger will stop here
    result = complex_operation(prefix)
    return result
```

#### Using VS Code

Add to `.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: FastAPI",
            "type": "python",
            "request": "launch",
            "module": "uvicorn",
            "args": [
                "irrexplorer.app:app",
                "--reload"
            ],
            "jinja": true
        }
    ]
}
```

#### Logging

Enable debug logging:

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### Frontend Debugging

#### React DevTools

Install browser extension:
- Chrome: React Developer Tools
- Firefox: React DevTools

#### Console Debugging

```javascript
// Add debugging info
console.log('Prefix data:', prefixes);
console.table(prefixes);
console.time('sort');
sortPrefixes();
console.timeEnd('sort');

// Breakpoints
debugger;  // Browser will pause here
```

#### Network Debugging

Check API calls in browser DevTools:
- Network tab shows all requests
- Inspect request/response data
- Check timing and status codes

## Performance Guidelines

### Backend Performance

#### Database Queries

```python
# Good: Use indexes
SELECT * FROM bgp WHERE prefix >>= '192.0.2.0/24'

# Bad: Full table scan
SELECT * FROM bgp WHERE text(prefix) LIKE '%192.0.2%'
```

#### Caching

```python
from functools import lru_cache

@lru_cache(maxsize=1000)
def expensive_operation(param: str) -> str:
    # Heavy computation
    return result
```

#### Async Batching

```python
# Good: Batch operations
results = await asyncio.gather(
    fetch_bgp(prefix),
    fetch_irr(prefix),
    fetch_rpki(prefix)
)

# Bad: Sequential
bgp = await fetch_bgp(prefix)
irr = await fetch_irr(prefix)
rpki = await fetch_rpki(prefix)
```

### Frontend Performance

#### Memoization

```javascript
const expensiveCalculation = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
}, [data]);
```

#### Lazy Loading

```javascript
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

function App() {
    return (
        <Suspense fallback={<Loading />}>
            <HeavyComponent />
        </Suspense>
    );
}
```

#### Virtualization

For large lists, use react-window:

```javascript
import { FixedSizeList } from 'react-window';

<FixedSizeList
    height={600}
    itemCount={prefixes.length}
    itemSize={50}
>
    {PrefixRow}
</FixedSizeList>
```

## Additional Resources

- [Python Style Guide (PEP 8)](https://pep8.org/)
- [React Best Practices](https://reactjs.org/docs/thinking-in-react.html)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PostgreSQL Performance](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Testing Best Practices](https://docs.pytest.org/en/stable/goodpractices.html)

## Getting Help

- **Code Issues**: Open GitHub issue
- **Architecture Questions**: Discuss in PR or team chat
- **Performance Problems**: See `PERFORMANCE_OPTIMIZATIONS.md`
- **Security Concerns**: See `SECURITY_WORKFLOW.md`
