<?php

namespace App\Tests\Functional;

final class ProgressStatsTest extends DatabaseWebTestCase
{
    public function testStatsRequireAuth(): void
    {
        $this->jsonRequest('GET', '/api/progress/stats');
        self::assertResponseStatusCodeSame(401);
    }

    public function testCompletingItemsFeedsStreakAndHeatmap(): void
    {
        $token = $this->registerAndLogin('stats@example.com');

        $this->jsonRequest('POST', '/api/progress/toggle', ['slug' => 'a', 'source' => 'dev', 'title' => 'A'], $token);
        $this->jsonRequest('POST', '/api/progress/toggle', ['slug' => 'b', 'source' => 'youtube', 'title' => 'B'], $token);
        self::assertResponseIsSuccessful();

        $stats = $this->jsonRequest('GET', '/api/progress/stats', token: $token);
        self::assertResponseIsSuccessful();
        self::assertSame(2, $stats['total']);
        self::assertSame(1, $stats['streak']);
        self::assertTrue($stats['activeToday']);
        self::assertSame(2, end($stats['heatmap'])['count']);
        self::assertSame(['dev' => 1, 'youtube' => 1], $stats['bySource']);
        self::assertContains('first', array_column($stats['badges'], 'id'));
    }
}
