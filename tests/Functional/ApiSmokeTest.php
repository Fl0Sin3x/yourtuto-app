<?php

namespace App\Tests\Functional;

use PHPUnit\Framework\Attributes\DataProvider;

final class ApiSmokeTest extends DatabaseWebTestCase
{
    public static function publicEndpoints(): iterable
    {
        yield 'api entrypoint' => ['/api'];
        yield 'tutorials'      => ['/api/tutorials'];
        yield 'categories'     => ['/api/categories'];
    }

    #[DataProvider('publicEndpoints')]
    public function testPublicEndpointsRespond(string $uri): void
    {
        $this->jsonRequest('GET', $uri);
        self::assertResponseIsSuccessful();
        self::assertStringStartsWith(
            'application/ld+json',
            (string) $this->client->getResponse()->headers->get('content-type'),
        );
    }

    public function testAdminRedirectsAnonymousUsersToLogin(): void
    {
        $this->client->request('GET', '/admin');
        self::assertResponseRedirects();
    }
}
