import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pathsApi } from '../api/paths';
import { ProgressBar } from '../components/paths/ProgressBar';
import { Seo } from '../seo/Seo';

export function LearningPathsPage() {
  const { data: paths = [], isLoading, isError } = useQuery({ queryKey: ['paths'], queryFn: pathsApi.list });

  return (
    <main className="min-h-screen bg-zinc-50">
      <Seo
        title="Parcours d'apprentissage"
        description="Des parcours guidés, étape par étape, pour apprendre l'IA, le frontend, le backend et les outils du développeur."
        canonical="/paths"
      />
      <section className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 text-white">
        <div className="max-w-5xl mx-auto px-5 py-12">
          <p className="text-violet-300 text-xs font-semibold uppercase tracking-widest mb-2">Parcours</p>
          <h1 className="text-3xl sm:text-4xl font-bold">Apprends étape par étape</h1>
          <p className="mt-3 max-w-2xl text-violet-100">Des parcours guidés et ordonnés du débutant à l'avancé, avec ta progression sauvegardée.</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 -mt-6 pb-16">
        {isError && <p role="alert" className="bg-white rounded-2xl p-6 text-red-600">Impossible de charger les parcours.</p>}
        <ul className="grid gap-4 sm:grid-cols-2">
          {isLoading && Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-40 rounded-2xl bg-white border border-zinc-200 animate-pulse" aria-hidden="true" />
          ))}
          {paths.map((p) => (
            <li key={p.slug}>
              <Link
                to={`/paths/${p.slug}`}
                className="block h-full rounded-2xl bg-white border border-zinc-200 p-5 shadow-sm hover:shadow-lg hover:border-violet-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl" aria-hidden="true">{p.icon ?? '📘'}</span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-zinc-900">{p.title}</h2>
                    {p.description && <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{p.description}</p>}
                  </div>
                </div>
                <div className="mt-4">
                  <ProgressBar percent={p.percent} label={`Progression ${p.title}`} />
                  <p className="mt-2 text-xs text-zinc-500">{p.completed}/{p.stepCount} étapes · {p.percent}%</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {!isLoading && !isError && paths.length === 0 && (
          <p className="bg-white rounded-2xl p-6 text-zinc-500">Aucun parcours pour le moment.</p>
        )}
      </div>
    </main>
  );
}
