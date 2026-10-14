import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collectionsApi } from '../../api/collections';
import { useAuthStore } from '../../store/authStore';

/** "Save to collection" popover for a tutorial detail page. */
export function AddToCollection({ tutorialId }: { tutorialId: number }) {
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const authed = isAuthenticated();

  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: collectionsApi.mine, enabled: authed && open });
  const refresh = () => qc.invalidateQueries({ queryKey: ['collections'] });

  const toggle = useMutation({
    mutationFn: ({ id, inside }: { id: number; inside: boolean }) =>
      inside ? collectionsApi.removeTutorial(id, tutorialId) : collectionsApi.addTutorial(id, tutorialId),
    onSuccess: refresh,
  });
  const create = useMutation({
    mutationFn: () => collectionsApi.create({ title: title.trim(), tutorialId }),
    onSuccess: () => { setTitle(''); refresh(); },
  });

  if (!authed) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:ring-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <span aria-hidden="true">📚</span> Collection
      </button>
      {open && (
        <div role="dialog" aria-label="Ajouter à une collection" className="absolute z-30 mt-2 w-72 max-w-[90vw] rounded-2xl bg-white p-3 shadow-xl ring-1 ring-zinc-200">
          <ul className="max-h-56 overflow-auto">
            {collections.map((c) => {
              const inside = c.tutorialIds.includes(tutorialId);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50">
                    <input type="checkbox" checked={inside} onChange={() => toggle.mutate({ id: c.id, inside })} className="accent-violet-600" />
                    <span className="flex-1 truncate">{c.title}</span>
                    {c.public && <span className="text-[10px] text-emerald-600">public</span>}
                  </label>
                </li>
              );
            })}
            {collections.length === 0 && <li className="px-2 py-1.5 text-xs text-zinc-400">Aucune collection pour l'instant.</li>}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }}>
            <label htmlFor="new-collection" className="sr-only">Nouvelle collection</label>
            <input id="new-collection" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Nouvelle collection…" className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none" />
            <button type="submit" disabled={!title.trim() || create.isPending} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Créer</button>
          </form>
        </div>
      )}
    </div>
  );
}
