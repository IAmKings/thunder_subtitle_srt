# Error Handling

This document covers error handling patterns for the FastAPI backend.

## HTTP Status Codes

| Status | Code | When to Use |
|--------|------|-------------|
| 400 | `HTTP_400_BAD_REQUEST` | Invalid input, domain validation failure |
| 401 | `HTTP_401_UNAUTHORIZED` | Missing/invalid auth token, bad credentials |
| 404 | `HTTP_404_NOT_FOUND` | Resource not found |
| 500 | `HTTP_500_INTERNAL_SERVER_ERROR` | Unexpected server error |
| 502 | `HTTP_502_BAD_GATEWAY` | Upstream service returned error |
| 504 | `HTTP_504_GATEWAY_TIMEOUT` | Upstream service timeout |

## Route Handler Error Pattern

Route handlers catch domain exceptions and convert to `HTTPException`:

```python
from fastapi import HTTPException, status

@router.get("/search", response_model=SubtitleSearchResponse)
async def search_subtitles(
    name: str = Query(...),
    service: SubtitleService = Depends(get_subtitle_service),
):
    try:
        result = service.search(name=name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {e}",
        )
```

### Key Rules

1. **Never swallow exceptions silently** — always convert to `HTTPException`.
2. **Re-raise `HTTPException`** — don't catch and re-wrap an HTTPException in another:
   ```python
   # WRONG
   except Exception:
       raise HTTPException(status_code=500, detail="Failed")

   # RIGHT — let HTTPException pass through
   except HTTPException:
       raise
   except Exception as e:
       raise HTTPException(status_code=500, detail=str(e))
   ```
3. **Use `status` constants** — `status.HTTP_404_NOT_FOUND` instead of bare `404`.
4. **Include detail message** — `detail=str(e)` for debugging, not just a generic string.

## Service Layer Exceptions

Services raise **Python built-in exceptions** — not `HTTPException`. The route handler is responsible for mapping to HTTP status codes:

| Service Exception | HTTP Status | Example |
|---|---|---|
| `ValueError` | 400 | Invalid duration format |
| `FileNotFoundError` | 404 | movie.nfo not found |
| `httpx.HTTPStatusError` | 502 | Upstream subtitle API error |
| `httpx.RequestError` | 504 | Upstream timeout |

```python
# Service raises domain exception
class ReviewService:
    def get_nfo_info(self, path: str) -> NfoInfoResponse:
        nfo_path = os.path.join(path, "movie.nfo")
        if not os.path.exists(nfo_path):
            raise FileNotFoundError(f"movie.nfo not found in {path}")
        ...

# Route handler maps to HTTP status
@router.get("/nfo", response_model=NfoInfoResponse)
async def get_nfo_info(path: str = Query(...), ...):
    try:
        return service.get_nfo_info(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="movie.nfo not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Proxy Download Error Handling

For endpoints that proxy external resources, map httpx errors:

```python
try:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
except httpx.HTTPStatusError as e:
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Download failed: upstream returned {e.response.status_code}",
    )
except httpx.RequestError as e:
    raise HTTPException(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        detail=f"Download failed: {e}",
    )
```

## Validation Errors

FastAPI automatically handles Pydantic validation errors and returns 422 responses. You don't need to add validation handling for:

- Missing required fields
- Type mismatches
- Validation constraints (`Query(..., min_length=1)`, `Query(..., ge=1)`)

For **domain-level validation** (business rules), raise `ValueError` in the service and catch it in the route handler as a 400.