<?php

namespace App\Tests\Unit;

use App\Entity\User;
use App\Repository\TutorialRepository;
use App\Repository\UserProgressRepository;
use App\Service\RecommendationService;
use PHPUnit\Framework\TestCase;

final class RecommendationServiceTest extends TestCase
{
    public function testServiceCanBeBuiltWithoutApiKey(): void
    {
        $service = new RecommendationService(
            $this->createStub(TutorialRepository::class),
            $this->createStub(UserProgressRepository::class),
            null,
        );

        $result = $service->getRecommendations(new User());

        self::assertIsArray($result);
    }
}
