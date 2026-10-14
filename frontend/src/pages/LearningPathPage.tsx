import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pathsApi } from '../api/paths';
import { ProgressBar } from '../components/paths/ProgressBar';
import { Seo } from '../seo/Seo';
import { absoluteUrl, tutorialPath } from '../seo/url';
import { useAuthStore } from '../store/authStore';

export function LearningPathPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuthStore();
  const { data: path, isLoading, isError } = useQuery({ queryKey: ['path', slug], queryFn: () => pathsApi.get(slug), enabled: !!slug });

  if (isLoading) {
    return <div className="max-w-3xl mx-auto px-5 py-16" aria-busy="true"><div className="h-8 w-2/3 bg-zinc-100 rounded animate-pulse" /></div>;
  }
  if (isError || !path) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16 text-center">
        <Seo title="Parcours introuvable" description="Ce parcours n'existe pas." canonical={`/paths/${slug}`} noindex />
        <p className="text-zinc-500">Parcours introuvable.</p>
        <Link to="/paths" className="mt-4 inline-block text-violet-600 hover:underline">← Tous les parcours</Link>
      </div>
    );
  }

  const next = path.steps.find((s) => s.id === path.nextStepId);

  return (
    <main className="min-h-screen bg-zinc-50 pb-16">
      <Seo
        title={`Parcours : ${path.title}`}
        description={path.description ?? `Parcours en ${path.stepCount} étapes.`}
        canonical={`/paths/${path.slug}`}
        jsonLd={[{
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: path.title,
          description: path.description ?? '',
          url: absoluteUrl(`/paths/${path.slug}`),
          provider: { '@type': 'Organization', name: 'YourTuto', url: absoluteUrl('/') },
          hasPart: path.steps.map((s) => ({ '@type': 'LearningResource', name: s.title, url: absoluteUrl(tutorialPath(s)) })),
        }]}
      />
      <section className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 text-white">
        <div className="max-w-3xl mx-auto px-5 py-10">
          <Link to="/paths" className="text-sm text-violet-200 hover:text-white">← Parcours</Link>
          <h1 className="mt-3 text-3xl font-bold flex items-center gap-3"><span aria-hidden="true">{path.icon}</span>{path.title}</h1>
          {path.description && <p className="mt-2 text-violet-100">{path.description}</p>}
          <div className="mt-6 max-w-md">
            <ProgressBar percent={path.percent} label="Progression du parcours" />
            <p className="mt-2 text-sm text-violet-100">{path.completed}/{path.stepCount} étapes terminées</p>
          </div>
          {next && (
            <Link to={tutorialPath(next)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
              {path.completed === 0 ? 'Commencer' : 'Continuer'} : {next.title} →
            </Link>
          )}
          {!isAuthenticated() && <p className="mt-4 text-xs text-violet-200"><Link to="/login" className="underline">Connecte-toi</Link> pour sauvegarder ta progression.</p>}
        </div>
      </section>

      <ol className="max-w-3xl mx-auto px-5 -mt-4 space-y-3">
        {path.steps.map((s, i) => (
          <li key={s.id}>
            <Link
              to={tutorialPath(s)}
              className="flex items-center gap-4 rounded-2xl bg-white border border-zinc-200 p-4 shadow-sm hover:border-violet-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? 'bg-emerald-500 text-white' : 'bg-violet-100 text-violet-700'}`}
                aria-label={s.done ? 'Terminé' : `Étape ${i + 1}`}
              >
                {s.done ? '✓' : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-zinc-900">{s.title}</span>
                <span className="block text-xs text-zinc-500">{[s.difficulty, s.duration].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
