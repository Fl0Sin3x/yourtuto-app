import { Link } from 'react-router-dom';
import { useFavorites, useToggleFavorite } from '../hooks/useFavorites';
import type { FavoriteItem } from '../api/favorites';

const SOURCE_LABEL: Record<string, string> = {
  community:     'Communauté',
  youtube:       'YouTube',
  devto:         'DEV.to',
  reddit:        'Reddit',
  medium:        'Medium',
  recipe:        '🍳 Recette',
  instructables: '🔧 DIY',
  generated:     '✨ Bricolage',
  dev:           '💻 Dev',
};

const SOURCE_COLOR: Record<string, string> = {
  community:     'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  youtube:       'bg-red-50 text-red-600 ring-red-600/20',
  devto:         'bg-violet-50 text-violet-700 ring-violet-600/20',
  reddit:        'bg-orange-50 text-orange-600 ring-orange-600/20',
  medium:        'bg-sky-50 text-sky-700 ring-sky-600/20',
  recipe:        'bg-amber-50 text-amber-700 ring-amber-600/20',
  instructables: 'bg-lime-50 text-lime-700 ring-lime-600/20',
  generated:     'bg-violet-50 text-violet-700 ring-violet-600/20',
  dev:           'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
};

function itemLink(item: FavoriteItem): string {
  const slug = item.itemSlug;
  if (item.source === 'community' || item.source === 'generated' || item.source === 'dev') return `/tutorials/${slug}`;
  if (item.source === 'devto')  return `/devto/${slug}`;
  if (item.source === 'reddit') return `/reddit/${slug.replace('reddit-', '')}`;
  if (item.source === 'youtube') return `/youtube/${slug}`;
  if (item.source === 'recipe') {
    if (slug.startsWith('spoonacular-')) return item.externalUrl ?? '#';
    return `/recipe/${slug.replace('mealdb-', '')}`;
  }
  return item.externalUrl ?? '#';
}

function isExternal(item: FavoriteItem): boolean {
  if (['community', 'devto', 'reddit', 'generated', 'dev'].includes(item.source)) return false;
  if (item.source === 'youtube') return false;
  if (item.source === 'recipe' && !item.itemSlug.startsWith('spoonacular-')) return false;
  return true;
}

export function FavoritesPage() {
  const { data: items = [], isLoading } = useFavorites();
  const toggle = useToggleFavorite();

  const handleRemove = (item: FavoriteItem) => {
    toggle.mutate({ slug: item.itemSlug, source: item.source, title: item.title });
  };

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Mes favoris</h1>
        <p className="text-sm text-zinc-500 mt-1">{items.length} tuto{items.length !== 1 ? 's' : ''} sauvegardé{items.length !== 1 ? 's' : ''}</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4 text-2xl">
            🔖
          </div>
          <p className="text-zinc-500 text-sm">Aucun favori pour l'instant.</p>
          <p className="text-zinc-400 text-xs mt-1">Clique sur le signet 🔖 d'un tutoriel pour le sauvegarder.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-violet-600 hover:text-violet-800 font-medium">
            Explorer les tutoriels →
          </Link>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const href  = itemLink(item);
            const ext   = isExternal(item);
            const color = SOURCE_COLOR[item.source] ?? 'bg-zinc-100 text-zinc-600 ring-zinc-600/20';
            const label = SOURCE_LABEL[item.source] ?? item.source;
            const date  = new Date(item.savedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

            return (
              <li key={item.id} className="flex items-center gap-4 bg-white rounded-2xl border border-zinc-200 p-4 hover:border-zinc-300 transition-all">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.title} className="w-16 h-12 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-zinc-100 shrink-0 flex items-center justify-center text-lg">
                    🔖
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${color}`}>
                      {label}
                    </span>
                    <span className="text-xs text-zinc-400">{date}</span>
                  </div>
                  {ext ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-zinc-900 hover:text-violet-700 line-clamp-1 transition-colors">
                      {item.title}
                    </a>
                  ) : (
                    <Link to={href} className="text-sm font-medium text-zinc-900 hover:text-violet-700 line-clamp-1 transition-colors">
                      {item.title}
                    </Link>
                  )}
                </div>

                <button
                  onClick={() => handleRemove(item)}
                  disabled={toggle.isPending}
                  title="Retirer des favoris"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-all shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
