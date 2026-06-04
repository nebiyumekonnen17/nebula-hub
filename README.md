# Nebula-Hub

Nebula-Hub is a premium AWS learning command center built with Vite, React,
TypeScript, Tailwind CSS v4, Supabase, React Router, Framer Motion, and
lucide-react.

## Local setup

1. Install dependencies with `npm.cmd install`.
2. Copy `.env.example` to `.env`.
3. Add the frontend Supabase values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY` is optional for local AI enrichment.
   - `VITE_ADZUNA_APP_ID` and `VITE_ADZUNA_APP_KEY` are optional for local
     Career OS live job listings.
   - `VITE_ADZUNA_COUNTRY` defaults to `us`.
4. Run `npm.cmd run dev` and open the local Vite URL.

## Data safety

The app is designed for read-only access to:

- `public.aws_services`
- `public.aws_quiz_questions`

Do not add migrations or backend writes from this frontend.

## GitHub Pages

The Vite base path is `/nebula-hub/`, so the intended Pages URL is:

`https://<username>.github.io/nebula-hub/`

Repository secrets can provide the public frontend env values during the Pages
build. Avoid exposing Gemini in production unless the key has been rotated and
restricted for browser use.

Adzuna live listings use a local Vite proxy during development. GitHub Pages is
static, so production live listings require a separate serverless proxy configured
with `VITE_ADZUNA_PROXY_URL`; otherwise Career OS falls back to smart search
cards without exposing Adzuna keys.

## Media notes

The interface uses remote free-media references plus deterministic CSS fallbacks.
Pexels and Unsplash assets are intended to stay representational and avoid
logos, recognizable people, or implied AWS endorsement.
