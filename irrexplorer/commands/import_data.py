import asyncio
import logging
from datetime import datetime, timezone

from irrexplorer.backends.bgp import BGPImporter
from irrexplorer.backends.metadata import update_last_data_import
from irrexplorer.backends.registro import RegistroRirImporter
from irrexplorer.backends.rirstats import RIRStatsImporter
from irrexplorer.state import RIR

logger = logging.getLogger(__name__)


async def main():
    """
    Run an import for all backends with local data.
    All imports are run "simultaneously" (one CPU, but async)
    """
    import_time = datetime.now(tz=timezone.utc)
    logger.info("Starting data import at %s", import_time.isoformat())
    tasks = []
    for rir in RIR:
        if rir == RIR.REGISTROBR:
            logger.info("Queueing Registro.br import")
            tasks.append(RegistroRirImporter().run_import())
        else:
            logger.info("Queueing RIR stats import for %s", rir.value)
            tasks.append(RIRStatsImporter(rir).run_import())
    logger.info("Queueing BGP import from configured source")
    tasks.append(BGPImporter().run_import())
    await asyncio.gather(*tasks)
    await update_last_data_import(import_time)
    logger.info("Data import completed successfully at %s", import_time.isoformat())


if __name__ == "__main__":
    asyncio.run(main())
