<?php

namespace App\Tests\Functional;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Boots a client and rebuilds the test database schema before each test.
 */
abstract class DatabaseWebTestCase extends WebTestCase
{
    protected KernelBrowser $client;
    protected EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->em     = static::getContainer()->get(EntityManagerInterface::class);

        $metadata = $this->em->getMetadataFactory()->getAllMetadata();
        $tool     = new SchemaTool($this->em);
        $tool->dropSchema($metadata);
        $tool->createSchema($metadata);
    }

    /** @param array<string, mixed> $body */
    protected function jsonRequest(string $method, string $uri, array $body = [], ?string $token = null): array
    {
        $headers = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/ld+json'];
        if ($token !== null) {
            $headers['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
        }
        $this->client->request($method, $uri, server: $headers, content: $body ? json_encode($body) : null);

        return json_decode((string) $this->client->getResponse()->getContent(), true) ?? [];
    }

    protected function registerAndLogin(string $email = 'jane@example.com', string $password = 'Str0ng!Passw0rd'): string
    {
        $this->jsonRequest('POST', '/api/register', ['email' => $email, 'username' => 'jane' . random_int(1, 99999), 'password' => $password]);
        self::assertResponseStatusCodeSame(201);

        $data = $this->jsonRequest('POST', '/api/login', ['email' => $email, 'password' => $password]);
        self::assertResponseIsSuccessful();
        self::assertArrayHasKey('token', $data);

        return $data['token'];
    }
}
