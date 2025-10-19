import pytest
import pytest_asyncio
from alembic.command import upgrade as alembic_upgrade
from alembic.config import Config as AlembicConfig
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient
from irrexplorer import settings  # noqa: E402
from irrexplorer.app import app  # noqa: E402
from sqlalchemy_utils import create_database, database_exists, drop_database
from starlette.config import environ

# Must be set FIRST before any imports that use settings
environ["TESTING"] = "TRUE"


@pytest.fixture(autouse=True, scope="session")
def setup_test_database():
    url = str(settings.DATABASE_URL)

    if database_exists(url):  # nosec B101
        raise RuntimeError("Test database already exists. Aborting tests.")
    create_database(url)

    alembic_cfg = AlembicConfig("alembic.ini")
    alembic_upgrade(alembic_cfg, "head")

    yield

    drop_database(url)


@pytest_asyncio.fixture()
async def client():
    # httpx client does not trigger lifespan events on it's own
    # https://github.com/encode/httpx/issues/350
    async with LifespanManager(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as test_client:
            test_client.app = app
            yield test_client
            # Clean up database and cache after each test to ensure test isolation
            from irrexplorer.api import caching
            from irrexplorer.storage import tables

            await test_client.app.state.database.execute(tables.bgp.delete())
            await test_client.app.state.database.execute(tables.rirstats.delete())
            # Clear Redis cache
            caching.clear_cache()
