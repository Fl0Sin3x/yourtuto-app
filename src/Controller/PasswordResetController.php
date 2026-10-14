<?php

namespace App\Controller;

use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;

class PasswordResetController extends AbstractController
{
    #[Route('/api/forgot-password', name: 'api_forgot_password', methods: ['POST'])]
    public function forgotPassword(
        Request $request,
        UserRepository $userRepository,
        EntityManagerInterface $em,
        MailerInterface $mailer,
    ): JsonResponse {
        $data  = json_decode($request->getContent(), true);
        $email = trim($data['email'] ?? '');

        // Always return 200 to avoid email enumeration
        $user = $userRepository->findOneBy(['email' => $email]);
        if (!$user) {
            return $this->json(['message' => 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.']);
        }

        // OAuth-only accounts have no password to reset
        if ($user->getPassword() === null) {
            return $this->json(['message' => 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.']);
        }

        $token     = bin2hex(random_bytes(32));
        $expiresAt = new \DateTimeImmutable('+1 hour');

        $user->setResetPasswordToken($token);
        $user->setResetPasswordTokenExpiresAt($expiresAt);
        $em->flush();

        $frontendUrl = $_ENV['FRONTEND_URL'] ?? 'http://localhost:5173';
        $resetLink   = $frontendUrl . '/reset-password?token=' . $token;

        $logoPath = $this->getParameter('kernel.project_dir') . '/frontend/public/yourtuto-logo-email.png';

        $templatedEmail = (new TemplatedEmail())
            ->from(new Address('noreplyyourtuto@gmail.com', 'YourTuto'))
            ->to($user->getEmail())
            ->subject('Réinitialisation de votre mot de passe YourTuto')
            ->htmlTemplate('emails/reset_password.html.twig')
            ->context([
                'username' => $user->getUsername(),
                'resetLink' => $resetLink,
                'expiresIn' => '1 heure',
                'logoCid'  => 'cid:yourtuto-logo',
            ])
            ->embedFromPath($logoPath, 'yourtuto-logo', 'image/png');

        $mailer->send($templatedEmail);

        return $this->json(['message' => 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.']);
    }

    #[Route('/api/reset-password', name: 'api_reset_password', methods: ['POST'])]
    public function resetPassword(
        Request $request,
        UserRepository $userRepository,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
    ): JsonResponse {
        $data     = json_decode($request->getContent(), true);
        $token    = trim($data['token'] ?? '');
        $password = $data['password'] ?? '';

        if (!$token) {
            return $this->json(['error' => 'Token manquant.'], 400);
        }

        $user = $userRepository->findOneBy(['resetPasswordToken' => $token]);

        if (!$user || $user->getResetPasswordTokenExpiresAt() < new \DateTimeImmutable()) {
            return $this->json(['error' => 'Ce lien est invalide ou a expiré.'], 400);
        }

        // Validate password strength
        if (strlen($password) < 8
            || !preg_match('/[A-Z]/', $password)
            || !preg_match('/[a-z]/', $password)
            || !preg_match('/\d/', $password)
        ) {
            return $this->json(['error' => 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.'], 422);
        }

        $user->setPassword($hasher->hashPassword($user, $password));
        $user->setResetPasswordToken(null);
        $user->setResetPasswordTokenExpiresAt(null);
        $em->flush();

        return $this->json(['message' => 'Mot de passe réinitialisé avec succès.']);
    }
}
