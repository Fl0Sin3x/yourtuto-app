<?php

namespace App\Tests\Functional;

use App\Entity\Tutorial;
use App\Enum\TutorialSource;

final class SeoTest extends DatabaseWebTestCase
{
    private function tutorial(string $title, TutorialSource $source = TutorialSource::Community, bool $published = true): Tutorial
    {
        $t = (new Tutorial())
            ->setTitle($title)
            ->setSlug(trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($title)), '-'))
            ->setDescription('Description of ' . $title)
            ->setSource($source)
            ->setPublished($published);
        $this->em->persist($t);
        $this->em->flush();

        return $t;
    }

    public function testRobotsTxtPointsToSitemap(): void
    {
        $this->client->request('GET', '/robots.txt');

        self::assertResponseIsSuccessful();
        $body = (string) $this->client->getResponse()->getContent();
        self::assertStringContainsString('Sitemap: https://yourtuto.test/sitemap.xml', $body);
        self::assertStringContainsString('Disallow: /api/', $body);
    }

    public function testSitemapListsInternalPublishedTutorialsOnly(): void
    {
        $visible  = $this->tutorial('Visible tuto');
        $this->tutorial('Draft tuto', published: false);
        $this->tutorial('Youtube video', TutorialSource::YouTube);

        $this->client->request('GET', '/sitemap.xml');

        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('content-type', 'application/xml; charset=UTF-8');
        $xml = simplexml_load_string((string) $this->client->getResponse()->getContent());
        self::assertNotFalse($xml);
        $locs = array_map('strval', iterator_to_array($xml->url->loc ? $xml->xpath('//*[local-name()="loc"]') : []));

        self::assertContains('https://yourtuto.test/', $locs);
        self::assertContains('https://yourtuto.test/category/dev', $locs);
        self::assertContains('https://yourtuto.test/tutorials/' . $visible->getId() . '/visible-tuto', $locs);
        self::assertCount(0, array_filter($locs, fn ($l) => str_contains($l, 'draft-tuto') || str_contains($l, 'youtube-video')));
    }

    public function testTutorialPageHasServerRenderedHeadTags(): void
    {
        $t = $this->tutorial('Learn <Symfony> fast');
        $path = '/tutorials/' . $t->getId() . '/' . $t->getSlug();

        $crawler = $this->client->request('GET', $path);

        self::assertResponseIsSuccessful();
        self::assertSame('Learn <Symfony> fast · YourTuto', $crawler->filter('title')->text());
        self::assertSame('https://yourtuto.test' . $path, $crawler->filter('link[rel="canonical"]')->attr('href'));
        self::assertSame('article', $crawler->filter('meta[property="og:type"]')->attr('content'));
        // HTML tags are stripped from descriptions
        self::assertSame('Description of Learn fast', $crawler->filter('meta[name="description"]')->attr('content'));

        $jsonLd = json_decode($crawler->filter('script[type="application/ld+json"]')->first()->text(), true);
        self::assertSame('Article', $jsonLd['@type']);
        self::assertStringNotContainsString('<Symfony>', $crawler->filter('script[type="application/ld+json"]')->first()->html());
    }

    public function testTutorialWithoutSlugRedirectsToCleanUrl(): void
    {
        $t = $this->tutorial('Clean url');

        $this->client->request('GET', '/tutorials/' . $t->getId());
        self::assertResponseRedirects('/tutorials/' . $t->getId() . '/clean-url', 301);

        $this->client->request('GET', '/tutorials/' . $t->getId() . '/old-slug');
        self::assertResponseRedirects('/tutorials/' . $t->getId() . '/clean-url', 301);
    }

    public function testUnpublishedAndMissingTutorialsAreNotIndexable(): void
    {
        $draft = $this->tutorial('Hidden draft', published: false);
        $this->client->request('GET', '/tutorials/' . $draft->getId() . '/hidden-draft');
        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('x-robots-tag', 'noindex');

        $this->client->request('GET', '/tutorials/999999');
        self::assertResponseStatusCodeSame(404);
    }

    public function testCategoryPagesHaveUniqueTitles(): void
    {
        $dev = $this->client->request('GET', '/category/dev')->filter('title')->text();
        $recipe = $this->client->request('GET', '/category/recipe')->filter('title')->text();

        self::assertSame('Tutoriels Développement · YourTuto', $dev);
        self::assertNotSame($dev, $recipe);

        $this->client->request('GET', '/category/unknown');
        self::assertResponseStatusCodeSame(404);
    }
}
