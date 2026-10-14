# Veille concurrentielle (octobre 2026), notes courtes

| Produit | Force | Faiblesse / angle pour YourTuto |
|---|---|---|
| **daily.dev** | Flux d'articles dev personnalisé, extension navigateur, streaks et réputation, squads | Articles uniquement, pas de vidéo, pas de progression structurée ni de parcours |
| **Class Central** | Catalogue géant de MOOCs, avis, filtres (gratuit, certificat, niveau) | Agrégateur de cours longs, peu de contenus courts, pas de suivi d'apprentissage intégré |
| **roadmap.sh** | Roadmaps visuelles par métier, suivi de progression par nœud, très partageable | Peu de contenu propre : renvoie vers des liens externes, pas de découverte ni de recommandations |
| **freeCodeCamp** | Curriculum interactif et certifiant, communauté énorme | Parcours linéaire et rigide, pas d'agrégation multi-sources (YouTube, DEV.to, Reddit) |

## Différenciateurs choisis pour YourTuto
1. **Agrégation multi-sources** (YouTube, DEV.to, Reddit, Medium, communauté, recettes/DIY) dans **un seul** flux, ce qu'aucun des quatre ne fait.
2. **Parcours avec progression** (inspirés de roadmap.sh) construits sur des tutos courts déjà agrégés (`/paths`).
3. **Résumés IA mis en cache avec un fallback extractif** : coût nul par défaut, un aperçu avant de cliquer.
4. **Découverte plus fine** : filtres niveau et popularité, tutos similaires par score de contenu (tags, catégories, titres).
5. **Habitudes** : streaks avec jour de grâce, heatmap 84 jours, badges (repris de daily.dev, appliqués à la *complétion* plutôt qu'à la lecture).
6. **Collections publiques partageables** (`/c/:slug`, SEO), une boucle virale que Class Central et freeCodeCamp n'ont pas.
7. **PWA installable** et page publique `/stats` (transparence du catalogue).

## Pistes suivantes
- Recos personnalisées basées sur la progression (embeddings gratuits en local, ou TF-IDF).
- Squads / collections collaboratives, puis votes sur les collections publiques.
- Import / export avec les roadmaps de roadmap.sh (mapping nœud → tutos).
