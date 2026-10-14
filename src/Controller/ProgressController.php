<?php

namespace App\Controller;

use App\Entity\UserProgress;
use App\Repository\UserProgressRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use App\Service\Stats\LearningStatsCalculator;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/progress')]
#[IsGranted('ROLE_USER')]
class ProgressController extends AbstractController
{
    public function __construct(
        private readonly UserProgressRepository $repo,
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $user  = $this->getUser();
        $items = $this->repo->findBy(['user' => $user], ['completedAt' => 'DESC']);

        return $this->json(array_map(fn(UserProgress $p) => [
            'id'           => $p->getId(),
            'itemSlug'     => $p->getItemSlug(),
            'source'       => $p->getSource(),
            'title'        => $p->getTitle(),
            'thumbnailUrl' => $p->getThumbnailUrl(),
            'externalUrl'  => $p->getExternalUrl(),
            'completedAt'  => $p->getCompletedAt()->format(\DateTimeInterface::ATOM),
            'isDone'       => $p->isDone(),
        ], $items));
    }

    #[Route('/toggle', methods: ['POST'])]
    public function toggle(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $slug   = trim($data['slug']   ?? '');
        $source = trim($data['source'] ?? '');
        $title  = trim($data['title']  ?? '');

        if ($slug === '' || $source === '' || $title === '') {
            return $this->json(['error' => 'slug, source and title are required'], 400);
        }

        $user     = $this->getUser();
        $existing = $this->repo->findOneBy(['user' => $user, 'itemSlug' => $slug, 'source' => $source]);

        if ($existing) {
            $this->em->remove($existing);
            $this->em->flush();
            return $this->json(['completed' => false]);
        }

        $progress = new UserProgress(
            $user,
            $slug,
            $source,
            mb_substr($title, 0, 255),
            $data['thumbnailUrl'] ?? null,
            $data['externalUrl']  ?? null,
        );

        $this->em->persist($progress);
        $this->em->flush();

        return $this->json(['completed' => true]);
    }

    /** Toggle the isDone flag for a specific progress item */
    #[Route('/{id}/done', methods: ['POST'])]
    public function toggleDone(int $id): JsonResponse
    {
        $user = $this->getUser();
        $item = $this->repo->findOneBy(['id' => $id, 'user' => $user]);

        if (!$item) {
            return $this->json(['error' => 'Not found'], 404);
        }

        $item->setIsDone(!$item->isDone());
        $this->em->flush();

        return $this->json(['isDone' => $item->isDone()]);
    }

    /** Returns a flat set of "slug|source" strings for quick client-side lookup */
    #[Route('/keys', methods: ['GET'])]
    public function keys(): JsonResponse
    {
        $user  = $this->getUser();
        $items = $this->repo->findBy(['user' => $user]);

        $keys = array_map(
            fn(UserProgress $p) => $p->getItemSlug() . '|' . $p->getSource(),
            $items
        );

        return $this->json($keys);
    }

    /** Streak, badges and total count */
    #[Route('/stats', methods: ['GET'])]
    public function stats(): JsonResponse
    {
        $user  = $this->getUser();
        $items = $this->repo->findBy(['user' => $user], ['completedAt' => 'DESC']);
        $stats = (new LearningStatsCalculator())->compute(
            array_map(fn (UserProgress $p) => ['date' => $p->getCompletedAt(), 'source' => $p->getSource()], $items),
            new \DateTimeImmutable('today'),
        );
        $total  = $stats['total'];
        $streak = $stats['streak'];

        // Badges
        $badges = [];
        if ($total >= 1)   $badges[] = ['id' => 'first',   'label' => 'Premiers pas',   'icon' => '🌱'];
        if ($total >= 10)  $badges[] = ['id' => 'regular',  'label' => 'Assidu',          'icon' => '📚'];
        if ($total >= 50)  $badges[] = ['id' => 'expert',   'label' => 'Expert',          'icon' => '🏆'];
        if ($total >= 100) $badges[] = ['id' => 'master',   'label' => 'Maître',          'icon' => '💎'];
        if ($streak >= 3)  $badges[] = ['id' => 'streak3',  'label' => '3 jours de suite', 'icon' => '🔥'];
        if ($streak >= 7)  $badges[] = ['id' => 'streak7',  'label' => 'Une semaine !',   'icon' => '⚡'];
        if ($streak >= 30) $badges[] = ['id' => 'streak30', 'label' => 'Un mois !',       'icon' => '🚀'];

        if ($stats['longestStreak'] >= 14) $badges[] = ['id' => 'longest14', 'label' => 'Record : 2 semaines', 'icon' => '🏅'];

        return $this->json($stats + ['badges' => $badges]);
    }
}
