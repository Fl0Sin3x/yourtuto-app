<?php

namespace App\Controller;

use App\Entity\TutorialCollection;
use App\Entity\User;
use App\Repository\TutorialCollectionRepository;
use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\String\Slugger\AsciiSlugger;

/**
 * Personal tutorial collections; public ones are shareable at /c/{slug}.
 */
final class CollectionController extends AbstractController
{
    public function __construct(
        private readonly TutorialCollectionRepository $collections,
        private readonly TutorialRepository $tutorials,
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('/api/collections', name: 'api_collections_mine', methods: ['GET'])]
    public function mine(): JsonResponse
    {
        $user = $this->requireUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $list = $this->collections->findBy(['owner' => $user], ['updatedAt' => 'DESC']);

        return $this->json(array_map(fn (TutorialCollection $c) => $this->summary($c), $list));
    }

    #[Route('/api/collections', name: 'api_collections_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $body  = $request->toArray();
        $title = trim((string) ($body['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 120) {
            return $this->json(['error' => 'Le titre est requis (120 caractères max).'], 422);
        }
        if ($this->collections->count(['owner' => $user]) >= 50) {
            return $this->json(['error' => 'Limite de 50 collections atteinte.'], 422);
        }

        $slug = strtolower((new AsciiSlugger())->slug(mb_substr($title, 0, 60))->toString()) . '-' . bin2hex(random_bytes(3));
        $c = (new TutorialCollection($user, trim($slug, '-'), $title))
            ->setDescription(isset($body['description']) ? mb_substr(trim((string) $body['description']), 0, 500) ?: null : null)
            ->setPublic((bool) ($body['public'] ?? false));
        if (isset($body['tutorialId'])) {
            $c->addTutorialId((int) $body['tutorialId']);
        }
        $this->em->persist($c);
        $this->em->flush();

        return $this->json($this->summary($c), 201);
    }

    #[Route('/api/collections/{id}', name: 'api_collections_update', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $c = $this->owned($id);
        if ($c instanceof JsonResponse) {
            return $c;
        }

        $body = $request->toArray();
        if (array_key_exists('title', $body)) {
            $title = trim((string) $body['title']);
            if ($title === '' || mb_strlen($title) > 120) {
                return $this->json(['error' => 'Titre invalide.'], 422);
            }
            $c->setTitle($title);
        }
        if (array_key_exists('description', $body)) {
            $c->setDescription(mb_substr(trim((string) $body['description']), 0, 500) ?: null);
        }
        if (array_key_exists('public', $body)) {
            $c->setPublic((bool) $body['public']);
        }
        if (isset($body['tutorialIds']) && is_array($body['tutorialIds'])) {
            $c->setTutorialIds($body['tutorialIds']);
        }
        $this->em->flush();

        return $this->json($this->summary($c));
    }

    #[Route('/api/collections/{id}', name: 'api_collections_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $c = $this->owned($id);
        if ($c instanceof JsonResponse) {
            return $c;
        }
        $this->em->remove($c);
        $this->em->flush();

        return new JsonResponse(null, 204);
    }

    #[Route('/api/collections/{id}/tutorials', name: 'api_collections_add', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function add(int $id, Request $request): JsonResponse
    {
        $c = $this->owned($id);
        if ($c instanceof JsonResponse) {
            return $c;
        }
        $tid = (int) ($request->toArray()['tutorialId'] ?? 0);
        if (!$this->tutorials->find($tid)) {
            return $this->json(['error' => 'Tutoriel introuvable.'], 404);
        }
        $c->addTutorialId($tid);
        $this->em->flush();

        return $this->json($this->summary($c));
    }

    #[Route('/api/collections/{id}/tutorials/{tid}', name: 'api_collections_remove', methods: ['DELETE'], requirements: ['id' => '\d+', 'tid' => '\d+'])]
    public function remove(int $id, int $tid): JsonResponse
    {
        $c = $this->owned($id);
        if ($c instanceof JsonResponse) {
            return $c;
        }
        $c->removeTutorialId($tid);
        $this->em->flush();

        return $this->json($this->summary($c));
    }

    #[Route('/api/c/{slug}', name: 'api_collections_show', methods: ['GET'], requirements: ['slug' => '[a-z0-9-]+'])]
    public function show(string $slug): JsonResponse
    {
        $c    = $this->collections->findOneBy(['slug' => $slug]);
        $user = $this->getUser();
        $isOwner = $c && $user instanceof User && $c->getOwner()->getId() === $user->getId();
        if (!$c || (!$c->isPublic() && !$isOwner)) {
            return $this->json(['error' => 'Collection introuvable.'], 404);
        }

        $byId = [];
        foreach ($c->getTutorialIds() ? $this->tutorials->findBy(['id' => $c->getTutorialIds(), 'published' => true]) : [] as $t) {
            $byId[$t->getId()] = $t;
        }
        $items = [];
        foreach ($c->getTutorialIds() as $tid) {
            if ($t = $byId[$tid] ?? null) {
                $items[] = [
                    'id' => $t->getId(), 'slug' => $t->getSlug(), 'title' => $t->getTitle(),
                    'description' => $t->getDescription(), 'difficulty' => $t->getDifficulty(),
                    'source' => $t->getSource()->value, 'thumbnailUrl' => $t->getThumbnailUrl(),
                ];
            }
        }

        return $this->json($this->summary($c) + [
            'owner'     => $c->getOwner()->getUsername(),
            'isOwner'   => $isOwner,
            'tutorials' => $items,
        ]);
    }

    private function summary(TutorialCollection $c): array
    {
        return [
            'id' => $c->getId(), 'slug' => $c->getSlug(), 'title' => $c->getTitle(),
            'description' => $c->getDescription(), 'public' => $c->isPublic(),
            'tutorialIds' => $c->getTutorialIds(), 'count' => count($c->getTutorialIds()),
            'updatedAt' => $c->getUpdatedAt()->format(\DATE_ATOM),
        ];
    }

    private function requireUser(): User|JsonResponse
    {
        $user = $this->getUser();

        return $user instanceof User ? $user : $this->json(['error' => 'Authentification requise.'], 401);
    }

    private function owned(int $id): TutorialCollection|JsonResponse
    {
        $user = $this->requireUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }
        $c = $this->collections->find($id);
        if (!$c || $c->getOwner()->getId() !== $user->getId()) {
            return $this->json(['error' => 'Collection introuvable.'], 404);
        }

        return $c;
    }
}
