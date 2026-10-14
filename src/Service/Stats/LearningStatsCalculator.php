<?php

namespace App\Service\Stats;

/**
 * Pure computation of learning statistics from completion timestamps.
 */
final class LearningStatsCalculator
{
    /**
     * @param list<array{date: \DateTimeInterface, source: string}> $events
     *
     * @return array{total: int, streak: int, longestStreak: int, activeToday: bool, activeDays: int,
     *               last7Days: int, last30Days: int, bySource: array<string, int>, heatmap: list<array{date: string, count: int}>}
     */
    public function compute(array $events, \DateTimeImmutable $today, int $heatmapDays = 84): array
    {
        $today  = $today->setTime(0, 0);
        $perDay = [];
        $bySource = [];
        foreach ($events as $e) {
            $d = \DateTimeImmutable::createFromInterface($e['date'])->format('Y-m-d');
            $perDay[$d] = ($perDay[$d] ?? 0) + 1;
            $bySource[$e['source']] = ($bySource[$e['source']] ?? 0) + 1;
        }
        arsort($bySource);

        // Current streak: today counts if active; otherwise yesterday keeps the streak alive (grace day)
        $activeToday = isset($perDay[$today->format('Y-m-d')]);
        $cursor = $activeToday ? $today : $today->modify('-1 day');
        $streak = 0;
        while (isset($perDay[$cursor->format('Y-m-d')])) {
            $streak++;
            $cursor = $cursor->modify('-1 day');
        }

        // Longest streak over all history
        $days = array_keys($perDay);
        sort($days);
        $longest = 0;
        $run = 0;
        $prev = null;
        foreach ($days as $d) {
            $run = ($prev !== null && (new \DateTimeImmutable($prev))->modify('+1 day')->format('Y-m-d') === $d) ? $run + 1 : 1;
            $longest = max($longest, $run);
            $prev = $d;
        }

        $countSince = function (int $n) use ($perDay, $today): int {
            $sum = 0;
            for ($i = 0; $i < $n; $i++) {
                $sum += $perDay[$today->modify("-$i day")->format('Y-m-d')] ?? 0;
            }

            return $sum;
        };

        $heatmap = [];
        for ($i = $heatmapDays - 1; $i >= 0; $i--) {
            $d = $today->modify("-$i day")->format('Y-m-d');
            $heatmap[] = ['date' => $d, 'count' => $perDay[$d] ?? 0];
        }

        return [
            'total'         => count($events),
            'streak'        => $streak,
            'longestStreak' => $longest,
            'activeToday'   => $activeToday,
            'activeDays'    => count($perDay),
            'last7Days'     => $countSince(7),
            'last30Days'    => $countSince(30),
            'bySource'      => $bySource,
            'heatmap'       => $heatmap,
        ];
    }
}
