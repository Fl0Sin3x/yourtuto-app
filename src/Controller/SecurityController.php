<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class SecurityController extends AbstractController
{
    /**
     * Le corps de cette méthode n'est jamais exécuté.
     * Le firewall json_login intercepte la requête avant d'atteindre le contrôleur.
     */
    #[Route('/api/login', name: 'api_login', methods: ['POST'])]
    public function login(): JsonResponse
    {
        throw new \LogicException('This should not be reached.');
    }
}
