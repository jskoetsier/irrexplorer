import json
import logging
from typing import List, Tuple

from asgiref.sync import sync_to_async
from asyncpg import DataError
from databases import Database

from irrexplorer.backends.common import (
    MAX_QUERY_RESULTS,
    LocalSQLQueryBase,
    retrieve_url_text,
)
from irrexplorer.exceptions import ImporterError
from irrexplorer.settings import (
    BGP_IPV4_LENGTH_CUTOFF,
    BGP_IPV6_LENGTH_CUTOFF,
    BGP_SOURCE,
    BGP_SOURCE_MINIMUM_HITS,
    DATABASE_URL,
)
from irrexplorer.state import DataSource, RouteInfo
from irrexplorer.storage import tables

logger = logging.getLogger(__name__)


class BGPImporter:
    """
    BGP origin importer.
    Retrieves origin data from BGP_SOURCE, parses it, and loads it into the SQL db.
    """

    async def run_import(self):
        url = BGP_SOURCE
        text = await retrieve_url_text(url)
        # Parse table and collect prefixes
        prefixes = await self._parse_table(text)
        await self._load_prefixes(prefixes)

    @sync_to_async
    def _parse_table(self, text: str):
        """
        Parse BGP table data line-by-line for memory efficiency.
        Returns a list of (prefix, origin) tuples.
        """
        prefixes = []
        for line in text.splitlines():
            if not line:
                continue
            try:
                record = json.loads(line)
                prefix, origin, hits = record["CIDR"], record["ASN"], record["Hits"]
            except (ValueError, KeyError) as ve:
                raise ImporterError(f"Invalid BGP line: {line}: {ve}")

            if hits < BGP_SOURCE_MINIMUM_HITS:
                continue

            ip_version = 6 if ":" in prefix else 4
            if self._include_route(ip_version, prefix):
                prefixes.append((prefix, origin))
        return prefixes

    def _include_route(self, ip_version: int, prefix: str) -> bool:
        # Filter out router to router links and other tiny blocks
        # Uses text parsing for performance
        try:
            length = int(prefix.split("/")[1])
        except IndexError as ve:
            raise ImporterError(f"Invalid BGP prefix: {prefix}: {ve}")
        return length < BGP_IPV4_LENGTH_CUTOFF or (
            ip_version == 6 and length < BGP_IPV6_LENGTH_CUTOFF
        )

    async def _load_prefixes(self, prefixes: List[Tuple[str, int]]):
        async with Database(DATABASE_URL) as database:
            async with database.transaction():
                await database.execute(tables.bgp.delete())
                if prefixes:
                    for chunk in chunks(prefixes, 5000):
                        values = [
                            {
                                "asn": asn,
                                "prefix": prefix,
                            }
                            for prefix, asn in chunk
                        ]
                        try:
                            await database.execute_many(
                                query=tables.bgp.insert(), values=values
                            )
                        except DataError as de:
                            raise ImporterError(f"Failed to insert BGP data: {de}")


class BGPQuery(LocalSQLQueryBase):
    source = DataSource.BGP
    table = tables.bgp
    prefix_info_field = "asn"

    async def query_asn(self, asn: int):
        results = []
        query = self.table.select().where(self.table.c.asn == asn)

        count = 0
        async for row in self.database.iterate(query=query):
            if count >= MAX_QUERY_RESULTS:
                logger.warning(
                    f"ASN query limit {MAX_QUERY_RESULTS} reached for AS{asn}"
                )
                break
            results.append(
                RouteInfo(
                    source=self.source,
                    prefix=row["prefix"],
                    asn=row["asn"],
                )
            )
            count += 1
        return results


def chunks(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i : i + n]
