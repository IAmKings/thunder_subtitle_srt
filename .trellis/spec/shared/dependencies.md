# Dependencies & Versions

> Thunder Subtitle project: FastAPI Python backend + Next.js 16 TypeScript frontend.

---

## Runtime Environment

| Dependency | Version    | Description                          |
| ---------- | ---------- | ------------------------------------ |
| Python     | >=3.10     | Backend runtime                      |
| Node.js    | >=20       | Frontend runtime                     |
| Docker     | node:20-alpine + python3 | Single-image deployment    |

---

## Backend (Python) — `thunder-subtitle-api/`

### Core Framework

| Package              | Version      | Description                          |
| -------------------- | ------------ | ------------------------------------ |
| fastapi              | >=0.115.0    | Async web framework                  |
| uvicorn[standard]   | >=0.30.0     | ASGI server                          |
| pydantic             | >=2.0.0      | Data validation & serialization       |
| pydantic-settings    | >=2.0.0      | Settings from env vars               |

### Authentication

| Package              | Version      | Description                          |
| -------------------- | ------------ | ------------------------------------ |
| python-jose[cryptography] | >=3.3.0 | JWT encoding/decoding               |
| passlib[bcrypt]      | >=1.7.4      | Password hashing                    |

### HTTP & Networking

| Package              | Version      | Description                          |
| -------------------- | ------------ | ------------------------------------ |
| httpx                | >=0.27.0     | Async HTTP client (for CLI calls)    |
| websockets           | >=12.0       | WebSocket server (progress reporting)|
| python-multipart     | >=0.0.9      | File upload support                  |

### Code Quality

| Tool          | Description                          |
| ------------- | ------------------------------------ |
| ruff          | Linter + formatter (Black-compatible)|

---

## Frontend (TypeScript) — `thunder-subtitle-web/`

### Core Framework

| Package              | Version      | Description                          |
| -------------------- | ------------ | ------------------------------------ |
| next                 | 16.2.4       | React framework (App Router)         |
| react                | 19.2.4       | UI library                           |
| react-dom            | 19.2.4       | React DOM renderer                   |
| typescript           | ^5           | TypeScript language                  |

### UI & Styling

| Package              | Version      | Description                          |
| -------------------- | ------------ | ------------------------------------ |
| tailwindcss          | ^4           | Utility-first CSS (v4 config format) |
| @tailwindcss/postcss | ^4           | PostCSS plugin                       |
| lucide-react         | ^1.16.0      | Icon library                         |

### Development Tools

| Package              | Version      | Description                          |
| -------------------- | ------------ | ------------------------------------ |
| eslint               | ^9           | Linter                               |
| eslint-config-next   | 16.2.4       | Next.js ESLint config                |
| @types/node          | ^20          | Node.js type definitions             |
| @types/react         | ^19          | React type definitions               |
| @types/react-dom     | ^19          | React DOM type definitions           |

---

## Architecture Dependencies

### Data Flow

```
Frontend (Next.js 16)
  ├── FastApiClient → HTTP fetch → FastAPI backend
  ├── SubtitleApiClient → Next.js API route proxy → FastAPI backend
  └── ProgressWebSocket → WebSocket → FastAPI /ws/progress/{taskId}
```

### Auth Flow

```
Login form → FastApiClient.login()
  → POST /api/auth/login
  → JWT token received
  → Stored in localStorage
  → Attached as Authorization: Bearer <token> on subsequent requests
```

### Deployment

```
Docker (node:20-alpine + python3)
  └── supervisord
      ├── next start (Next.js production server)
      └── uvicorn (FastAPI ASGI server)
```

---

## Important Notes

1. **Next.js 16**: Uses App Router. Server Components are default; Client Components need `'use client'` directive.
2. **TailwindCSS 4**: Uses the new v4 configuration format (CSS-based `@theme` block, not `tailwind.config.js`).
3. **React 19**: Major version with breaking changes from React 18.
4. **Pydantic v2**: Uses `model_config` instead of `class Config`, `model_validate` instead of `parse_obj`.
5. **snake_case / camelCase**: Backend API responses use snake_case. TypeScript interfaces must match these keys exactly.
6. **WebSocket**: `ProgressWebSocket` connects directly to FastAPI's `/ws/progress/{taskId}` endpoint.
7. **No Zod**: This project uses Pydantic on the backend and plain TypeScript interfaces on the frontend — no Zod for schema validation.

---

## Updating Dependencies

When updating dependencies:

### Backend

```bash
cd thunder-subtitle-api
pip install --upgrade <package>
# Test the application
python -m app.main  # or your test command
```

### Frontend

```bash
cd thunder-subtitle-web
pnpm install  # or npm install
pnpm lint     # verify no lint errors
tsc --noEmit  # verify type compatibility
pnpm build    # verify production build
```

---

## Monorepo Structure

```
thunder_subtitle_srt/
├── thunder-subtitle-api/     # Python FastAPI backend
│   ├── app/
│   │   ├── main.py           # FastAPI app & lifespan
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   ├── api/              # Router modules
│   │   ├── auth/             # JWT auth router
│   │   ├── models/           # Pydantic schemas
│   │   ├── services/         # Service layer (wraps CLI)
│   │   └── ws/               # WebSocket manager
│   └── requirements.txt
├── thunder-subtitle-web/     # Next.js 16 frontend
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # React components
│   │   └── lib/              # api.ts, types.ts, auth.tsx, i18n.ts
│   └── package.json
└── Dockerfile                # Single-image deployment
```