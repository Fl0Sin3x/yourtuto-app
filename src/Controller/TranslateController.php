<?php

namespace App\Controller;

use App\Service\TranslatorService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/translate', methods: ['POST'])]
class TranslateController extends AbstractController
{
    public function __construct(private readonly TranslatorService $translator) {}

    public function __invoke(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true);
        $text = trim($body['text'] ?? '');
        $from = $body['from'] ?? 'en';
        $to   = $body['to']   ?? 'fr';

        if ($text === '') {
            return $this->json(['translated' => '']);
        }

        try {
            return $this->json(['translated' => $this->translator->translate($text, $from, $to)]);
        } catch (\Throwable) {
            return $this->json(['error' => 'Translation failed.'], 500);
        }
    }
}
