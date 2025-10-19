"""
OpenAPI/Swagger documentation configuration for IRRExplorer API.
"""

OPENAPI_SCHEMA = {
    "openapi": "3.0.0",
    "info": {
        "title": "IRRExplorer API",
        "version": "1.10.0",
        "description": "IRRExplorer API provides access to Internet Routing Registry data, BGP information, and comprehensive routing analytics.",
        "contact": {
            "name": "IRRExplorer Support",
            "url": "https://irrexplorer.nlnog.net",
        },
    },
    "servers": [{"url": "/api", "description": "API Server"}],
    "paths": {
        "/metadata/": {
            "get": {
                "summary": "Get API Metadata",
                "description": "Returns metadata about available RIRs, data sources, and last update timestamps",
                "responses": {
                    "200": {
                        "description": "Successful response",
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    }
                },
            }
        },
        "/prefixes/asn/{asn}": {
            "get": {
                "summary": "Get Prefixes for ASN",
                "description": "Returns all prefixes announced by a specific AS number",
                "parameters": [
                    {
                        "name": "asn",
                        "in": "path",
                        "required": True,
                        "description": "Autonomous System Number (with or without AS prefix)",
                        "schema": {"type": "string", "example": "AS13335"},
                    }
                ],
                "responses": {
                    "200": {
                        "description": "List of prefixes",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "asn": {"type": "string"},
                                        "prefixes": {"type": "array"},
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
        "/prefixes/prefix/{prefix}": {
            "get": {
                "summary": "Get Information for Prefix",
                "description": "Returns BGP and IRR information for a specific prefix",
                "parameters": [
                    {
                        "name": "prefix",
                        "in": "path",
                        "required": True,
                        "description": "IP prefix in CIDR notation",
                        "schema": {"type": "string", "example": "1.1.1.0/24"},
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Prefix information",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "prefix": {"type": "string"},
                                        "bgp_origins": {"type": "array"},
                                        "irr_routes": {"type": "array"},
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
        "/sets/expand/{target}": {
            "get": {
                "summary": "Expand AS-SET or ROUTE-SET",
                "description": "Recursively expands an AS-SET or ROUTE-SET to show all members",
                "parameters": [
                    {
                        "name": "target",
                        "in": "path",
                        "required": True,
                        "description": "AS-SET or ROUTE-SET name",
                        "schema": {"type": "string", "example": "AS-CLOUDFLARE"},
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Expanded set members",
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    }
                },
            }
        },
        "/export/csv": {
            "post": {
                "summary": "Export Query Results to CSV",
                "description": "Exports query results in CSV format",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "Query string (prefix, ASN, or set name)",
                                    },
                                    "type": {
                                        "type": "string",
                                        "enum": ["auto", "prefix", "asn", "set"],
                                        "default": "auto",
                                    },
                                },
                                "required": ["query"],
                            }
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "CSV file download",
                        "content": {
                            "text/csv": {
                                "schema": {"type": "string", "format": "binary"}
                            }
                        },
                    }
                },
            }
        },
        "/export/json": {
            "post": {
                "summary": "Export Query Results to JSON",
                "description": "Exports query results in JSON format with metadata",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "Query string (prefix, ASN, or set name)",
                                    },
                                    "type": {
                                        "type": "string",
                                        "enum": ["auto", "prefix", "asn", "set"],
                                        "default": "auto",
                                    },
                                },
                                "required": ["query"],
                            }
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "JSON file download",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "query": {"type": "string"},
                                        "query_type": {"type": "string"},
                                        "timestamp": {"type": "string"},
                                        "results": {"type": "object"},
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
        "/bulk-query": {
            "post": {
                "summary": "Execute Bulk Queries",
                "description": "Execute multiple queries in a single request (max 100 queries)",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "queries": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "query": {"type": "string"},
                                                "type": {
                                                    "type": "string",
                                                    "enum": [
                                                        "auto",
                                                        "prefix",
                                                        "asn",
                                                        "set",
                                                    ],
                                                },
                                            },
                                        },
                                        "maxItems": 100,
                                    }
                                },
                                "required": ["queries"],
                            }
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Bulk query results",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "timestamp": {"type": "string"},
                                        "total_queries": {"type": "integer"},
                                        "results": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "query": {"type": "string"},
                                                    "type": {"type": "string"},
                                                    "success": {"type": "boolean"},
                                                    "data": {"type": "object"},
                                                    "error": {"type": "string"},
                                                },
                                            },
                                        },
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
        "/viz/prefix-allocation": {
            "get": {
                "summary": "Get Prefix Allocation Data",
                "description": "Returns aggregated prefix allocations by RIR and ASN for visualization",
                "responses": {
                    "200": {
                        "description": "Prefix allocation statistics",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "rir_allocations": {"type": "array"},
                                        "top_asns": {"type": "array"},
                                        "timestamp": {"type": "string"},
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
        "/viz/asn-relationships/{asn}": {
            "get": {
                "summary": "Get ASN Relationship Graph Data",
                "description": "Returns nodes and edges for visualizing ASN relationships",
                "parameters": [
                    {
                        "name": "asn",
                        "in": "path",
                        "required": True,
                        "description": "Autonomous System Number",
                        "schema": {"type": "integer"},
                    }
                ],
                "responses": {
                    "200": {
                        "description": "ASN relationship graph data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "nodes": {"type": "array"},
                                        "edges": {"type": "array"},
                                        "timestamp": {"type": "string"},
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
        "/viz/timeline": {
            "get": {
                "summary": "Get Historical Timeline Data",
                "description": "Returns time-series data of query activity",
                "parameters": [
                    {
                        "name": "days",
                        "in": "query",
                        "required": False,
                        "description": "Number of days to include (1-90)",
                        "schema": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 90,
                            "default": 30,
                        },
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Timeline data",
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    }
                },
            }
        },
        "/viz/rir-distribution": {
            "get": {
                "summary": "Get RIR Distribution Data",
                "description": "Returns geographical RIR distribution statistics",
                "responses": {
                    "200": {
                        "description": "RIR distribution data",
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    }
                },
            }
        },
    },
}


async def openapi_schema(request):
    """Return OpenAPI schema."""
    from starlette.responses import JSONResponse

    return JSONResponse(OPENAPI_SCHEMA)


async def swagger_ui(request):
    """Return Swagger UI HTML page."""
    from starlette.responses import HTMLResponse

    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>IRRExplorer API Documentation</title>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui.css">
        <style>
            body {
                margin: 0;
                padding: 0;
            }
        </style>
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-standalone-preset.js"></script>
        <script>
            window.onload = function() {
                window.ui = SwaggerUIBundle({
                    url: '/api/docs/openapi.json',
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIStandalonePreset
                    ],
                    plugins: [
                        SwaggerUIBundle.plugins.DownloadUrl
                    ],
                    layout: "StandaloneLayout"
                })
            }
        </script>
    </body>
    </html>
    """

    return HTMLResponse(content=html)
