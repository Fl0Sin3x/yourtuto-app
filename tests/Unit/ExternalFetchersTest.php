<?php

namespace App\Tests\Unit;

use App\Service\DevToFetcher;
use App\Service\SpoonacularFetcher;
use App\Service\YouTubeFetcher;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class ExternalFetchersTest extends TestCase
{
    public function testYouTubeFetcherSkipsHttpWhenKeyIsMissing(): void
    {
        $http    = new MockHttpClient(function () { self::fail('No HTTP call expected without an API key'); });
        $fetcher = new YouTubeFetcher($http, null);

        self::assertFalse($fetcher->isConfigured());
        self::assertSame([], $fetcher->search('symfony'));
        self::assertSame(0, $http->getRequestsCount());
    }

    public function testYouTubeFetcherParsesTutorialVideos(): void
    {
        $payload = ['items' => [
            ['id' => ['videoId' => 'abcdefghijk'], 'snippet' => [
                'title' => 'Symfony tutorial for beginners', 'description' => 'Learn Symfony step by step',
                'thumbnails' => ['high' => ['url' => 'https://img/x.jpg']], 'channelTitle' => 'Dev', 'publishedAt' => '2026-01-01T00:00:00Z',
            ]],
            ['id' => ['channelId' => 'not-a-video'], 'snippet' => ['title' => 'x', 'description' => '']],
        ]];
        $fetcher = new YouTubeFetcher(new MockHttpClient(new MockResponse(json_encode($payload))), 'fake-key');

        $results = $fetcher->search('symfony');

        self::assertCount(1, $results);
        self::assertSame('youtube', $results[0]['source']);
        self::assertSame('https://www.youtube.com/watch?v=abcdefghijk', $results[0]['externalUrl']);
    }

    public function testSpoonacularFetcherReturnsNothingWithoutKey(): void
    {
        $http = new MockHttpClient(function () { self::fail('No HTTP call expected without an API key'); });

        self::assertSame([], (new SpoonacularFetcher($http, ''))->search('pasta'));
    }

    public function testDevToFetcherOmitsApiKeyHeaderWhenMissing(): void
    {
        $sentHeaders = [];
        $http = new MockHttpClient(function (string $method, string $url, array $options) use (&$sentHeaders) {
            $sentHeaders = $options['headers'];

            return new MockResponse('[]');
        });

        (new DevToFetcher($http, null))->search('react');

        self::assertSame(1, $http->getRequestsCount());
        foreach ($sentHeaders as $header) {
            self::assertStringNotContainsStringIgnoringCase('api-key', $header);
        }
    }
}
