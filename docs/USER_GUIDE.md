# IRRExplorer User Guide

This guide provides instructions for end users on how to use IRRExplorer effectively.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Queries](#basic-queries)
3. [Understanding Results](#understanding-results)
4. [External Data Sources](#external-data-sources)
5. [Analysis Tools](#analysis-tools)
6. [Advanced Search](#advanced-search)
7. [Export Options](#export-options)
8. [Tips & Best Practices](#tips--best-practices)

## Getting Started

IRRExplorer is a web-based tool for exploring and analyzing routing data from BGP, IRR, and RPKI sources.

### Accessing IRRExplorer

Navigate to your IRRExplorer instance URL (e.g., `https://irrexplorer.yourdomain.com`)

### Main Interface

The home page features:
- **Search Bar** - Enter prefixes, ASNs, or AS-SETs
- **Popular Queries** - Quick access to commonly searched items
- **Search History** - Your recent queries
- **Visualizations** - Data insights and charts

## Basic Queries

### Prefix Queries

Search for IP prefixes to see routing information:

```
192.0.2.0/24
2001:db8::/32
```

Results show:
- BGP routes and origins
- IRR records
- RPKI validation status
- Overlapping prefixes

### ASN Queries

Search for Autonomous System Numbers:

```
AS13335
13335
```

Results show:
- Announced prefixes
- IRR objects
- AS-SET memberships
- Peering information (via external sources)

### AS-SET Queries

Search for AS-SETs to see member networks:

```
AS-CLOUDFLARE
AS-HURRICANE
```

Results show:
- Member ASNs
- Expanded AS-SET hierarchy
- IRR source information

## Understanding Results

### Status Icons

- ✅ **Green** - No issues detected
- ⚠️ **Yellow** - Warnings (informational)
- ❌ **Red** - Errors or conflicts

### RPKI Validation

- **Valid** - Route matches ROA
- **Invalid** - Route conflicts with ROA
- **NotFound** - No ROA exists
- **Unknown** - Cannot determine status

### IRR Status

- **Match** - BGP and IRR agree
- **Mismatch** - BGP and IRR differ
- **Missing** - No IRR record found

## External Data Sources

Click the **"External Data Sources"** button on query result pages to access:

### BGP Looking Glass

- Real-time BGP routing table information
- AS path details
- BGP communities
- Routing metrics (MED, LOCAL_PREF)

**Data from**: NLNOG Ring + RIPE Stat

### RDAP

- IP address registration data
- ASN registration details
- Domain registration information
- Contact information and entities

**Data from**: ARIN, RIPE, APNIC, LACNIC, AFRINIC

### PeeringDB

- Network peering policies
- Data center locations  
- Internet Exchange connections
- Contact information

**Data from**: PeeringDB API

## Analysis Tools

### RPKI Dashboard

View comprehensive RPKI validation statistics:
- Validation status distribution
- Coverage by RIR
- Trends over time

### Hijack Detection

Identify potential BGP hijacking:
- Origin mismatches
- Suspicious announcements
- RPKI invalid routes

### Prefix Overlap

Find overlapping or conflicting prefixes:
- More-specific overlaps
- Less-specific overlaps
- Exact matches

### IRR Consistency

Compare IRR and BGP data:
- Missing IRR records
- Stale IRR objects
- Consistency scores

## Advanced Search

Use filters to narrow search results:

- **RIR Filter** - ARIN, RIPE, APNIC, LACNIC, AFRINIC
- **RPKI Status** - Valid, Invalid, NotFound
- **IRR Source** - RIPE, ARIN, RADB, etc.
- **Date Range** - Filter by time period

## Export Options

Export data in multiple formats:

### CSV Export
- Spreadsheet-compatible format
- Good for data analysis

### JSON Export  
- Machine-readable format
- Good for automation/scripts

### PDF Reports
- Human-readable format
- Good for documentation

## Tips & Best Practices

### Performance

- Use specific queries when possible (e.g., `/24` instead of `/16`)
- Check "Popular Queries" for common searches
- Results are cached for faster subsequent queries

### Accuracy

- Data is updated every 4 hours
- External sources may have different update frequencies
- Compare multiple data sources for verification

### Troubleshooting

**No results found:**
- Verify prefix/ASN format
- Check if resource is allocated
- Try related queries (parent prefix, etc.)

**Slow queries:**
- Large prefixes may take longer
- External data sources may timeout
- Check your network connection

**Conflicting data:**
- Compare BGP, IRR, and RPKI sources
- Check RDAP for authoritative data
- Review "Last Updated" timestamps

## Getting Help

- **Documentation**: Check README.md and other docs
- **API Documentation**: `/api/docs` endpoint
- **Issues**: Report bugs on GitHub
- **Community**: Join discussions on project forums

## Keyboard Shortcuts

- `Esc` - Close modals
- `/` - Focus search bar
- `Enter` - Submit search

## Privacy & Data Usage

- Search queries are logged for analytics
- No personal information is collected
- External API calls follow their respective privacy policies

---

For technical documentation, see:
- [INSTALLATION.md](../INSTALLATION.md) - Installation guide
- [DATA_SOURCES.md](../DATA_SOURCES.md) - External data sources API
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development guide
