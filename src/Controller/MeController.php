<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use App\Entity\User;

class MeController extends AbstractController
{
    #[Route('/api/me', name: 'api_me', methods: ['GET'])]
    public function me(#[CurrentUser] ?User $user): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'Not authenticated'], 401);
        }

        return $this->json([
            'id'             => $user->getId(),
            'email'          => $user->getEmail(),
            'username'       => $user->getUsername(),
            'avatar'         => $user->getAvatar(),
            'profilePicture' => $user->getProfilePicture()
                ? '/uploads/avatars/' . $user->getProfilePicture()
                : null,
            'bio'            => $user->getBio(),
            'createdAt'      => $user->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ]);
    }
}
