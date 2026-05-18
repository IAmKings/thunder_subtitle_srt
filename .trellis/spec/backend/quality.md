# Pre-commit Checklist

Run through this checklist before committing backend code.

## Pydantic Schemas

- [ ] **All request/response models defined in `schemas.py`** — No plain dicts as response types
- [ ] **`response_model` declared on every route** — FastAPI uses it for docs and validation
- [ ] **Mutable defaults use `Field(default_factory=...)`** — Never `[]` or `{}` as default
- [ ] **Update models use `Optional[T] = None`** — For partial updates
- [ ] **Enums inherit from `(str, Enum)`** — For JSON serialization

## Service Layer

- [ ] **Dual-import fallback for CLI modules** — `try: from src.xxx except ImportError: from thunder_subtitle.xxx`
- [ ] **Lazy imports inside methods, not top-level** — CLI modules may not be installed
- [ ] **Resources cleaned up in `finally` block** — Call `client.close()` on CLI clients
- [ ] **Service returns Pydantic models** — Not raw CLI dataclass objects

## Error Handling

- [ ] **`HTTPException` used with proper status codes** — 400/401/404/500/502/504
- [ ] **`HTTPException` re-raised, not re-wrapped** — `except HTTPException: raise`
- [ ] **Domain exceptions converted in route handler** — Service raises `ValueError`/`FileNotFoundError`, route maps to HTTP status
- [ ] **`status` constants used** — `status.HTTP_404_NOT_FOUND` not bare `404`

## Authentication

- [ ] **Protected endpoints verify JWT** — Use `extract_token_from_request` + `verify_access_token`
- [ ] **Auth failures return 401** — Not 403 or 500

## Project Structure

- [ ] **New files follow domain layout** — `app/api/<domain>.py`, `app/services/<domain>_service.py`
- [ ] **Router registered in `main.py`** — With correct prefix and tag
- [ ] **Schemas added to `schemas.py`** — Grouped under domain comment header

## Quick Reference

### Response Model Pattern
```python
@router.get("/search", response_model=SubtitleSearchResponse)
async def search_subtitles(...):
    ...
```

### Dependency Injection Pattern
```python
def get_subtitle_service() -> SubtitleService:
    return SubtitleService()

@router.get("/search")
async def search(service: SubtitleService = Depends(get_subtitle_service)):
    ...
```

### Error Pattern
```python
try:
    result = service.do_something(param)
    return result
except ValueError as e:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
except HTTPException:
    raise
except Exception as e:
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
```