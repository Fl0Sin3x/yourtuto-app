<?php

namespace App\Tests\Unit;

use App\Service\Stats\LearningStatsCalculator;
use PHPUnit\Framework\TestCase;

final class LearningStatsCalculatorTest extends TestCase
{
    private function ev(string $date, string $source = 'dev'): array
    {
        return ['date' => new \DateTimeImmutable($date . ' 15:00'), 'source' => $source];
    }

    public function testEmptyHistory(): void
    {
        $s = (new LearningStatsCalculator())->compute([], new \DateTimeImmutable('2026-10-14'));
        self::assertSame(0, $s['total']);
        self::assertSame(0, $s['streak']);
        self::assertCount(84, $s['heatmap']);
    }

    public function testStreakCountsConsecutiveDaysIncludingToday(): void
    {
        $s = (new LearningStatsCalculator())->compute(
            [$this->ev('2026-10-14'), $this->ev('2026-10-13'), $this->ev('2026-10-12'), $this->ev('2026-10-10')],
            new \DateTimeImmutable('2026-10-14'),
        );
        self::assertSame(3, $s['streak']);
        self::assertTrue($s['activeToday']);
        self::assertSame(3, $s['longestStreak']);
    }

    public function testYesterdayKeepsStreakAlive(): void
    {
        $s = (new LearningStatsCalculator())->compute(
            [$this->ev('2026-10-13'), $this->ev('2026-10-12')],
            new \DateTimeImmutable('2026-10-14'),
        );
        self::assertSame(2, $s['streak']);
        self::assertFalse($s['activeToday']);
    }

    public function testBrokenStreakAndLongestHistoricRun(): void
    {
        $events = [];
        foreach (['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-10'] as $d) {
            $events[] = $this->ev($d, $d === '2026-10-10' ? 'youtube' : 'dev');
        }
        $s = (new LearningStatsCalculator())->compute($events, new \DateTimeImmutable('2026-10-14'));
        self::assertSame(0, $s['streak']);
        self::assertSame(4, $s['longestStreak']);
        self::assertSame(['dev' => 4, 'youtube' => 1], $s['bySource']);
        self::assertSame(1, $s['last7Days']);
        self::assertSame(5, $s['activeDays']);
    }

    public function testHeatmapEndsTodayAndCountsPerDay(): void
    {
        $s = (new LearningStatsCalculator())->compute(
            [$this->ev('2026-10-14'), $this->ev('2026-10-14')],
            new \DateTimeImmutable('2026-10-14'),
            7,
        );
        self::assertCount(7, $s['heatmap']);
        self::assertSame(['date' => '2026-10-14', 'count' => 2], end($s['heatmap']));
    }
}
