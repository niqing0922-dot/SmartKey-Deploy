import os
import tempfile
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

TMP_ROOT = Path(tempfile.mkdtemp(prefix="smartkey-pytest-"))
os.environ["SMARTKEY_DATA_DIR"] = str(TMP_ROOT / "data")
os.environ["SMARTKEY_BACKUP_DIR"] = str(TMP_ROOT / "backups")
os.environ["SMARTKEY_LOG_DIR"] = str(Path.cwd() / ".artifacts" / "logs")

from backend.main import app  # noqa: E402


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


@pytest.fixture(autouse=True)
def reset_state():
    from backend.db import reset_local_data

    reset_local_data("all")
    yield
