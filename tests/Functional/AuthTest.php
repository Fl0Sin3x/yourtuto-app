<?php

namespace App\Tests\Functional;

final class AuthTest extends DatabaseWebTestCase
{
    public function testMeRequiresAuthentication(): void
    {
        $this->jsonRequest('GET', '/api/me');
        self::assertResponseStatusCodeSame(401);
    }

    public function testRegisterLoginAndFetchProfile(): void
    {
        $token = $this->registerAndLogin('alice@example.com');

        $me = $this->jsonRequest('GET', '/api/me', token: $token);
        self::assertResponseIsSuccessful();
        self::assertSame('alice@example.com', $me['email'] ?? null);
    }

    public function testLoginFailsWithWrongPassword(): void
    {
        $this->registerAndLogin('bob@example.com');

        $this->jsonRequest('POST', '/api/login', ['email' => 'bob@example.com', 'password' => 'wrong-password']);
        self::assertResponseStatusCodeSame(401);
    }

    public function testDuplicateEmailIsRejected(): void
    {
        $this->registerAndLogin('dup@example.com');

        $this->jsonRequest('POST', '/api/register', ['email' => 'dup@example.com', 'username' => 'other', 'password' => 'Str0ng!Passw0rd']);
        $status = $this->client->getResponse()->getStatusCode();
        self::assertGreaterThanOrEqual(400, $status);
        self::assertLessThan(500, $status);
    }
}
