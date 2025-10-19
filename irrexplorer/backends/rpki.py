import asyncio
import logging
from typing import Any, List

import aiohttp
from databases import Database

from irrexplorer.settings import DATABASE_URL

logger = logging.getLogger(__name__)


class RPKIValidator:
    """
    RPKI validator using Cloudflare's RPKI validation API.
    Updates rpki_status field in bgp table based on ROA validation.
    """

    CLOUDFLARE_API = "https://rpki.cloudflare.com/api/v1/origin/{asn}/{prefix}"
    BATCH_SIZE = 100
    MAX_CONCURRENT = 10

    async def run_validation(self):
        """Run RPKI validation on all BGP routes."""
        logger.info("Starting RPKI validation...")

        async with Database(DATABASE_URL) as database:
            # Get all unique prefix-asn combinations
            query = "SELECT DISTINCT prefix::text, asn FROM bgp ORDER BY prefix"
            routes = await database.fetch_all(query)

            total = len(routes)
            logger.info(f"Validating {total} BGP routes...")

            # Process in batches to avoid overwhelming the API
            for i in range(0, total, self.BATCH_SIZE):
                batch = routes[i:i + self.BATCH_SIZE]
                await self._validate_batch(database, batch)

                if (i + self.BATCH_SIZE) % 1000 == 0:
                    logger.info(f"Validated {min(i + self.BATCH_SIZE, total)}/{total} routes...")

            logger.info("RPKI validation complete!")

            # Log summary
            summary_query = """
                SELECT
                    rpki_status,
                    COUNT(*) as count
                FROM bgp
                GROUP BY rpki_status
            """
            summary = await database.fetch_all(summary_query)
            for row in summary:
                logger.info(f"  {row['rpki_status']}: {row['count']}")

    async def _validate_batch(self, database: Database, batch: List[Any]):
        """Validate a batch of routes concurrently."""
        semaphore = asyncio.Semaphore(self.MAX_CONCURRENT)

        async def validate_route(route: Any):
            async with semaphore:
                prefix = str(route[0]) if isinstance(route, tuple) else route["prefix"]
                asn = int(route[1]) if isinstance(route, tuple) else route["asn"]
                status = await self._validate_route(asn, prefix)
                if status:
                    # Update the database
                    update_query = """
                        UPDATE bgp
                        SET rpki_status = :status
                        WHERE prefix = :prefix::inet AND asn = :asn
                    """
                    await database.execute(
                        update_query,
                        {"status": status, "prefix": prefix, "asn": asn}
                    )

        tasks = [validate_route(row) for row in batch]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _validate_route(self, asn: int, prefix: str) -> str:
        """
        Validate a single route using Cloudflare RPKI API.
        Returns: 'valid', 'invalid', 'not_found', or 'unknown'
        """
        url = self.CLOUDFLARE_API.format(asn=asn, prefix=prefix)

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()

                        # Cloudflare API returns {"status": "Valid"|"Invalid"|"NotFound"}
                        status = data.get("status", "").lower()

                        if status == "valid":
                            return "valid"
                        elif status == "invalid":
                            return "invalid"
                        elif status == "notfound":
                            return "not_found"
                        else:
                            return "unknown"
                    else:
                        logger.warning(f"API returned status {response.status} for AS{asn} {prefix}")
                        return "unknown"

        except asyncio.TimeoutError:
            logger.debug(f"Timeout validating AS{asn} {prefix}")
            return "unknown"
        except Exception as e:
            logger.debug(f"Error validating AS{asn} {prefix}: {e}")
            return "unknown"


async def main():
    """Run RPKI validation."""
    validator = RPKIValidator()
    await validator.run_validation()


if __name__ == "__main__":
    asyncio.run(main())
