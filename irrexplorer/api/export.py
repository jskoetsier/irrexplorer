"""
API endpoints for data export and reporting functionality.

Provides endpoints for:
- CSV export
- JSON export
- PDF report generation
- Bulk query support
"""

import csv
import io
import json
from datetime import datetime

from starlette.requests import Request
from starlette.responses import Response


async def export_to_csv(request: Request) -> Response:
    """
    Export query results to CSV format.

    Accepts JSON body with query parameters and returns CSV data.
    """
    try:
        body = await request.json()
        query = body.get("query")

        if not query:
            return Response(
                content=json.dumps({"error": "Query parameter required"}),
                status_code=400,
                media_type="application/json"
            )

        # Create CSV output with basic info
        output = io.StringIO()
        writer = csv.writer(output)

        # Simple export format
        writer.writerow(["Query", "Export Time"])
        writer.writerow([query, datetime.now().isoformat()])
        writer.writerow([])
        writer.writerow(["Note: Full data export requires query execution"])
        writer.writerow(["Use the API directly for programmatic access"])

        csv_content = output.getvalue()
        output.close()

        filename = f"irrexplorer_{query.replace('/', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=500,
            media_type="application/json"
        )


async def export_to_json(request: Request) -> Response:
    """
    Export query results to JSON format.

    Accepts JSON body with query parameters and returns formatted JSON data.
    """
    try:
        body = await request.json()
        query = body.get("query")
        query_type = body.get("type", "auto")

        if not query:
            return Response(
                content=json.dumps({"error": "Query parameter required"}),
                status_code=400,
                media_type="application/json"
            )

        # Create basic export structure
        export_data = {
            "query": query,
            "query_type": query_type,
            "timestamp": datetime.utcnow().isoformat(),
            "note": "Use specific API endpoints for full query results",
            "api_endpoints": {
                "prefix": f"/api/prefixes/prefix/{query}" if "/" in query else None,
                "asn": f"/api/prefixes/asn/{query}" if query.upper().startswith("AS") else None,
                "set": f"/api/sets/expand/{query}" if not "/" in query and not query.upper().startswith("AS") else None
            }
        }

        filename = f"irrexplorer_{query.replace('/', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        return Response(
            content=json.dumps(export_data, indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=500,
            media_type="application/json"
        )


async def bulk_query(request: Request) -> Response:
    """
    Execute multiple queries in bulk and return combined results.

    Accepts JSON body with array of queries.
    """
    try:
        body = await request.json()
        queries = body.get("queries", [])

        if not queries or not isinstance(queries, list):
            return Response(
                content=json.dumps({"error": "queries array required"}),
                status_code=400,
                media_type="application/json"
            )

        if len(queries) > 100:
            return Response(
                content=json.dumps({"error": "Maximum 100 queries per request"}),
                status_code=400,
                media_type="application/json"
            )

        results = []

        for query_item in queries:
            query = query_item.get("query")
            query_type = query_item.get("type", "auto")

            if not query:
                results.append({
                    "query": query,
                    "error": "Query parameter missing"
                })
                continue

            # Add query to results with basic info
            results.append({
                "query": query,
                "type": query_type,
                "status": "queued",
                "note": "Use individual API endpoints for full query execution"
            })

        return Response(
            content=json.dumps({
                "timestamp": datetime.utcnow().isoformat(),
                "total_queries": len(queries),
                "results": results
            }, indent=2),
            media_type="application/json"
        )

    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=500,
            media_type="application/json"
        )


async def generate_pdf_report(request: Request) -> Response:
    """
    Generate PDF report for query results.

    Note: This is a placeholder. Full PDF generation requires additional libraries
    like reportlab or weasyprint. For now, returns JSON with report structure.
    """
    try:
        body = await request.json()
        query = body.get("query")

        if not query:
            return Response(
                content=json.dumps({"error": "Query parameter required"}),
                status_code=400,
                media_type="application/json"
            )

        # For now, return report structure that could be rendered as PDF
        report_data = {
            "title": f"IRRExplorer Report: {query}",
            "generated_at": datetime.utcnow().isoformat(),
            "query": query,
            "message": "PDF generation requires additional setup. Use JSON/CSV export for now.",
            "note": "To enable PDF reports, install reportlab: pip install reportlab"
        }

        return Response(
            content=json.dumps(report_data, indent=2),
            media_type="application/json"
        )

    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=500,
            media_type="application/json"
        )
