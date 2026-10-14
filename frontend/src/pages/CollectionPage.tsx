import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collectionsApi, collectionPath } from '../api/collections';
import { ShareButton } from '../components/collections/ShareButton';
import { Seo } from '../seo/Seo';
import { absoluteUrl, tutorialPath } from '../seo/url';

export function CollectionPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const { data: c, isLoading, isError } = useQuery({ queryKey: ['collection', slug], queryFn: () => collectionsApi.get(slug), enabled: !!slug, retry: false });

  const setPublic = useMutation({
    mutationFn: (pub: boolean) => collectionsApi.update(c!.id, { public: pub }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection', slug] }),
  });
  const removeItem = useMutation({
    mutationFn: (tid: number) => collectionsApi.removeTutorial(c!.id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection', slug] }),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16 space-y-3" aria-busy="true" aria-label="Chargement">
        <div className="h-8 w-2/3 rounded bg-zinc-100 animate-pulse" />
        {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-zinc-100 animate-pulse" />)}
      </div>
    );
  }
  if (isError || !c) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16 text-center">
        <Seo title="Collection introuvable" description="Cette collection n'existe pas ou est privée." canonical={collectionPath(slug)} noindex />
        <p className="text-zinc-500">Collection introuvable ou privée.</p>
        <Link to="/tutorials" className="mt-4 inline-block text-violet-600 hover:underline">← Explorer les tutoriels</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 pb-16">
      <Seo
        title={`Collection : ${c.title}`}
        description={c.description ?? `${c.count} tutoriels sélectionnés par ${c.owner ?? 'un membre'} sur YourTuto.`}
        canonical={collectionPath(c.slug)}
        noindex={!c.public}
        jsonLd={[{
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.title, url: absoluteUrl(collectionPath(c.slug)),
          hasPart: c.tutorials.map((t) => ({ '@type': 'LearningResource', name: t.title, url: absoluteUrl(tutorialPath(t)) })),
        }]}
      />
      <section className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 text-white">
        <div className="max-w-3xl mx-auto px-5 py-10">
          <p className="text-sm text-violet-200">Collection{c.owner ? ` de ${c.owner}` : ''} · {c.count} tutoriel{c.count > 1 ? 's' : ''}</p>
          <h1 className="mt-2 text-3xl font-bold break-words">{c.title}</h1>
          {c.description && <p className="mt-2 text-violet-100">{c.description}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {c.public && <ShareButton path={collectionPath(c.slug)} title={c.title} className="bg-white text-violet-700 hover:bg-violet-50" />}
            {c.isOwner && (
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={c.public} onChange={(e) => setPublic.mutate(e.target.checked)} className="accent-white" />
                Collection publique (partageable)
              </label>
            )}
          </div>
        </div>
      </section>
      <ol className="max-w-3xl mx-auto px-5 mt-8 space-y-3">
        {c.tutorials.map((t, i) => (
          <li key={t.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
            <span className="w-6 text-center text-sm font-bold text-zinc-300" aria-hidden="true">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <Link to={tutorialPath(t)} className="font-semibold text-zinc-900 hover:text-violet-700 line-clamp-2">{t.title}</Link>
              {t.difficulty && <p className="text-xs text-zinc-400">{t.difficulty}</p>}
            </div>
            {c.isOwner && (
              <button type="button" onClick={() => removeItem.mutate(t.id)} aria-label={`Retirer ${t.title}`} className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">×</button>
            )}
          </li>
        ))}
        {c.tutorials.length === 0 && <li className="text-center text-sm text-zinc-400">Collection vide. Ajoute des tutos depuis leur page avec « 📚 Collection ».</li>}
      </ol>
    </main>
  );
}
