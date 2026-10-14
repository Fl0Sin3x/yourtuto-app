<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Uid\Uuid;

class ProfilePictureController extends AbstractController
{
    private const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    private const MAX_SIZE     = 100 * 1024; // 100 KB

    public function __construct(private readonly string $uploadDir) {}

    #[Route('/api/me/picture', name: 'api_me_picture', methods: ['POST'])]
    public function upload(
        #[CurrentUser] User $user,
        Request $request,
        EntityManagerInterface $em,
    ): JsonResponse {
        $file = $request->files->get('file');

        if (!$file) {
            return $this->json(['error' => 'Aucun fichier envoyé.'], 400);
        }

        if ($file->getSize() > self::MAX_SIZE) {
            return $this->json(['error' => 'Fichier trop lourd (max 2 Mo).'], 422);
        }

        if (!in_array($file->getMimeType(), self::ALLOWED_MIME, true)) {
            return $this->json(['error' => 'Format non supporté (jpeg, png, webp, gif).'], 422);
        }

        // Supprimer l'ancienne image
        if ($user->getProfilePicture()) {
            $old = $this->uploadDir . '/' . $user->getProfilePicture();
            if (file_exists($old)) {
                unlink($old);
            }
        }

        $filename = Uuid::v4()->toRfc4122() . '.' . $file->guessExtension();
        $file->move($this->uploadDir, $filename);

        $user->setProfilePicture($filename);
        $em->flush();

        return $this->json(['profilePicture' => '/uploads/avatars/' . $filename]);
    }

    #[Route('/api/me/picture', name: 'api_me_picture_delete', methods: ['DELETE'])]
    public function delete(
        #[CurrentUser] User $user,
        EntityManagerInterface $em,
    ): JsonResponse {
        if ($user->getProfilePicture()) {
            $path = $this->uploadDir . '/' . $user->getProfilePicture();
            if (file_exists($path)) {
                unlink($path);
            }
            $user->setProfilePicture(null);
            $em->flush();
        }

        return $this->json(null, 204);
    }
}
