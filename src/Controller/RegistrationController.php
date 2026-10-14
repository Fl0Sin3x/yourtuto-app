<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class RegistrationController extends AbstractController
{
    #[Route('/api/register', name: 'api_register', methods: ['POST'])]
    public function register(
        Request $request,
        UserPasswordHasherInterface $hasher,
        EntityManagerInterface $em,
        ValidatorInterface $validator,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true);

        $user = new User();
        $user->setEmail(trim(strip_tags($data['email'] ?? '')));
        $user->setUsername(trim(strip_tags($data['username'] ?? '')));
        $user->setPlainPassword($data['password'] ?? '');

        $errors = $validator->validate($user, null, ['Default', 'registration']);
        if (count($errors) > 0) {
            $messages = [];
            foreach ($errors as $error) {
                $messages[$error->getPropertyPath()] = $error->getMessage();
            }
            return $this->json(['errors' => $messages], 422);
        }

        $user->setPassword($hasher->hashPassword($user, $user->getPlainPassword()));
        $user->eraseCredentials();

        $em->persist($user);
        $em->flush();

        return $this->json(['message' => 'User created successfully.'], 201);
    }
}
