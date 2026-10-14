<?php

namespace App\Tests\Functional;

use App\Entity\Tag;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;

final class CatalogStatsTest extends DatabaseWebTestCase
{
    public function testOverviewAggregatesPublishedCatalogue(): void
    {
        $tag = (new Tag())->setName('docker')->setSlug('docker');
        $this->em->persist($tag);
        $rows = [['A', TutorialSource::Dev, 'beginner', true], ['B', TutorialSource::Dev, 'advanced', true], ['C', TutorialSource::YouTube, null, true], ['Hidden', TutorialSource::Dev, null, false]];
        foreach ($rows as $i => [$title, $src, $diff, $pub]) {
            $t = (new Tutorial())->setTitle($title)->setSlug('s' . $i)->setSource($src)->setDifficulty($diff)->setPublished($pub)->addTag($tag);
            for ($v = 0; $v < $i + 1; ++$v) {
                $t->incrementViewCount();
            }
            $this->em->persist($t);
        }
        $this->em->flush();

        $data = $this->jsonRequest('GET', '/api/stats/overview');
        self::assertResponseIsSuccessful();
        self::assertSame(3, $data['totals']['tutorials']);
        self::assertSame(3, $data['totals']['newThisWeek']);
        self::assertSame(6, $data['totals']['views']);
        self::assertSame(['label' => 'dev', 'count' => 2], $data['bySource'][0]);
        self::assertSame([['label' => 'docker', 'count' => 3]], $data['topTags']);
        self::assertSame('C', $data['mostViewed'][0]['title']);
        self::assertContains(['label' => 'non précisé', 'count' => 1], $data['byDifficulty']);

        $crawler = $this->client->request('GET', '/stats');
        self::assertResponseIsSuccessful();
        self::assertSame('YourTuto en chiffres · Statistiques du catalogue', $crawler->filter('title')->text());
    }
}
