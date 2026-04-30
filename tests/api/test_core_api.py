from pathlib import Path

import pytest

pytestmark = pytest.mark.asyncio


async def test_health_and_readiness(client):
  health = await client.get("/api/health")
  assert health.status_code == 200
  assert health.json()["status"] == "ok"
  assert health.headers["x-request-id"].startswith("req_")

  readiness = await client.get("/api/health/readiness")
  assert readiness.status_code == 200
  assert "readiness" in readiness.json()


async def test_download_metadata_and_file_route(client, tmp_path, monkeypatch):
  from backend.services import downloads

  missing_zip = tmp_path / "missing.zip"
  monkeypatch.setattr(downloads, "RELEASE_ZIP_PATH", missing_zip)

  missing = await client.get("/api/downloads/latest")
  assert missing.status_code == 200
  missing_payload = missing.json()["download"]
  assert missing_payload["available"] is False
  assert missing_payload["filename"] == "SmartKey-portable.zip"
  assert missing_payload["downloadUrl"] == "/downloads/SmartKey-portable.zip"

  missing_file = await client.get("/downloads/SmartKey-portable.zip")
  assert missing_file.status_code == 404
  assert missing_file.json()["error"]["code"] == "download_not_found"

  built_zip = tmp_path / "SmartKey-portable.zip"
  built_zip.write_bytes(b"smartkey portable package")
  monkeypatch.setattr(downloads, "RELEASE_ZIP_PATH", built_zip)

  ready = await client.get("/api/downloads/latest")
  assert ready.status_code == 200
  ready_payload = ready.json()["download"]
  assert ready_payload["available"] is True
  assert ready_payload["sizeBytes"] == built_zip.stat().st_size
  assert ready_payload["updatedAt"]

  downloaded = await client.get("/downloads/SmartKey-portable.zip")
  assert downloaded.status_code == 200
  assert downloaded.content == b"smartkey portable package"
  assert "SmartKey-portable.zip" in downloaded.headers["content-disposition"]


async def test_core_routes_use_local_data_by_default(client):
  for method, path, kwargs in [
    ("get", "/api/settings", {}),
    ("post", "/api/db/keywords", {"json": {"keyword": "industrial router"}}),
    ("get", "/api/db/articles", {}),
    ("post", "/api/workbench/dispatch", {"json": {"prompt": "expand router keywords", "current_route": "/", "language": "en"}}),
  ]:
    response = await getattr(client, method)(path, **kwargs)
    assert response.status_code == 200


async def test_cloud_core_routes_require_login_when_configured(client, monkeypatch):
  from backend.config import get_app_settings

  monkeypatch.setenv("SMARTKEY_CLOUD_ENABLED", "true")
  monkeypatch.setenv("SMARTKEY_DATABASE_URL", "postgresql://user:pass@localhost:5432/smartkey")
  monkeypatch.setenv("SMARTKEY_SUPABASE_JWT_SECRET", "test-secret")
  get_app_settings.cache_clear()

  response = await client.get("/api/settings")
  assert response.status_code == 200

  monkeypatch.delenv("SMARTKEY_CLOUD_ENABLED", raising=False)
  monkeypatch.delenv("SMARTKEY_DATABASE_URL", raising=False)
  monkeypatch.delenv("SMARTKEY_SUPABASE_JWT_SECRET", raising=False)
  get_app_settings.cache_clear()


async def test_geo_writer_and_local_data(client):
  draft = await client.post("/api/geo-writer/draft", json={
    "title": "Fallback title",
    "primary_keyword": "factory router",
    "secondary_keywords": [],
    "audience": "",
    "industry": "",
    "target_market": "",
    "article_type": "",
    "tone": "",
    "target_length": 800,
    "content_language": "en",
    "content_blocks": ["faq"],
  })
  assert draft.status_code in (200, 400)
  if draft.status_code == 400:
    assert draft.json()["error"]["code"] == "configuration_required"

  summary = await client.get("/api/local-data/summary")
  assert summary.status_code == 200
  assert "summary" in summary.json()

  backup = await client.post("/api/local-data/backup")
  assert backup.status_code == 200
  assert Path(backup.json()["path"]).exists()

  exported = await client.get("/api/local-data/export")
  assert exported.status_code == 200
  snapshot = exported.json()["snapshot"]

  imported = await client.post("/api/local-data/import", json={"snapshot": snapshot})
  assert imported.status_code == 200

  reset = await client.post("/api/local-data/reset", json={"mode": "content"})
  assert reset.status_code == 200


async def test_optional_adapters_fail_gracefully(client):
  ai = await client.post("/api/ai/recommend", json={"payload": {"topic": "router"}})
  assert ai.status_code == 400
  assert ai.json()["error"]["code"] == "configuration_required"

  rank = await client.post("/api/rank/jobs/run", json={"keywords": ["industrial router"], "provider": "serpapi"})
  assert rank.status_code == 400
  assert rank.json()["error"]["code"] == "configuration_required"

  indexing = await client.post("/api/indexing/jobs/run", json={"action": "inspect", "site_url": "https://example.com", "credentials_path": "C:/missing-service-account.json"})
  assert indexing.status_code == 400
  assert indexing.json()["error"]["code"] == "configuration_required"


async def test_indexing_prepare_builds_submit_ready_urls(client):
  response = await client.post("/api/indexing/prepare", json={
    "sources": [
      {"filename": "Metadata.csv", "content": "Property,Value\nIssue,Crawled - currently not indexed\n"},
      {"filename": "Table.csv", "content": "URL,Last crawled\nhttps://www.example.com/a,2026-04-01\nhttps://www.example.com/news/tags/router,2026-04-02\nhttps://www.example.com/file.pdf,2026-04-03\nhttps://www.example.com/a,2026-04-04\n"},
    ],
  })
  assert response.status_code == 200
  payload = response.json()
  assert payload["status"] == "prepared"
  assert payload["counts"]["raw"] == 3
  assert payload["counts"]["submit_ready"] == 1
  assert payload["counts"]["excluded"] == 3
  assert payload["submit_ready_urls"] == ["https://www.example.com/a"]
  assert payload["submit_counts_by_issue"]["Crawled - currently not indexed"] == 1
  assert payload["batch_id"]

  batches = await client.get("/api/indexing/prepare-batches")
  assert batches.status_code == 200
  batch_items = batches.json()["items"]
  assert len(batch_items) == 1
  assert batch_items[0]["id"] == payload["batch_id"]

  detail = await client.get(f"/api/indexing/prepare-batches/{payload['batch_id']}")
  assert detail.status_code == 200
  item = detail.json()["item"]
  assert item["submit_ready_urls"] == ["https://www.example.com/a"]
  assert len(item["excluded_urls"]) == 3


async def test_diagnostics_runtime(client):
  response = await client.get("/api/diagnostics/runtime")
  assert response.status_code == 200
  runtime = response.json()["runtime"]
  assert runtime["backend_log_path"].endswith("backend.jsonl")

  frontend_event = await client.post("/api/diagnostics/frontend-event", json={
    "level": "error",
    "event": "frontend.api_error",
    "route": "/api/test",
    "details": {"message": "sample"},
  })
  assert frontend_event.status_code == 200
