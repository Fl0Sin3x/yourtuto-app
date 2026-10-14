import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collectionsApi, collectionPath } from '../api/collections';
import { Seo } from '../seo/Seo';

export function MyCollectionsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const { data = [], isLoading } = useQuery({ queryKey: ['collections'], queryFn: collectionsApi.mine });
  const refresh = () => qc.invalidateQueries({ queryKey: ['collections'] });
  const create = useMutation({ mutationFn: () => collectionsApi.create({ title: title.trim() }), onSuccess: () => { setTitle(''); refresh(); } });
  const remove = useMutation({ mutationFn: collectionsApi.remove, onSuccess: refresh });

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <Seo title="Mes collections" description="Tes collections de tutoriels." canonical="/collections" noindex />
      <h1 className="text-2xl font-bold text-zinc-900">Mes collections</h1>
      <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }}>
        <label htmlFor="col-title" className="sr-only">Titre de la collection</label>
        <input id="col-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex. : Kubernetes du zéro" className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 focus:border-violet-400 focus:outline-none" />
        <button type="submit" disabled={!title.trim()} className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Créer</button>
      </form>
      {isLoading ? (
        <div className="mt-6 space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-16 rounded-2xl bg-zinc-100 animate-pulse" />)}</div>
      ) : (
        <ul className="mt-6 space-y-3">
          {data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
              <div className="min-w-0 flex-1">
                <Link to={collectionPath(c.slug)} className="font-semibold text-zinc-900 hover:text-violet-700">{c.title}</Link>
                <p className="text-xs text-zinc-400">{c.count} tuto{c.count > 1 ? 's' : ''} · {c.public ? 'publique' : 'privée'}</p>
              </div>
              <button type="button" onClick={() => { if (confirm(`Supprimer « ${c.title} » ?`)) remove.mutate(c.id); }} aria-label={`Supprimer ${c.title}`} className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-red-50 hover:text-red-600">Supprimer</button>
            </li>
          ))}
          {data.length === 0 && <li className="text-sm text-zinc-400">Aucune collection. Crée-en une, puis ajoute des tutos depuis leur page.</li>}
        </ul>
      )}
    </main>
  );
}
