<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class ProfileController extends AbstractController
{
    #[Route('/api/me', name: 'api_me_update', methods: ['PATCH'])]
    public function update(
        #[CurrentUser] User $user,
        Request $request,
        EntityManagerInterface $em,
        ValidatorInterface $validator,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];

        if (isset($data['username'])) {
            $user->setUsername(trim(strip_tags($data['username'])));
        }
        if (isset($data['bio'])) {
            $user->setBio(trim(strip_tags($data['bio'])));
        }
        if (isset($data['avatar'])) {
            // avatar is a URL — validate it's a real URL
            $avatar = filter_var($data['avatar'], FILTER_VALIDATE_URL) ? $data['avatar'] : null;
            $user->setAvatar($avatar);
        }

        $errors = $validator->validate($user);
        if (count($errors) > 0) {
            $messages = [];
            foreach ($errors as $error) {
                $messages[$error->getPropertyPath()] = $error->getMessage();
            }
            return $this->json(['errors' => $messages], 422);
        }

        $em->flush();

        return $this->json([
            'id'             => $user->getId(),
            'email'          => $user->getEmail(),
            'username'       => $user->getUsername(),
            'avatar'         => $user->getAvatar(),
            'profilePicture' => $user->getProfilePicture()
                ? '/uploads/avatars/' . $user->getProfilePicture()
                : null,
            'bio'            => $user->getBio(),
        ]);
    }

    #[Route('/api/me/password', name: 'api_me_password', methods: ['PATCH'])]
    public function changePassword(
        #[CurrentUser] User $user,
        Request $request,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];

        $currentPassword = $data['currentPassword'] ?? '';
        $newPassword     = $data['newPassword']     ?? '';

        if (!$hasher->isPasswordValid($user, $currentPassword)) {
            return $this->json(['errors' => ['currentPassword' => 'Mot de passe actuel incorrect.']], 422);
        }

        if (strlen($newPassword) < 8 || !preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/', $newPassword)) {
            return $this->json(['errors' => ['newPassword' => 'Le mot de passe doit faire au moins 8 caractères et contenir une majuscule, une minuscule et un chiffre.']], 422);
        }

        $user->setPassword($hasher->hashPassword($user, $newPassword));
        $em->flush();

        return $this->json(['message' => 'Mot de passe mis à jour.']);
    }
}
