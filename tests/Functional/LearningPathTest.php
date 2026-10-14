<?php

namespace App\Tests\Functional;

use App\Entity\LearningPath;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;

final class LearningPathTest extends DatabaseWebTestCase
{
    /** @return list<Tutorial> */
    private function seedPath(): array
    {
        $tutos = [];
        foreach (['Step one', 'Step two', 'Step three'] as $i => $title) {
            $t = (new Tutorial())->setTitle($title)->setSlug('step-' . $i)->setSource(TutorialSource::Dev)->setPublished(true);
            $this->em->persist($t);
            $tutos[] = $t;
        }
        $this->em->flush();

        $path = (new LearningPath('my-path', 'My path'))->setTutorialIds([$tutos[2]->getId(), $tutos[0]->getId(), $tutos[1]->getId()]);
        $hidden = (new LearningPath('hidden', 'Hidden'))->setPublished(false);
        $this->em->persist($path);
        $this->em->persist($hidden);
        $this->em->flush();

        return $tutos;
    }

    public function testListOnlyShowsPublishedPaths(): void
    {
        $this->seedPath();
        $data = $this->jsonRequest('GET', '/api/paths');

        self::assertResponseIsSuccessful();
        self::assertSame(['my-path'], array_column($data, 'slug'));
        self::assertSame(3, $data[0]['stepCount']);
        self::assertSame(0, $data[0]['percent']);
    }

    public function testStepsKeepCuratedOrderAndTrackProgress(): void
    {
        $tutos = $this->seedPath();
        $token = $this->registerAndLogin('path@example.com');

        $this->jsonRequest('POST', '/api/progress/toggle', ['slug' => (string) $tutos[2]->getId(), 'source' => 'dev', 'title' => 'Step three'], $token);

        $data = $this->jsonRequest('GET', '/api/paths/my-path', token: $token);
        self::assertResponseIsSuccessful();
        self::assertSame(['Step three', 'Step one', 'Step two'], array_column($data['steps'], 'title'));
        self::assertSame([true, false, false], array_column($data['steps'], 'done'));
        self::assertSame(1, $data['completed']);
        self::assertSame(33, $data['percent']);
        self::assertSame($tutos[0]->getId(), $data['nextStepId']);

        $list = $this->jsonRequest('GET', '/api/paths', token: $token);
        self::assertSame(1, $list[0]['completed']);
    }

    public function testUnknownOrUnpublishedPathIs404(): void
    {
        $this->seedPath();
        $this->jsonRequest('GET', '/api/paths/hidden');
        self::assertResponseStatusCodeSame(404);
        $this->jsonRequest('GET', '/api/paths/nope');
        self::assertResponseStatusCodeSame(404);
    }

    public function testPathPagesAreIndexableAndInSitemap(): void
    {
        $this->seedPath();

        $crawler = $this->client->request('GET', '/paths/my-path');
        self::assertResponseIsSuccessful();
        self::assertSame('Parcours : My path · YourTuto', $crawler->filter('title')->text());
        self::assertStringContainsString('"@type":"Course"', $crawler->filter('script[type="application/ld+json"]')->first()->text());

        $this->client->request('GET', '/sitemap.xml');
        self::assertStringContainsString('https://yourtuto.test/paths/my-path', (string) $this->client->getResponse()->getContent());
        self::assertStringNotContainsString('/paths/hidden', (string) $this->client->getResponse()->getContent());
    }
}
