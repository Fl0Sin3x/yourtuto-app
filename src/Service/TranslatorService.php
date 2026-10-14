<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Thin wrapper around Google Translate (unofficial gtx endpoint, no key needed).
 */
class TranslatorService
{
    private const CHUNK_SIZE = 4000;

    public function __construct(private readonly HttpClientInterface $httpClient) {}

    public function translate(string $text, string $from = 'en', string $to = 'fr'): string
    {
        $text = trim($text);
        if ($text === '') {
            return '';
        }

        $chunks     = $this->splitText($text);
        $translated = [];

        foreach ($chunks as $chunk) {
            $response = $this->httpClient->request('GET',
                'https://translate.googleapis.com/translate_a/single',
                [
                    'query' => [
                        'client' => 'gtx',
                        'sl'     => $from,
                        'tl'     => $to,
                        'dt'     => 't',
                        'q'      => $chunk,
                    ],
                    'headers' => ['User-Agent' => 'Mozilla/5.0'],
                    'timeout' => 10,
                ]
            );

            $data   = $response->toArray(false);
            $result = '';
            foreach ($data[0] ?? [] as $part) {
                $result .= $part[0] ?? '';
            }
            $translated[] = $result;
        }

        return implode(' ', $translated);
    }

    /** @return string[] */
    private function splitText(string $text): array
    {
        if (mb_strlen($text) <= self::CHUNK_SIZE) {
            return [$text];
        }

        $chunks    = [];
        $sentences = preg_split('/(?<=[.!?\n])\s+/', $text) ?: [$text];
        $current   = '';

        foreach ($sentences as $sentence) {
            if (mb_strlen($current) + mb_strlen($sentence) > self::CHUNK_SIZE) {
                if ($current !== '') {
                    $chunks[]  = trim($current);
                    $current   = '';
                }
                if (mb_strlen($sentence) > self::CHUNK_SIZE) {
                    $chunks = array_merge($chunks, str_split($sentence, self::CHUNK_SIZE));
                    continue;
                }
            }
            $current .= ' ' . $sentence;
        }

        if (trim($current) !== '') {
            $chunks[] = trim($current);
        }

        return $chunks;
    }
}
