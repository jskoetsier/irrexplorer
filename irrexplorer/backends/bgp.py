import json
import logging
import os
import tempfile
from typing import Iterator, Tuple

import asyncpg
from asgiref.sync import sync_to_async
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
        logger.info("Retrieving BGP data from %s", url)
        text = await retrieve_url_text(url)
        stats = await self._load_prefixes(text)
        logger.info(
            "Loaded %d BGP prefixes into staging from %s (%d filtered out)",
            stats["loaded"],
            url,
            stats["filtered_out"],
        )

    def _parse_table(self, text: str) -> Iterator[Tuple[str, int]]:
        """
        Parse BGP table data line-by-line and yield (prefix, origin) tuples.
        """
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
                yield prefix, origin

    @sync_to_async
    def _write_staging_file(self, text: str):
        total_records = 0
        loaded_records = 0
        tmp = tempfile.NamedTemporaryFile(mode="w+b", delete=False)
        try:
            for line in text.splitlines():
                if not line:
                    continue
                total_records += 1
                try:
                    record = json.loads(line)
                    prefix, origin, hits = (
                        record["CIDR"],
                        record["ASN"],
                        record["Hits"],
                    )
                except (ValueError, KeyError) as ve:
                    raise ImporterError(f"Invalid BGP line: {line}: {ve}")

                if hits < BGP_SOURCE_MINIMUM_HITS:
                    continue

                ip_version = 6 if ":" in prefix else 4
                if not self._include_route(ip_version, prefix):
                    continue

                tmp.write(f"{origin}\t{prefix}\tunknown\n".encode())
                loaded_records += 1

            tmp.flush()
            return {
                "path": tmp.name,
                "loaded": loaded_records,
                "filtered_out": total_records - loaded_records,
            }
        finally:
            tmp.close()

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

    async def _load_prefixes(self, text: str):
        staging_table_name = tables.bgp_staging.name
        live_table_name = tables.bgp.name

        conn = await asyncpg.connect(str(DATABASE_URL))
        try:
            logger.info("Preparing BGP staging table")
            await conn.execute(f"TRUNCATE TABLE {staging_table_name}")
            staging_file = await self._write_staging_file(text)

            if staging_file["loaded"] == 0:
                logger.warning("BGP import produced zero prefixes after filtering")
                return {"loaded": 0, "filtered_out": staging_file["filtered_out"]}

            logger.info(
                "Bulk loading %d BGP routes into staging",
                staging_file["loaded"],
            )
            with open(staging_file["path"], "rb") as f:
                await conn.copy_to_table(
                    staging_table_name,
                    source=f,
                    columns=["asn", "prefix", "rpki_status"],
                    format="csv",
                    delimiter="\t",
                )

            async with conn.transaction():
                logger.info("Swapping staged BGP data into live table")
                await conn.execute(f"LOCK TABLE {live_table_name} IN ACCESS EXCLUSIVE MODE")
                await conn.execute(f"TRUNCATE TABLE {live_table_name}")
                await conn.execute(
                    f"""
                    INSERT INTO {live_table_name} (asn, prefix, rpki_status)
                    SELECT asn, prefix, rpki_status
                    FROM {staging_table_name}
                    """
                )

            logger.info(
                "BGP import complete. RPKI validation data will be populated by separate validator."
            )
            return {
                "loaded": staging_file["loaded"],
                "filtered_out": staging_file["filtered_out"],
            }
        except asyncpg.PostgresError as pe:
            raise ImporterError(f"Failed to load BGP data: {pe}") from pe
        finally:
            staging_path = locals().get("staging_file", {}).get("path")
            if staging_path and os.path.exists(staging_path):
                os.unlink(staging_path)
            await conn.close()


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
