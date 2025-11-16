# FinTrack Backend (Node.js)

Minimal Express + PostgreSQL backend for Auth with JWT.

## Stack
- Node.js 18+
- Express, pg, bcrypt, jsonwebtoken, dotenv, cors
- PostgreSQL (Neon recommended)

## Environment
- DATABASE_URL: Postgres connection string (e.g. from Neon)
- PGSSL: set to `require` when provider mandates SSL (Neon/Render)
- JWT_SECRET: base64/strong secret for HS256
- JWT_ACCESS_TTL_MIN: default 15
- JWT_REFRESH_TTL_DAYS: default 7
- PORT: default 8080

## Local run
```
npm install
export DATABASE_URL="postgres://user:pass@host:5432/db"
export PGSSL=require
export JWT_SECRET="$(openssl rand -base64 32)"
npm run start
# Health
curl http://localhost:8080/actuator/health
```

## Endpoints
- POST /auth/register { email, password } -> { accessToken, refreshToken }
- POST /auth/login { email, password } -> { accessToken, refreshToken }
- POST /auth/refresh { refreshToken } -> { accessToken }
- GET /actuator/health -> { status: "UP" }

## Deploy to Render
1) Push this folder to GitHub (as repo root or subfolder; if subfolder, select it on Render).
2) Render → New → Web Service → Connect repo.
3) Runtime: Node; Build Command: `npm install`; Start Command: `npm start`.
4) Environment → add variables:
   - DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB
   - PGSSL=require
   - JWT_SECRET=<base64 random>
   - NODE_ENV=production
5) Deploy. Copy public URL like `https://fintrack-api.onrender.com/`.

## Android BASE_URL
- Use the Render URL with a trailing `/`.

## Notes
- On first start, the server creates table `users` if not exists.
- Passwords stored as BCrypt hashes.
