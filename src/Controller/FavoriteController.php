<?php

namespace App\Controller;

use App\Entity\Favorite;
use App\Repository\FavoriteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/favorites')]
#[IsGranted('ROLE_USER')]
class FavoriteController extends AbstractController
{
    public function __construct(
        private readonly FavoriteRepository  $repo,
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $items = $this->repo->findBy(['user' => $this->getUser()], ['savedAt' => 'DESC']);

        return $this->json(array_map(fn(Favorite $f) => [
            'id'           => $f->getId(),
            'itemSlug'     => $f->getItemSlug(),
            'source'       => $f->getSource(),
            'title'        => $f->getTitle(),
            'thumbnailUrl' => $f->getThumbnailUrl(),
            'externalUrl'  => $f->getExternalUrl(),
            'savedAt'      => $f->getSavedAt()->format(\DateTimeInterface::ATOM),
        ], $items));
    }

    #[Route('/toggle', methods: ['POST'])]
    public function toggle(Request $request): JsonResponse
    {
        $data   = json_decode($request->getContent(), true);
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
            return $this->json(['saved' => false]);
        }

        $fav = new Favorite(
            $user,
            $slug,
            $source,
            mb_substr($title, 0, 255),
            $data['thumbnailUrl'] ?? null,
            $data['externalUrl']  ?? null,
        );

        $this->em->persist($fav);
        $this->em->flush();

        return $this->json(['saved' => true]);
    }

    /** Flat list of "slug|source" for quick client-side lookup */
    #[Route('/keys', methods: ['GET'])]
    public function keys(): JsonResponse
    {
        $items = $this->repo->findBy(['user' => $this->getUser()]);

        return $this->json(array_map(
            fn(Favorite $f) => $f->getItemSlug() . '|' . $f->getSource(),
            $items
        ));
    }
}
