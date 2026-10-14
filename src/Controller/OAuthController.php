<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use KnpU\OAuth2ClientBundle\Client\ClientRegistry;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

class OAuthController extends AbstractController
{
    public function __construct(
        private readonly string $frontendUrl = 'https://yourtuto-production.up.railway.app',
    ) {}

    #[Route('/auth/google/redirect', name: 'auth_google_redirect')]
    public function googleRedirect(ClientRegistry $clientRegistry): RedirectResponse
    {
        return $clientRegistry->getClient('google')->redirect(['email', 'profile'], []);
    }

    #[Route('/auth/google/callback', name: 'auth_google_callback')]
    public function googleCallback(
        ClientRegistry $clientRegistry,
        UserRepository $userRepository,
        EntityManagerInterface $em,
        JWTTokenManagerInterface $jwtManager,
        UserPasswordHasherInterface $passwordHasher,
        Request $request,
    ): RedirectResponse {
        try {
            $client     = $clientRegistry->getClient('google');
            $googleUser = $client->fetchUser();

            $googleId = (string) $googleUser->getId();
            $email    = $googleUser->getEmail();
            $name     = $googleUser->getName() ?? $email;

            $user = $userRepository->findOneBy(['googleId' => $googleId]);

            if ($user === null && $email !== null) {
                $user = $userRepository->findOneBy(['email' => $email]);
            }

            if ($user === null) {
                $user = new User();
                $user->setEmail($email ?? $googleId . '@google.noemail');
                $user->setUsername($name);
                $user->setPassword(
                    $passwordHasher->hashPassword($user, bin2hex(random_bytes(16)))
                );
                $user->setGoogleId($googleId);
                $em->persist($user);
            } elseif ($user->getGoogleId() === null) {
                $user->setGoogleId($googleId);
            }

            $em->flush();

            $token = $jwtManager->create($user);

            return new RedirectResponse(
                $this->frontendUrl . '/?token=' . urlencode($token) . '&username=' . urlencode($user->getUsername() ?? '')
            );
        } catch (\Throwable $e) {
            return new RedirectResponse($this->frontendUrl . '/login?oauth_error=1');
        }
    }

    #[Route('/auth/github/redirect', name: 'auth_github_redirect')]
    public function githubRedirect(ClientRegistry $clientRegistry): RedirectResponse
    {
        return $clientRegistry->getClient('github')->redirect(['user:email'], []);
    }

    #[Route('/auth/github/callback', name: 'auth_github_callback')]
    public function githubCallback(
        ClientRegistry $clientRegistry,
        UserRepository $userRepository,
        EntityManagerInterface $em,
        JWTTokenManagerInterface $jwtManager,
        UserPasswordHasherInterface $passwordHasher,
        Request $request,
    ): RedirectResponse {
        try {
            $client     = $clientRegistry->getClient('github');
            $githubUser = $client->fetchUser();

            $githubId = (string) $githubUser->getId();
            $email    = $githubUser->getEmail();
            $login    = $githubUser->getNickname() ?? $githubId;

            if ($email === null || $email === '') {
                $email = $githubId . '@github.noemail';
            }

            $user = $userRepository->findOneBy(['githubId' => $githubId]);

            if ($user === null) {
                $user = $userRepository->findOneBy(['email' => $email]);
            }

            if ($user === null) {
                $user = new User();
                $user->setEmail($email);
                $user->setUsername($login);
                $user->setPassword(
                    $passwordHasher->hashPassword($user, bin2hex(random_bytes(16)))
                );
                $user->setGithubId($githubId);
                $em->persist($user);
            } elseif ($user->getGithubId() === null) {
                $user->setGithubId($githubId);
            }

            $em->flush();

            $token = $jwtManager->create($user);

            return new RedirectResponse(
                $this->frontendUrl . '/?token=' . urlencode($token) . '&username=' . urlencode($user->getUsername() ?? '')
            );
        } catch (\Throwable $e) {
            return new RedirectResponse($this->frontendUrl . '/login?oauth_error=1');
        }
    }
}
