import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

interface Summary {
  points: string[];
  source: 'ai' | 'extractive';
  cached: boolean;
}

/** TL;DR box: AI summary when enabled server-side, otherwise an extractive outline. */
export function SummaryCard({ tutorialId }: { tutorialId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tutorial-summary', tutorialId],
    queryFn: async () => (await apiClient.get<Summary>(`/api/tutorials/${tutorialId}/summary`)).data,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return <div className="my-6 h-24 rounded-2xl bg-violet-50 animate-pulse" aria-hidden="true" />;
  }
  if (!data || data.points.length < 2) return null;

  return (
    <aside className="my-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-5" aria-labelledby="tldr-title">
      <h2 id="tldr-title" className="flex items-center gap-2 text-sm font-semibold text-violet-800">
        <span aria-hidden="true">{data.source === 'ai' ? '✨' : '🧭'}</span>
        {data.source === 'ai' ? 'En bref (résumé IA)' : 'Au programme'}
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-zinc-700 list-disc pl-5">
        {data.points.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </aside>
  );
}
