export interface HeatmapDay {
  date: string;
  count: number;
}

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

const LEVEL_CLASS = ['bg-zinc-100', 'bg-violet-200', 'bg-violet-400', 'bg-violet-600'];

/** GitHub-style activity grid: one column per week, oldest on the left. */
export function ActivityHeatmap({ days }: { days: HeatmapDay[] }) {
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const total = days.reduce((s, d) => s + d.count, 0);

  return (
    <figure aria-label={`Activité des ${days.length} derniers jours : ${total} tutoriels`}>
      <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-hidden="true">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((d) => (
              <div
                key={d.date}
                data-testid="heatmap-cell"
                data-level={level(d.count)}
                title={`${d.date} : ${d.count}`}
                className={`w-3 h-3 rounded-sm ${LEVEL_CLASS[level(d.count)]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-zinc-400">{total} tutoriels sur {Math.round(days.length / 7)} semaines</figcaption>
    </figure>
  );
}
