<?php

namespace App\Command;

use App\Entity\Tutorial;
use App\Entity\User;
use App\Enum\TutorialSource;
use App\Repository\CategoryRepository;
use App\Repository\TagRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(name: 'app:seed-community', description: 'Seed community tutorials and recipes')]
class SeedCommunityCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $em,
        private UserPasswordHasherInterface $hasher,
        private CategoryRepository $categoryRepo,
        private TagRepository $tagRepo,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('reset-recipes', null, InputOption::VALUE_NONE, 'Supprime et re-seed les recettes existantes');
        $this->addOption('recipes-only',  null, InputOption::VALUE_NONE, 'Ne seed que les recettes (ignore les tutoriels de code)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        // ─── Create or fetch user ────────────────────────────────────────────
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'community@yourtuto.com']);
        if (!$user) {
            $user = new User();
            $user->setEmail('community@yourtuto.com');
            $user->setUsername('yourtutocommunity');
            $user->setPassword($this->hasher->hashPassword($user, 'YourTuto2026!'));
            $this->em->persist($user);
            $this->em->flush();
            $io->success('Utilisateur yourtutocommunity créé.');
        } else {
            $io->note('Utilisateur yourtutocommunity déjà existant.');
        }

        // ─── Helpers ─────────────────────────────────────────────────────────
        $cat  = fn(string $slug) => $this->categoryRepo->findOneBy(['slug' => $slug]);
        $tag  = fn(string $name) => $this->tagRepo->findOneBy(['name' => $name]);

        $devCat    = $cat('d-veloppement-web');
        $devopsCat = $cat('devops');

        $make = function (string $title, string $desc, string $content, $category, array $tagNames) use ($user, $tag): Tutorial {
            $t = new Tutorial();
            $t->setTitle($title);
            $t->setDescription($desc);
            $t->setContent($content);
            $t->setSource(TutorialSource::Community);
            $t->setAuthor($user);
            if ($category) {
                $t->addCategory($category);
            }
            foreach ($tagNames as $name) {
                $tagEntity = $tag($name);
                if ($tagEntity) {
                    $t->addTag($tagEntity);
                }
            }
            return $t;
        };

        // ─── Content strings (NOWDOC — no variable interpolation) ─────────────

        $c1 = <<<'EOT'
## Les hooks React

Avant les hooks, la gestion d'état était réservée aux composants de classe. Depuis React 16.8, les hooks permettent d'utiliser l'état dans des composants fonctionnels.

### useState

```jsx
const [count, setCount] = useState(0);
```

### useEffect

Exécute du code en réponse aux changements de dépendances :

```jsx
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]);
```

### useCallback

Mémoïse une fonction pour éviter les re-renders inutiles :

```jsx
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []);
```

### useRef

Référence un élément DOM ou stocke une valeur mutable :

```jsx
const inputRef = useRef(null);
inputRef.current.focus();
```

> **Astuce :** Ne jamais appeler les hooks dans des conditions ou des boucles.
EOT;

        $c2 = <<<'EOT'
## Types utilitaires TypeScript

TypeScript fournit des types utilitaires intégrés pour transformer des types existants.

### Partial\<T>

Rend toutes les propriétés optionnelles :

```ts
interface User { id: number; name: string; email: string; }
type PartialUser = Partial<User>; // { id?: number; name?: string; email?: string; }
```

### Pick\<T, K>

Sélectionne certaines propriétés :

```ts
type UserPreview = Pick<User, 'id' | 'name'>;
```

### Omit\<T, K>

Supprime certaines propriétés :

```ts
type UserWithoutEmail = Omit<User, 'email'>;
```

### Record\<K, V>

Crée un objet avec des clés typées :

```ts
const roles: Record<string, string[]> = {
  admin: ['read', 'write', 'delete'],
  user:  ['read'],
};
```

### ReturnType\<T>

Extrait le type de retour d'une fonction :

```ts
function getUser() { return { id: 1, name: 'Alice' }; }
type UserReturn = ReturnType<typeof getUser>;
```
EOT;

        $c3 = <<<'EOT'
## Git : les commandes avancées

### git stash

Mettre de côté des modifications non commitées :

```bash
git stash
git stash pop
git stash list
git stash apply stash@{2}
```

### git rebase

Réécrire l'historique pour un historique linéaire :

```bash
git rebase main
git rebase -i HEAD~3   # rebase interactif sur les 3 derniers commits
```

### git cherry-pick

Appliquer un commit spécifique sur la branche courante :

```bash
git cherry-pick abc1234
```

### git bisect

Trouver le commit qui a introduit un bug par dichotomie :

```bash
git bisect start
git bisect bad           # le commit actuel est bugué
git bisect good v1.0     # cette version fonctionnait
# Git checkout automatiquement au milieu, tu testes et continues
git bisect good / bad
git bisect reset
```

### git reflog

Retrouver un commit "perdu" :

```bash
git reflog
git checkout HEAD@{3}
```
EOT;

        $c4 = <<<'EOT'
## Docker pour les développeurs web

### Dockerfile minimal pour Node.js

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### docker-compose.yml typique

```yaml
version: '3.9'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Commandes essentielles

```bash
docker compose up -d       # démarrer en arrière-plan
docker compose logs -f     # suivre les logs
docker compose down        # arrêter
docker exec -it app sh     # ouvrir un shell dans le conteneur
docker compose build --no-cache
```

> **Astuce :** Utiliser `.dockerignore` pour exclure `node_modules` et `.env`.
EOT;

        $c5 = <<<'EOT'
## CSS Grid en pratique

Grid Layout est idéal pour les layouts 2D (lignes et colonnes).

### Layout de base

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
```

### grid-template-areas

```css
.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main   main"
    "footer footer footer";
  grid-template-columns: 250px 1fr 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}

.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.footer  { grid-area: footer; }
```

### Centrer avec Grid

```css
.center {
  display: grid;
  place-items: center;
  min-height: 100vh;
}
```

### Grid responsive sans media queries

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}
```
EOT;

        $c6 = <<<'EOT'
## REST API : bonnes pratiques

### Structure des URLs

```
GET    /api/users           # liste
GET    /api/users/42        # détail
POST   /api/users           # créer
PATCH  /api/users/42        # mise à jour partielle
DELETE /api/users/42        # supprimer
```

### Codes de statut HTTP

| Code | Signification |
|------|--------------|
| 200  | OK |
| 201  | Created |
| 204  | No Content (DELETE réussi) |
| 400  | Bad Request |
| 401  | Unauthorized |
| 403  | Forbidden |
| 404  | Not Found |
| 422  | Unprocessable Entity |
| 500  | Internal Server Error |

### Pagination

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 153,
    "totalPages": 8
  }
}
```

### Versioning

Préférer le versioning par URL : `/api/v1/users`, `/api/v2/users`.

### Authentification

Utiliser des tokens JWT dans le header `Authorization: Bearer <token>`.
EOT;

        $c7 = <<<'EOT'
## JWT : JSON Web Tokens

### Structure

Un JWT est composé de 3 parties séparées par des points :

```
header.payload.signature
```

- **Header** : algorithme + type
- **Payload** : données (claims) — userId, roles, expiry
- **Signature** : garantit l'intégrité

### Création (Node.js)

```js
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId: 42, roles: ['user'] },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

### Vérification

```js
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log(decoded.userId); // 42
} catch (err) {
  // token invalide ou expiré
}
```

### Bonnes pratiques

- Ne jamais stocker de données sensibles dans le payload (il est décodable)
- Utiliser des temps d'expiration courts (15min pour l'access token)
- Coupler avec un refresh token stocké en httpOnly cookie
- Utiliser RS256 (asymétrique) en production
EOT;

        $c8 = <<<'EOT'
## PostgreSQL avancé

### CTE (Common Table Expressions)

```sql
WITH ranked_users AS (
  SELECT
    id,
    username,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at) AS rank
  FROM users
)
SELECT * FROM ranked_users WHERE rank <= 10;
```

### Window Functions

```sql
SELECT
  username,
  score,
  AVG(score) OVER (PARTITION BY team) AS team_avg,
  RANK()     OVER (ORDER BY score DESC) AS global_rank
FROM players;
```

### JSONB

```sql
-- Créer une colonne JSONB
ALTER TABLE users ADD COLUMN metadata JSONB;

-- Insérer
UPDATE users SET metadata = '{"plan": "pro"}' WHERE id = 1;

-- Requêter
SELECT * FROM users WHERE metadata->>'plan' = 'pro';

-- Indexer
CREATE INDEX ON users USING gin(metadata);
```

### UPSERT

```sql
INSERT INTO user_settings (user_id, theme)
VALUES (42, 'dark')
ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme;
```
EOT;

        $c9 = <<<'EOT'
## API Platform avec Symfony

### Installation

```bash
composer require api-platform/core
composer require symfony/orm-pack
```

### Créer une entité exposée

```php
#[ORM\Entity]
#[ApiResource(
    normalizationContext: ['groups' => ['article:read']],
    denormalizationContext: ['groups' => ['article:write']],
    operations: [
        new GetCollection(),
        new Get(),
        new Post(security: "is_granted('ROLE_USER')"),
        new Patch(security: "object.getAuthor() == user"),
        new Delete(security: "object.getAuthor() == user"),
    ]
)]
class Article
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    #[Groups(['article:read'])]
    private ?int $id = null;

    #[ORM\Column]
    #[Groups(['article:read', 'article:write'])]
    private string $title = '';
}
```

### Filtres

```php
#[ApiFilter(SearchFilter::class, properties: ['title' => 'partial'])]
#[ApiFilter(OrderFilter::class, properties: ['createdAt'])]
```

API Platform génère automatiquement la documentation OpenAPI sur `/api/docs`.
EOT;

        $c10 = <<<'EOT'
## GitHub Actions : CI/CD

### Workflow de base

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Tests
        run: npm test
```

### Déploiement sur Railway

```yaml
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: my-service
```

### Secrets

Dans **Settings → Secrets → Actions**, ajouter tes variables sensibles (`RAILWAY_TOKEN`, `DATABASE_URL`, etc.).
EOT;

        $c11 = <<<'EOT'
## Tailwind CSS : patterns courants

### Centrer un élément

```html
<div class="flex items-center justify-center min-h-screen">
  <div>Contenu centré</div>
</div>
```

### Carte avec hover

```html
<div class="group bg-white rounded-2xl border border-zinc-200 p-6
            hover:shadow-xl hover:border-zinc-300 transition-all duration-300">
  <h2 class="font-semibold text-zinc-900 group-hover:text-violet-700 transition-colors">
    Titre de la carte
  </h2>
</div>
```

### Grid responsive

```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
  <!-- cartes -->
</div>
```

### Gradient button

```html
<button class="bg-gradient-to-r from-violet-600 to-purple-600
               hover:from-violet-500 hover:to-purple-500
               text-white px-5 py-2.5 rounded-xl font-semibold
               shadow-lg shadow-violet-500/25 transition-all">
  Bouton
</button>
```

> **Astuce :** Configurer `darkMode: 'class'` dans `tailwind.config.js` pour un toggle manuel.
EOT;

        $c12 = <<<'EOT'
## TanStack Query (React Query)

### Installation

```bash
npm install @tanstack/react-query
```

### Provider

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
```

### useQuery

```tsx
const { data, isLoading, isError } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});
```

### useMutation

```tsx
const mutation = useMutation({
  mutationFn: (newPost) => api.createPost(newPost),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  },
});
```

### Invalidation

```tsx
// Invalider après une action
queryClient.invalidateQueries({ queryKey: ['users'] });

// Mettre à jour le cache directement
queryClient.setQueryData(['user', 42], updatedUser);
```
EOT;

        $c13 = <<<'EOT'
## Zustand : gestion d'état minimaliste

### Installation

```bash
npm install zustand
```

### Créer un store

```ts
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}));
```

### Utiliser dans un composant

```tsx
function Navbar() {
  const { user, logout } = useAuthStore();

  return (
    <nav>
      {user ? (
        <>
          <span>@{user.username}</span>
          <button onClick={logout}>Déconnexion</button>
        </>
      ) : (
        <a href="/login">Connexion</a>
      )}
    </nav>
  );
}
```

### Persist (localStorage)

```ts
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }),
    { name: 'my-store' }
  )
);
```
EOT;

        $c14 = <<<'EOT'
## Vite : le build tool moderne

### Créer un projet

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm run dev
```

### vite.config.ts

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

### Variables d'environnement

Préfixer avec `VITE_` pour les exposer au client :

```
VITE_API_URL=https://api.example.com
```

```ts
const apiUrl = import.meta.env.VITE_API_URL;
```

### Pourquoi Vite ?

- **HMR ultra-rapide** grâce aux ES modules natifs
- **Build optimisé** avec Rollup (tree-shaking, code splitting)
- Remplace Create React App, Webpack, Parcel
EOT;

        $c15 = <<<'EOT'
## PHP 8.3 : les nouveautés à connaître

### Typed class constants

```php
class Config {
    const string APP_NAME = 'YourTuto';
    const int MAX_UPLOAD = 10;
}
```

### readonly classes

```php
readonly class Point {
    public function __construct(
        public float $x,
        public float $y,
        public float $z = 0.0,
    ) {}
}

$p = new Point(1.5, 2.0);
// $p->x = 3.0; // Error: readonly
```

### json_validate()

```php
if (json_validate($jsonString)) {
    $data = json_decode($jsonString, true);
}
```

### Amélioration des Fibers

Les Fibers (introduites en PHP 8.1) permettent de créer des coroutines légères pour la programmation asynchrone.

### Attributs sur les constantes

```php
class User {
    #[Deprecated('Utiliser getFullName() à la place')]
    public function getName(): string { ... }
}
```
EOT;

        $c16 = <<<'EOT'
## Docker multi-stage build

Les builds multi-stages permettent de créer des images de production légères.

### Exemple Node.js

```dockerfile
# Stage 1 : build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 : production
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Exemple PHP/Symfony

```dockerfile
FROM php:8.3-fpm-alpine AS base
RUN apk add --no-cache postgresql-dev && docker-php-ext-install pdo_pgsql

FROM base AS builder
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer*.json ./
RUN composer install --no-dev --optimize-autoloader
COPY . .
RUN php bin/console cache:warmup --env=prod

FROM base AS production
WORKDIR /app
COPY --from=builder /app .
```

### Avantages

- Image finale beaucoup plus légère (pas d'outils de build)
- Séparation claire des concerns
- Cache Docker optimisé par layers
EOT;

        $c17 = <<<'EOT'
## CSS Flexbox : le guide complet

### Concepts de base

```css
.container {
  display: flex;
  flex-direction: row;         /* ou column */
  justify-content: space-between; /* axe principal */
  align-items: center;         /* axe secondaire */
  gap: 1rem;
  flex-wrap: wrap;
}
```

### Propriétés des enfants

```css
.item {
  flex: 1;           /* flex-grow: 1, flex-shrink: 1, flex-basis: 0 */
  flex: 0 0 200px;   /* taille fixe de 200px */
  align-self: flex-end;
  order: -1;         /* modifier l'ordre sans changer le HTML */
}
```

### Patterns courants

**Navbar :**
```html
<nav style="display:flex; justify-content:space-between; align-items:center;">
  <Logo />
  <NavLinks />
  <UserMenu />
</nav>
```

**Centrer parfaitement :**
```css
.parent {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
```

> Grid = layouts 2D, Flexbox = layouts 1D. Les deux sont complémentaires.
EOT;

        $c18 = <<<'EOT'
## Symfony Messenger : les jobs asynchrones

### Installation

```bash
composer require symfony/messenger
```

### Créer un message

```php
// src/Message/SendEmailNotification.php
class SendEmailNotification
{
    public function __construct(
        public readonly string $to,
        public readonly string $subject,
        public readonly string $body,
    ) {}
}
```

### Créer un handler

```php
// src/MessageHandler/SendEmailNotificationHandler.php
#[AsMessageHandler]
class SendEmailNotificationHandler
{
    public function __construct(private MailerInterface $mailer) {}

    public function __invoke(SendEmailNotification $message): void
    {
        $email = (new Email())
            ->to($message->to)
            ->subject($message->subject)
            ->text($message->body);

        $this->mailer->send($email);
    }
}
```

### Dispatcher le message

```php
$this->bus->dispatch(new SendEmailNotification(
    'user@example.com',
    'Bienvenue !',
    'Merci de ton inscription.'
));
```

### config/packages/messenger.yaml

```yaml
framework:
  messenger:
    transports:
      async: '%env(MESSENGER_TRANSPORT_DSN)%'
    routing:
      App\Message\SendEmailNotification: async
```
EOT;

        $c19 = <<<'EOT'
## Accessibilité web (a11y) : les bases

### ARIA roles essentiels

```html
<nav aria-label="Navigation principale">
  <ul role="list">
    <li><a href="/">Accueil</a></li>
  </ul>
</nav>

<button aria-expanded="false" aria-controls="menu">
  Menu
</button>

<div id="menu" role="menu" hidden>
  ...
</div>
```

### Images alternatives

```html
<!-- Image informative -->
<img src="chart.png" alt="Graphique montrant une hausse de 30% en mars" />

<!-- Image décorative -->
<img src="decoration.png" alt="" role="presentation" />
```

### Focus management

```css
/* Ne jamais masquer le focus sans alternative */
:focus-visible {
  outline: 2px solid #7c3aed;
  outline-offset: 2px;
}
```

### Checklist rapide

- [ ] Contraste suffisant (WCAG AA = 4.5:1 pour le texte normal)
- [ ] Navigation clavier complète (Tab, Enter, Escape, flèches)
- [ ] Labels sur tous les inputs
- [ ] Hiérarchie de titres logique (h1 → h2 → h3)
- [ ] Textes alternatifs pour les images informatives
- [ ] Pas de contenu uniquement par la couleur
EOT;

        $c20 = <<<'EOT'
## Prisma ORM avec TypeScript

### Installation

```bash
npm install prisma @prisma/client
npx prisma init
```

### Schema (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  username  String
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id])
  authorId  Int
}
```

### Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Requêtes

```ts
const prisma = new PrismaClient();

// Créer
const user = await prisma.user.create({
  data: { email: 'alice@example.com', username: 'alice' },
});

// Lire avec relation
const posts = await prisma.post.findMany({
  where: { published: true },
  include: { author: true },
  orderBy: { createdAt: 'desc' },
});

// Update
await prisma.post.update({
  where: { id: 1 },
  data: { published: true },
});
```
EOT;

        // ─── Community tutorials ──────────────────────────────────────────────
        $tutorials = [
            $make('Les hooks React expliqués simplement', 'Comprendre useState, useEffect, useCallback et useRef avec des exemples concrets.', $c1, $devCat, ['react', 'javascript']),
            $make('TypeScript : les types utilitaires à connaître', 'Partial, Required, Pick, Omit, Record... les utilitaires TypeScript qui changent la vie.', $c2, $devCat, ['javascript']),
            $make('Git : les commandes avancées que tu ignores peut-être', 'git rebase, git stash, git bisect, cherry-pick... le guide pratique.', $c3, $devCat, ['opensource']),
            $make('Docker pour les développeurs web', 'Conteneuriser une app Node.js ou PHP avec Docker et docker-compose.', $c4, $devopsCat, ['webdev']),
            $make('CSS Grid : maîtriser les layouts en 2D', 'grid-template-areas, auto-fill, minmax... tout ce que tu dois savoir sur CSS Grid.', $c5, $devCat, ['css', 'webdev']),
            $make('REST API : les bonnes pratiques', 'Nommage des routes, codes HTTP, pagination, versioning et authentification JWT.', $c6, $devCat, ['api', 'webdev']),
            $make('JWT : comprendre les JSON Web Tokens', 'Comment fonctionne l\'authentification sans session avec les tokens JWT.', $c7, $devCat, ['api', 'javascript']),
            $make('PostgreSQL avancé : CTE, Window Functions et JSONB', 'Requêtes analytiques avancées avec PostgreSQL pour les développeurs.', $c8, $devCat, ['api']),
            $make('Symfony : créer une API REST avec API Platform', 'De l\'entité Doctrine à une API complète en quelques minutes avec API Platform.', $c9, $devCat, ['php', 'symfony', 'api']),
            $make('GitHub Actions : CI/CD pour ton projet web', 'Automatiser les tests, le linting et le déploiement avec GitHub Actions.', $c10, $devopsCat, ['webdev', 'opensource']),
            $make('Tailwind CSS : les patterns les plus utiles', 'Les combinaisons de classes Tailwind les plus utilisées pour construire de vraies UI.', $c11, $devCat, ['css', 'webdev']),
            $make('React Query : la gestion du server state', 'Remplacer Redux pour le fetching avec TanStack Query : useQuery, useMutation, invalidation.', $c12, $devCat, ['react', 'javascript']),
            $make('Zustand : gestion d\'état minimaliste pour React', 'Une alternative légère à Redux pour gérer l\'état global dans React.', $c13, $devCat, ['react', 'javascript']),
            $make('Vite : le build tool moderne pour le frontend', 'Pourquoi Vite remplace Webpack et CRA, et comment le configurer pour React + TypeScript.', $c14, $devCat, ['javascript', 'webdev']),
            $make('PHP 8.3 : les nouveautés à connaître', 'Typed class constants, readonly classes, json_validate()... les nouvelles features PHP 8.3.', $c15, $devCat, ['php']),
            $make('Docker multi-stage build pour des images légères', 'Réduire drastiquement la taille des images Docker en production avec les multi-stage builds.', $c16, $devopsCat, ['webdev']),
            $make('CSS Flexbox : le guide complet', 'Tout ce que tu dois savoir sur Flexbox pour aligner et distribuer des éléments.', $c17, $devCat, ['css', 'webdev']),
            $make('Symfony Messenger : les jobs asynchrones', 'Traiter des tâches longues en arrière-plan avec Symfony Messenger et des transports async.', $c18, $devCat, ['php', 'symfony']),
            $make('Accessibilité web (a11y) : les bases essentielles', 'ARIA, contraste, navigation clavier, images alt... rendre son site accessible à tous.', $c19, $devCat, ['webdev']),
            $make('Prisma ORM avec TypeScript', 'Modéliser sa base de données, générer le client et écrire des requêtes typées avec Prisma.', $c20, $devCat, ['javascript', 'api']),
        ];

        if (!$input->getOption('recipes-only')) {
            foreach ($tutorials as $t) {
                $this->em->persist($t);
            }
            $this->em->flush();
            $io->success(count($tutorials) . ' tutoriels communauté créés.');
        }

        // ─── Recipes via Spoonacular ──────────────────────────────────────────
        $spoonacularKey = $_ENV['SPOONACULAR_API_KEY'] ?? getenv('SPOONACULAR_API_KEY') ?? '';
        if (!$spoonacularKey) {
            $io->warning('SPOONACULAR_API_KEY non définie — recettes ignorées.');
            return Command::SUCCESS;
        }

        // Supprimer les recettes existantes si --reset-recipes
        if ($input->getOption('reset-recipes')) {
            $existing = $this->em->getRepository(Tutorial::class)->findBy([
                'author' => $user,
                'source' => TutorialSource::Recipe,
            ]);
            foreach ($existing as $r) {
                $this->em->remove($r);
            }
            $this->em->flush();
            $io->note(count($existing) . ' recettes existantes supprimées.');
        }

        $recipeCat = $cat('recettes') ?? $devCat;

        $cuisinesFr = [
            'French'        => ['label' => 'française',       'adj' => 'de la cuisine française'],
            'Asian'         => ['label' => 'asiatique',       'adj' => 'de la cuisine asiatique'],
            'Italian'       => ['label' => 'italienne',       'adj' => 'de la cuisine italienne'],
            'Mediterranean' => ['label' => 'méditerranéenne', 'adj' => 'de la cuisine méditerranéenne'],
            'Japanese'      => ['label' => 'japonaise',       'adj' => 'de la cuisine japonaise'],
        ];

        $translateFr = function (string $text): string {
            $url  = 'https://api.mymemory.translated.net/get?q=' . urlencode($text) . '&langpair=en|fr';
            $json = @file_get_contents($url);
            if (!$json) return $text;
            $data = json_decode($json, true);
            $translated = $data['responseData']['translatedText'] ?? $text;
            // MyMemory sometimes returns ALL CAPS on failure — fall back to original
            return $translated === strtoupper($translated) ? $text : $translated;
        };

        $recipeCount = 0;

        foreach ($cuisinesFr as $cuisine => $fr) {
            $url = sprintf(
                'https://api.spoonacular.com/recipes/complexSearch?cuisine=%s&number=4&addRecipeInformation=true&apiKey=%s',
                $cuisine,
                $spoonacularKey
            );

            $json = @file_get_contents($url);
            if (!$json) {
                $io->warning("Impossible de récupérer les recettes $cuisine.");
                continue;
            }

            $data = json_decode($json, true);
            $results = $data['results'] ?? [];

            foreach ($results as $recipe) {
                $spId = 'spoonacular-' . $recipe['id'];

                $existing = $this->em->getRepository(Tutorial::class)->findOneBy(['externalId' => $spId]);
                if ($existing) {
                    continue;
                }

                $readyIn  = $recipe['readyInMinutes'] ?? null;
                $servings = $recipe['servings'] ?? null;
                $veggie   = !empty($recipe['vegetarian']);
                $vegan    = !empty($recipe['vegan']);

                $descParts = ["Un grand classique {$fr['adj']}."];
                if ($readyIn)  $descParts[] = "Prêt en {$readyIn} min.";
                if ($servings) $descParts[] = "Pour {$servings} personnes.";
                if ($vegan)        $descParts[] = "Convient aux végétaliens.";
                elseif ($veggie)   $descParts[] = "Convient aux végétariens.";

                $titleFr = $translateFr($recipe['title']);
                $io->writeln("  → {$recipe['title']} ⟶ {$titleFr}");

                $t = new Tutorial();
                $t->setTitle($titleFr);
                $t->setDescription(implode(' ', $descParts));
                $t->setSource(TutorialSource::Recipe);
                $t->setExternalId($spId);
                $t->setThumbnailUrl($recipe['image'] ?? null);
                $t->setExternalUrl($recipe['sourceUrl'] ?? null);
                $t->setAuthor($user);
                if ($recipeCat) {
                    $t->addCategory($recipeCat);
                }

                $this->em->persist($t);
                $recipeCount++;
            }

            $this->em->flush();
        }

        $io->success("$recipeCount recettes ajoutées.");

        return Command::SUCCESS;
    }
}
