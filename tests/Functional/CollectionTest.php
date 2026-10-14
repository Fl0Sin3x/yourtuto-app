<?php

namespace App\Tests\Functional;

use App\Entity\Tutorial;
use App\Enum\TutorialSource;

final class CollectionTest extends DatabaseWebTestCase
{
    private function tuto(string $title): Tutorial
    {
        $t = (new Tutorial())->setTitle($title)->setSlug(strtolower(str_replace(' ', '-', $title)))->setSource(TutorialSource::Dev)->setPublished(true);
        $this->em->persist($t);
        $this->em->flush();

        return $t;
    }

    public function testCreateAddShareFlow(): void
    {
        $a = $this->tuto('Alpha guide');
        $b = $this->tuto('Beta guide');
        $token = $this->registerAndLogin('col@example.com');

        $c = $this->jsonRequest('POST', '/api/collections', ['title' => 'Mes favoris Docker', 'tutorialId' => $b->getId()], $token);
        self::assertResponseStatusCodeSame(201);
        self::assertMatchesRegularExpression('/^mes-favoris-docker-[0-9a-f]{6}$/', $c['slug']);
        self::assertFalse($c['public']);

        $this->jsonRequest('POST', '/api/collections/' . $c['id'] . '/tutorials', ['tutorialId' => $a->getId()], $token);
        self::assertResponseIsSuccessful();

        // private: hidden from anonymous visitors, visible to owner
        $this->jsonRequest('GET', '/api/c/' . $c['slug']);
        self::assertResponseStatusCodeSame(404);
        $own = $this->jsonRequest('GET', '/api/c/' . $c['slug'], token: $token);
        self::assertTrue($own['isOwner']);
        self::assertSame(['Beta guide', 'Alpha guide'], array_column($own['tutorials'], 'title'));

        $this->jsonRequest('PATCH', '/api/collections/' . $c['id'], ['public' => true], $token);
        $pub = $this->jsonRequest('GET', '/api/c/' . $c['slug']);
        self::assertResponseIsSuccessful();
        self::assertFalse($pub['isOwner']);
        self::assertSame(2, $pub['count']);

        // SSR-lite head + sitemap
        $crawler = $this->client->request('GET', '/c/' . $c['slug']);
        self::assertResponseIsSuccessful();
        self::assertSame('Collection : Mes favoris Docker · YourTuto', $crawler->filter('title')->text());
        $this->client->request('GET', '/sitemap.xml');
        self::assertStringContainsString('/c/' . $c['slug'], (string) $this->client->getResponse()->getContent());

        $mine = $this->jsonRequest('GET', '/api/collections', token: $token);
        self::assertCount(1, $mine);
    }

    public function testOtherUsersCannotEditAndAnonymousIsRejected(): void
    {
        $owner = $this->registerAndLogin('owner@example.com');
        $c = $this->jsonRequest('POST', '/api/collections', ['title' => 'Privée'], $owner);
        $intruder = $this->registerAndLogin('intruder@example.com');

        $this->jsonRequest('PATCH', '/api/collections/' . $c['id'], ['public' => true], $intruder);
        self::assertResponseStatusCodeSame(404);
        $this->jsonRequest('DELETE', '/api/collections/' . $c['id'], [], $intruder);
        self::assertResponseStatusCodeSame(404);
        $this->jsonRequest('POST', '/api/collections', ['title' => 'x']);
        self::assertResponseStatusCodeSame(401);
        $this->jsonRequest('POST', '/api/collections', ['title' => ''], $owner);
        self::assertResponseStatusCodeSame(422);
    }
}
