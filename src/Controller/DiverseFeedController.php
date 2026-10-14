<?php

namespace App\Controller;

use App\Enum\TutorialSource;
use App\Repository\TutorialRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

#[Route('/api/diverse-feed', name: 'api_tutorials_diverse', methods: ['GET'])]
class DiverseFeedController extends AbstractController
{
    private const PER_SOURCE = 8;
    private const TTL        = 300; // 5 min

    public function __construct(
        private readonly TutorialRepository  $repo,
        private readonly SerializerInterface $serializer,
        private readonly CacheInterface      $cache,
    ) {}

    public function __invoke(): JsonResponse
    {
        $sources = [
            TutorialSource::Community->value,
            TutorialSource::Recipe->value,
            TutorialSource::Generated->value,
            TutorialSource::Dev->value,
            TutorialSource::Instructables->value,
            TutorialSource::YouTube->value,
            TutorialSource::DevTo->value,
            TutorialSource::Reddit->value,
            TutorialSource::Medium->value,
        ];

        try {
            $payload = $this->cache->get('diverse_feed', function (ItemInterface $item) use ($sources): array {
                $item->expiresAfter(self::TTL);
                return $this->buildPayload($sources);
            });
        } catch (\Throwable) {
            // Cache unavailable — compute directly, never return 500
            $payload = $this->buildPayload($sources);
        }

        shuffle($payload['member']);

        $response = new JsonResponse($payload);
        $response->setPublic()->setMaxAge(60)->setSharedMaxAge(60);

        return $response;
    }

    private function buildPayload(array $sources): array
    {
        $all = [];
        foreach ($sources as $source) {
            $items = $this->repo->findPublishedBySource($source, self::PER_SOURCE);
            $all = array_merge($all, $items);
        }

        shuffle($all);

        $json = $this->serializer->serialize($all, 'json', ['groups' => ['tutorial:list']]);

        return ['member' => json_decode($json, true), 'totalItems' => count($all)];
    }
}
