# Backend Code Review (Python/FastAPI/CLI)

Scanned 38 Python source files across `thunder-subtitle-api/app/`, `thunder-subtitle-py/src/`, `thunder-subtitle-py/commands/`.

## Finding Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 8 |
| MEDIUM | 10 |
| LOW | 10 |

---

## CRITICAL

### C1. Path traversal in `/api/media/image`
- `app/api/media.py:46-68` — `path` query param used directly with `Image.open()` without validation
- Fix: Add `_validate_subtitle_path()` or `os.path.realpath()` check

### C2. Path traversal in `/api/review/subtitle/file`
- `app/api/review.py:135-158` — Unlike other review endpoints, this one skips `_validate_subtitle_path()`
- Fix: Add path validation before `service.review_subtitle_file()`

### C3. SSRF in `/api/subtitle/download`
- `app/api/subtitle.py:91-140` — User-controlled `url` passed to `httpx.get()` without allowlist/validation
- Impact: Internal network scanning, access to internal services

### C4. Plaintext password storage
- `config.py:35,74-80` — Admin password stored as plaintext in `~/.thunder-subtitle.json`
- `passlib[bcrypt]` declared in requirements but NEVER imported/used
- Fix: Actually use bcrypt for password hashing

### C5. Dead dependency: `passlib` never used
- `requirements.txt:4`, `pyproject.toml:15` — Listed but zero imports
- Creates false sense of password security
- Fix: Either remove or use it for C4

---

## HIGH

- H1: Shared `httpx.AsyncClient` never closed on shutdown (`subtitle.py:22-33`)
- H2: WebSocket `broadcast` silently drops dead connections (`ws/manager.py:54-64`)
- H3: Module-level `_rate_last` global shared across threads (`_parallel.py:208-219`)
- H4: Double-checked locking pattern lacks lifecycle management (`subtitle.py:26-33`)
- H5: `ScanService._tasks` class-level dict no lock (`scan_service.py:38-39`)
- H6: Content-Disposition header injection risk (`subtitle.py:127`)
- H7: Stack trace leaked in health check error response (`health_check.py:49`)
- H8: No `base_dir` validation in health-check/review endpoints

## MEDIUM

- M1: Default credentials + JWT secret hardcoded in source (`config.py:19-21`)
- M2: Config parse error silently swallowed (`config.py:53-60`)
- M3: JWT no refresh/revocation mechanism (24h token, no blacklist)
- M4: `asyncio.to_thread` uses unbounded default thread pool
- M5: CORS allows all methods and headers
- M6: `ConfigService` instantiated per request (no caching)
- M7: `_ZH_PREFIX` constant duplicated in two files
- M8: `asyncio.sleep(0.2)` magic number hack in scan loop
- M9: Config in-memory mutation before file write
- M10: **Pillow missing from dependencies** — imported in `media.py` but not in `requirements.txt`

## LOW

- L1-L5: Minor code quality issues (file open patterns, config error handling)
- L6-L10: CLI improvements (timeout params, path validation, import error messages)

## Test Coverage

| Package | Tests |
|---------|-------|
| thunder-subtitle-py (CLI) | ~30% |
| thunder-subtitle-api (FastAPI) | **0%** |

The FastAPI backend has zero automated tests.
