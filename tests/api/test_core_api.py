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


async def test_settings_roundtrip(client):
  response = await client.get("/api/settings")
  assert response.status_code == 200
  settings = response.json()["settings"]
  assert settings["language"] == "zh"

  saved = await client.post("/api/settings", json={"language": "en", "default_market": "US"})
  assert saved.status_code == 200
  assert saved.json()["settings"]["language"] == "en"


async def test_keyword_and_article_crud(client):
  created_keyword = await client.post("/api/db/keywords", json={"keyword": "industrial router"})
  assert created_keyword.status_code == 200
  keyword = created_keyword.json()["item"]

  updated_keyword = await client.put(f"/api/db/keywords/{keyword['id']}", json={
    "keyword": "industrial cellular router",
    "type": keyword["type"],
    "priority": keyword["priority"],
    "status": "planned",
    "notes": "updated",
    "position": "",
    "related_article": "",
  })
  assert updated_keyword.status_code == 200
  assert updated_keyword.json()["item"]["status"] == "planned"

  created_article = await client.post("/api/db/articles", json={"title": "Guide", "content": "Body", "status": "draft", "keyword_ids": [keyword["id"]]})
  assert created_article.status_code == 200
  article = created_article.json()["item"]

  listed = await client.get("/api/db/articles")
  assert listed.status_code == 200
  assert len(listed.json()["items"]) == 1

  deleted = await client.delete(f"/api/db/articles/{article['id']}")
  assert deleted.status_code == 200


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
  assert draft.status_code == 400
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

  await client.post("/api/settings", json={"google_credentials_path": "C:/missing-service-account.json", "indexing_enabled": True})
  indexing = await client.post("/api/indexing/jobs/run", json={"action": "inspect", "site_url": "https://example.com"})
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
