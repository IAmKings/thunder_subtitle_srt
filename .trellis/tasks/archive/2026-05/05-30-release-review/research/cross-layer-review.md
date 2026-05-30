# Cross-Layer + Deployment + Security Review

Scoped across Docker, Nginx, WebSocket, Pydantic↔TypeScript alignment, and dependencies.

## Finding Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 2 |
| MEDIUM | 8 |
| LOW | 4 |

---

## CRITICAL

### CRIT-1: Legacy `SubtitleApiClient` broken in Docker
- `ThunderSubtitleApp.tsx:40` calls `/api/subtitle?name=...` → Nginx routes to FastAPI → 404 (no such endpoint)
- Fix: Migrate to `fastApiClient.searchSubtitles()` or remove legacy client

### CRIT-2: `python-jose` unmaintained, known CVEs
- `requirements.txt:3` — Last release 2021
- Fix: Migrate to `PyJWT>=2.9.0`

### CRIT-3: Default credentials/JWT secret hardcoded
- `config.py:19-20`, `docker-compose.yml:13-15`
- Fix: Fail startup if defaults unchanged in production

---

## HIGH

- H1: Login endpoint no rate limiting (brute force) — `auth/router.py:62-76`
- H2: `review_service.py` uses direct import instead of `cli_import()` — inconsistent with project pattern
- H3: `ScanService._tasks` thread-safety — shared dict without locks

## MEDIUM

- M1: WebSocket ping intervals asymmetric (back 20s / front 15s, not standard ping/pong)
- M2: Nginx WebSocket missing `proxy_buffering off` — data corruption risk under load
- M3: SSL server block missing security headers (HSTS, X-Frame-Options, etc.)
- M4: API proxy missing `proxy_read_timeout` — 60s default too short for scans
- M5: CORS origins hardcoded to localhost only
- M6: `passlib` dependency unmaintained (same as backend M10)
- M7: Docker SSL port mapping non-standard (`3443:443`)
- M8: `.env.local` committed to repo (security smell)
- M9: Xunlei API URL hardcoded in Next.js route handler
- M10: Health-check endpoint requires auth (Docker HEALTHCHECK concern)

## LOW

- L1: Dockerfile `EXPOSE` only 3000, not 443
- L2: `GET /api/auth/verify` unused by frontend
- L3: `ReviewItem.preferred` type mismatch (Python `bool=False` vs TS `boolean?`)
- L4: `ScanResultItem.status` type mismatch (Python `str` vs TS union)
