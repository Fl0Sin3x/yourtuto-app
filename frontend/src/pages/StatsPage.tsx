import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statsApi, type LabelCount } from '../api/stats';
import { Seo } from '../seo/Seo';
import { tutorialPath } from '../seo/url';

const SOURCE_LABELS: Record<string, string> = {
  community: 'Communauté', youtube: 'YouTube', devto: 'DEV.to', reddit: 'Reddit', medium: 'Medium',
  recipe: 'Recettes', instructables: 'Instructables', generated: 'Générés', dev: 'Dev',
};
const nf = new Intl.NumberFormat('fr-FR');

function Bars({ title, rows, labels = {} }: { title: string; rows: LabelCount[]; labels?: Record<string, string> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200" aria-labelledby={`h-${title}`}>
      <h2 id={`h-${title}`} className="text-sm font-semibold text-zinc-900">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="text-sm">
            <div className="flex justify-between text-zinc-600"><span className="truncate">{labels[r.label] ?? r.label}</span><span className="tabular-nums">{nf.format(r.count)}</span></div>
            <div className="mt-1 h-2 rounded-full bg-zinc-100" aria-hidden="true">
              <div className="h-2 rounded-full bg-violet-500" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatsPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['stats-overview'], queryFn: statsApi.overview, staleTime: 10 * 60 * 1000 });

  const kpis = data ? [
    ['Tutoriels', data.totals.tutorials], ['Nouveaux (7 j)', data.totals.newThisWeek], ['Vues', data.totals.views],
    ['Parcours', data.totals.paths], ['Collections publiques', data.totals.publicCollections], ['Apprenants actifs', data.totals.learners],
    ['Tutos terminés (7 j)', data.totals.completionsWeek],
  ] as const : [];

  return (
    <main className="max-w-6xl mx-auto px-5 py-10">
      <Seo title="YourTuto en chiffres" description="Statistiques du catalogue YourTuto : sources, niveaux, tags populaires et activité." canonical="/stats" />
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">YourTuto en chiffres</h1>
      <p className="mt-1 text-sm text-zinc-500">Le catalogue et la communauté, mis à jour toutes les heures.</p>

      {isLoading && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4" role="status" aria-busy="true">
          <span className="sr-only">Chargement…</span>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 rounded-2xl bg-zinc-100 animate-pulse" />)}
        </div>
      )}
      {isError && <p className="mt-8 text-zinc-500">Statistiques indisponibles pour le moment.</p>}

      {data && (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {kpis.map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-zinc-900 tabular-nums">{nf.format(value)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Bars title="Par source" rows={data.bySource} labels={SOURCE_LABELS} />
            <Bars title="Par niveau" rows={data.byDifficulty} />
            <Bars title="Tags populaires" rows={data.topTags} />
          </div>
          <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
            <h2 className="text-sm font-semibold text-zinc-900">Les plus vus</h2>
            <ol className="mt-3 divide-y divide-zinc-100">
              {data.mostViewed.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-5 text-zinc-300 font-bold">{i + 1}</span>
                  <Link to={tutorialPath(t)} className="flex-1 truncate text-zinc-800 hover:text-violet-700">{t.title}</Link>
                  <span className="tabular-nums text-zinc-400">{nf.format(t.viewCount)} vues</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
