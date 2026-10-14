<?php

namespace App\Tests\Functional;

use App\Entity\Tag;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;

final class DiscoveryTest extends DatabaseWebTestCase
{
    public function testRelatedReturnsDistinctRankedTutorials(): void
    {
        $tag = (new Tag())->setName('docker')->setSlug('docker');
        $this->em->persist($tag);
        $base = (new Tutorial())->setTitle('Docker pour débutants')->setSlug('docker-base')->setSource(TutorialSource::Dev)->setPublished(true)->addTag($tag);
        $match = (new Tutorial())->setTitle('Docker Compose en pratique')->setSlug('compose')->setSource(TutorialSource::Dev)->setPublished(true)->addTag($tag);
        $other = (new Tutorial())->setTitle('Recette de pâtes')->setSlug('pates')->setSource(TutorialSource::Recipe)->setPublished(true);
        foreach ([$base, $match, $other] as $t) {
            $this->em->persist($t);
        }
        $this->em->flush();

        $data = $this->jsonRequest('GET', '/api/tutorials/' . $base->getId() . '/related');
        self::assertResponseIsSuccessful();
        self::assertSame(['Docker Compose en pratique'], array_column($data, 'title'));
        self::assertStringContainsString('max-age=300', (string) $this->client->getResponse()->headers->get('Cache-Control'));

    }

    public function testDifficultyFilter(): void
    {
        foreach (['beginner', 'advanced'] as $d) {
            $this->em->persist((new Tutorial())->setTitle("T $d")->setSlug("t-$d")->setDifficulty($d)->setPublished(true));
        }
        $this->em->flush();

        $data = $this->jsonRequest('GET', '/api/tutorials?difficulty=advanced');
        self::assertResponseIsSuccessful();
        self::assertSame(['T advanced'], array_column($data['member'], 'title'));
    }
}
