export const DIFFICULTIES = [
  { value: 'débutant', label: 'Débutant' },
  { value: 'intermédiaire', label: 'Intermédiaire' },
  { value: 'avancé', label: 'Avancé' },
] as const;

export const SORTS = [
  { value: '', label: 'Récents' },
  { value: 'popular', label: 'Populaires' },
] as const;

interface Props {
  difficulty: string;
  sort: string;
  onChange: (updates: Record<string, string>) => void;
  disabled?: boolean;
}

const chip = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
    active ? 'bg-violet-600 text-white ring-violet-600' : 'bg-white text-zinc-600 ring-zinc-200 hover:ring-violet-300'
  }`;

/** Difficulty + sort chips for the tutorial catalogue (URL-driven). */
export function DiscoveryFilters({ difficulty, sort, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6" role="toolbar" aria-label="Filtres de découverte">
      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mr-1">Niveau</span>
      {DIFFICULTIES.map((d) => (
        <button
          key={d.value}
          type="button"
          disabled={disabled}
          aria-pressed={difficulty === d.value}
          onClick={() => onChange({ difficulty: difficulty === d.value ? '' : d.value })}
          className={chip(difficulty === d.value)}
        >
          {d.label}
        </button>
      ))}
      <span className="mx-2 h-4 w-px bg-zinc-200" aria-hidden="true" />
      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mr-1">Tri</span>
      {SORTS.map((s) => (
        <button
          key={s.value || 'recent'}
          type="button"
          disabled={disabled}
          aria-pressed={sort === s.value}
          onClick={() => onChange({ sort: s.value })}
          className={chip(sort === s.value)}
        >
          {s.label}
        </button>
      ))}
      {disabled && <span className="text-xs text-zinc-400">(filtres indisponibles en recherche externe)</span>}
    </div>
  );
}
