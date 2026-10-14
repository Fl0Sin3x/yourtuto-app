<p align="center">
  <img src="frontend/public/Yourtuto.svg" alt="YourTuto logo" height="96">
</p>

<h1 align="center">YourTuto</h1>

<p align="center">
  <strong>All the best tutorials in one place: dev, AI, DIY and cooking, aggregated, curated and tracked.</strong><br>
  Symfony 7.4 · API Platform 4 · React 19 · TypeScript · Tailwind CSS 4 · FrankenPHP
</p>

<p align="center">
  <a href="https://github.com/Fl0Sin3x/yourtuto-app/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Fl0Sin3x/yourtuto-app/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-violet.svg"></a>
  <img alt="PHP" src="https://img.shields.io/badge/PHP-8.4-777BB4?logo=php&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
</p>

---

## Pitch

Learning content is scattered across YouTube, Dev.to, Reddit, blogs and recipe sites. **YourTuto** brings it together in a single, clean feed. You can search it in real time, save favorites, track your progress and rate what you follow. It also has community-written tutorials and an admin dashboard to keep everything curated.

> **Live demo:** [yourtuto-preprod.up.railway.app](https://yourtuto-preprod.up.railway.app)

## Screenshots

| Home | Tutorial | Recipe |
|------|----------|--------|
| ![Home](docs/screenshots/home.jpg) | ![Tutorial detail](docs/screenshots/tutorial.jpg) | ![Recipe](docs/screenshots/recipe.jpg) |

| Category page | Admin login |
|---------------|-------------|
| ![Category](docs/screenshots/category.jpg) | ![Admin](docs/screenshots/admin.jpg) |

## Features

- **Multi-source aggregation**: YouTube, Dev.to, Reddit, Medium, Instructables, TheMealDB and Spoonacular, normalised into one `Tutorial` model.
- **Diverse home feed** that mixes sources and categories, plus category pages.
- **Live search** with query translation (FR ⇄ EN) and recommendations.
- **In-app readers** for Dev.to articles, Reddit posts, YouTube videos and recipes (ingredients and step-by-step).
- **Community tutorials**: Markdown editor to create and edit your own tutorials.
- **Accounts**: email/password with JWT, Google and GitHub OAuth, password reset by email, avatars and public profiles.
- **TL;DR summaries**: AI summary cached in DB when enabled, free extractive outline otherwise.
- **Learning paths**: curated, ordered sequences of tutorials with per-user progress and a "continue" CTA (`/paths`).
- **Engagement**: favorites, progress tracking, star ratings, recipe reviews and comments.
- **Admin dashboard** (EasyAdmin 5) with KPI cards, top tutorials, a source breakdown and recent comments.
- **AI-assisted content**: console commands to generate and enrich tutorials with the Anthropic API.
- **Curated seed data**: about 150 dev/AI tutorials and about 270 recipes.

## Stack

| Layer | Tech |
|-------|------|
| Backend | PHP 8.4, Symfony 7.4, API Platform 4, Doctrine ORM, Messenger, LexikJWT, KnpU OAuth2 client |
| Admin | EasyAdmin 5 |
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, TanStack Query, Zustand, React Router 7 |
| Database | PostgreSQL 16 (Redis optional) |
| Runtime | FrankenPHP (worker mode) and Caddy, in one Docker image |

## Architecture

```
React SPA (frontend/)  ──/api/* (JSON-LD, JWT)──▶  Symfony + API Platform (src/)  ──Doctrine──▶  PostgreSQL
        ▲                                             ├─ Entities, State providers, Filters
        │ static build served from public/            ├─ Proxy controllers (YouTube, Dev.to, Reddit, recipes, archive)
FrankenPHP / Caddy (single container)                 └─ Services/Aggregator + fetchers
```

```
.
├── src/
│   ├── Entity/          # Tutorial, Category, Tag, User, Comment, Favorite, Rating, Progress…
│   ├── Controller/      # Auth, OAuth, profile, proxies to external sources, admin
│   ├── Service/         # Fetchers (YouTube, Dev.to, Reddit, Medium, MealDB, Spoonacular), translator, recommendations
│   ├── Command/         # app:aggregate, app:seed-*, app:generate-tutorials, app:enrich-tutorials
│   └── State/ Filter/ EventSubscriber/ MessageHandler/ …
├── frontend/            # React + Vite SPA
├── config/ migrations/ templates/
├── Dockerfile           # multi-stage: build SPA, then PHP/FrankenPHP runtime
└── compose.yaml         # Postgres (+ Mailpit in compose.override.yaml)
```

In production, the Dockerfile builds the SPA and copies it into `public/`. FrankenPHP then serves both the SPA and the API on `$PORT`, and runs migrations on boot.

## Local setup

### Prerequisites

- Docker and Docker Compose, **or** PHP ≥ 8.2 (pdo_pgsql, intl), Composer 2, Node 22 and PostgreSQL 16
- OpenSSL, to generate the JWT keys

### Option A: Docker

```bash
git clone https://github.com/Fl0Sin3x/yourtuto-app.git && cd yourtuto-app
cp .env.example .env.local          # then edit the values

# Database + Mailpit
docker compose up -d

# Or build and run the full production image
docker build -t yourtuto .
docker run --rm -p 8080:8080 --env-file .env.local yourtuto
# → http://localhost:8080
```

### Option B: Manual

```bash
# 1. Backend
cp .env.example .env.local
composer install
php bin/console lexik:jwt:generate-keypair
docker compose up -d database        # or use your own Postgres
php bin/console doctrine:migrations:migrate -n
php bin/console app:seed-dev-tutorials   # optional seed data
php bin/console app:seed-recipes
symfony serve --port=8002            # or: php -S 127.0.0.1:8002 -t public

# 2. Frontend (new terminal)
cd frontend
npm ci
npm run dev                          # http://localhost:3000, /api proxied to :8002
```

## Environment variables

`composer install` creates `.env` from `.env.example` if it is missing (the Docker image does the same). Put your local values in `.env.local`, which is git-ignored. Real environment variables always override `.env*` files. **Never commit real secrets.**

| Variable | Required | Description |
|----------|:-------:|-------------|
| `APP_ENV` | ✅ | `dev` or `prod` |
| `APP_SECRET` | ✅ | Random string (`openssl rand -hex 16`) |
| `DATABASE_URL` | ✅ | PostgreSQL DSN |
| `JWT_SECRET_KEY` / `JWT_PUBLIC_KEY` | ✅ | Paths to the JWT keypair (`config/jwt/*.pem`) |
| `JWT_PASSPHRASE` | ✅ | Passphrase of the JWT private key |
| `CORS_ALLOW_ORIGIN` | ✅ | Regex of allowed frontend origins |
| `DEFAULT_URI` | ✅ | Public URL of the API (used in CLI URL generation) |
| `FRONTEND_URL` | ✅ | Public URL of the SPA (password-reset links, OAuth redirects) |
| `SITE_URL` | ✅ | Public base URL for canonical URLs, Open Graph, `sitemap.xml` and `robots.txt` |
| `MAILER_DSN` | ✅ | Mailer DSN (Mailpit `smtp://127.0.0.1:1025` locally) |
| `MESSENGER_TRANSPORT_DSN` | | `sync://` by default |
| `REDIS_URL` | | Optional cache/session backend |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | | Google OAuth login |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | | GitHub OAuth login |
| `YOUTUBE_API_KEY` | | YouTube Data API v3 |
| `DEVTO_API_KEY` | | Dev.to API |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | | Reddit API |
| `SPOONACULAR_API_KEY` | | Spoonacular recipes |
| `ANTHROPIC_API_KEY` | | AI generation/enrichment commands |
| `SUMMARY_AI_ENABLED` | | `1` to generate cached AI TL;DR summaries (paid API). Default `0`: free extractive outline |
| `VITE_API_URL` (frontend) | | API base URL, if the SPA is not served by the same origin |
| `VITE_SITE_URL` (frontend) | | Base URL for client-side canonical/OG tags (defaults to `window.location.origin`) |

## Scripts

**Frontend** (`frontend/`)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server on :3000 |
| `npm run build` | Type-check and production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build |
| `npm test` | Vitest unit tests |

**Backend console**

| Command | What it does |
|---------|--------------|
| `php bin/console app:aggregate` | Import tutorials from YouTube, Dev.to, Reddit and Instructables |
| `php bin/console app:seed-dev-tutorials` | Seed about 150 curated dev/AI tutorials |
| `php bin/console app:seed-recipes` | Seed about 270 curated recipes |
| `php bin/console app:seed-paths` | Create/update the curated learning paths (idempotent; also runs on boot when `SEED_ON_BOOT=1`) |
| `php bin/console app:seed-community` | Seed community tutorials and recipes |
| `php bin/console app:generate-tutorials` | Generate dev tutorials with the Anthropic API |
| `php bin/console app:enrich-tutorials` | Enrich short tutorials with the Anthropic API |

## SEO

YourTuto stays a pure SPA, but crawlers get real HTML metadata through a pragmatic **"SSR-lite"** approach: no Node SSR server and no headless-browser prerendering.

- **Server-rendered `<head>`:** Caddy routes the public pages (`/`, `/tutorials`, `/tutorials/{id}/{slug}`, `/category/{source}`) to Symfony (`SeoController`). Symfony serves the built `index.html` with page-specific tags injected between `<!--seo:start-->` and `<!--seo:end-->`: `<title>`, meta description, robots, canonical, Open Graph, Twitter card and JSON-LD (`WebSite` + `SearchAction`, `Article`, `CollectionPage`, `BreadcrumbList`). Every visitor gets the same HTML, so this is not cloaking.
- **Client-side tags:** the `<Seo>` component (`frontend/src/seo/Seo.tsx`) uses React 19's native `<title>`/`<meta>`/`<link>` hoisting, so tags stay correct during in-app navigation. Server tags are marked `data-seo` and removed on the first render to avoid duplicates.
- **Clean URLs:** tutorials live at `/tutorials/{id}/{slug}`. `/tutorials/{id}` and outdated slugs are redirected with a 301.
- **Indexing rules:** unpublished tutorials and unknown pages get `noindex`. Search result pages and pagination are `noindex` on the client.
- **`/sitemap.xml`** (dynamic: home, tutorial index, categories, published internal tutorials with `lastmod`) and **`/robots.txt`** (blocks the private and API areas and points to the sitemap) are served by Symfony.
- The base URL comes from `SITE_URL`.

The page body itself is still rendered by the browser. Google renders JS, so it indexes the content too. Other crawlers and social previews rely on the server-rendered head. Full prerendering of the body can be added later if needed.

## Tests & CI

```bash
# Backend: needs a Postgres database (the test env uses <db>_test)
echo 'DATABASE_URL="postgresql://app:app@127.0.0.1:5432/app?serverVersion=16"' > .env.test.local
php bin/console doctrine:database:create --env=test --if-not-exists
php bin/phpunit

# Frontend
cd frontend && npm test
```

GitHub Actions (`.github/workflows/ci.yml`) runs on every PR and on pushes to `staging` and `master`:
- **Backend:** composer validate, `lint:container`, `lint:yaml`, `lint:twig`, migrations on a fresh Postgres, `doctrine:schema:validate`, PHPUnit (Postgres and Redis services).
- **Frontend:** ESLint, Vitest, production build.

## Database migrations

The March 2026 migrations were squashed into a single **baseline** (`migrations/Version20261013000000.php`).
- **Fresh database:** `doctrine:migrations:migrate` creates the full schema.
- **Existing database** (production, created with the old migrations): the baseline sees that the schema already exists, runs no SQL and is only recorded as executed. No manual step is needed. Doctrine will warn about the 9 old versions that no longer have files. Optionally clean them up once with `php bin/console doctrine:migrations:version --delete --all` followed by `php bin/console doctrine:migrations:version --add --all`.

## Roadmap

- [ ] Public live demo with seed data
- [x] Automated tests (PHPUnit for the API, Vitest for the SPA)
- [x] GitHub Actions CI: lint, build, tests
- [x] SEO: per-page meta/OG/JSON-LD, clean URLs, sitemap.xml, robots.txt
- [ ] Full body prerendering for non-JS crawlers
- [ ] More sources and smarter, personalised recommendations
- [ ] i18n of the UI (FR / EN)
- [ ] PWA / offline reading

## License

[MIT](LICENSE) © 2026 Florian Salducci
