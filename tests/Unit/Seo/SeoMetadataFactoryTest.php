<?php

namespace App\Tests\Unit\Seo;

use App\Entity\Tutorial;
use App\Seo\SeoMetadataFactory;
use PHPUnit\Framework\TestCase;

final class SeoMetadataFactoryTest extends TestCase
{
    public function testUsesConfiguredBaseUrlWithoutTrailingSlash(): void
    {
        $f = new SeoMetadataFactory('https://example.org/');
        self::assertSame('https://example.org/tutorials', $f->tutorialIndex()->canonicalUrl);
        self::assertSame('https://example.org/', $f->home()->canonicalUrl);
    }

    public function testTutorialDescriptionIsPlainAndShort(): void
    {
        $t = (new Tutorial())->setTitle(str_repeat('Very long title ', 10))->setSlug('x')
            ->setContent("## Heading\n\n**Bold** text " . str_repeat('lorem ipsum ', 50));

        $meta = (new SeoMetadataFactory('https://example.org'))->tutorial($t);

        self::assertLessThanOrEqual(160, mb_strlen($meta->description));
        self::assertStringNotContainsString('#', $meta->description);
        self::assertStringNotContainsString('**', $meta->description);
        self::assertLessThanOrEqual(60 + mb_strlen(' · YourTuto'), mb_strlen($meta->title));
        self::assertFalse($meta->indexable, 'unpublished tutorials must be noindex');
    }

    public function testUnknownCategoryReturnsNull(): void
    {
        self::assertNull((new SeoMetadataFactory('https://example.org'))->category('nope'));
    }
}
