<?php

namespace App\Service\Summary;

use Anthropic\Client;

/**
 * Thin wrapper around the Anthropic API. Disabled unless SUMMARY_AI_ENABLED=1 and a key is set,
 * so no paid API call happens by default.
 */
class AiSummaryClient
{
    public function __construct(
        private readonly ?string $apiKey,
        private readonly bool $enabled = false,
    ) {}

    public function isAvailable(): bool
    {
        return $this->enabled && $this->apiKey !== null && $this->apiKey !== '';
    }

    public function complete(string $prompt): ?string
    {
        if (!$this->isAvailable()) {
            return null;
        }
        try {
            $message = (new Client(apiKey: $this->apiKey))->messages->create(
                model: 'claude-haiku-4-5',
                maxTokens: 300,
                messages: [['role' => 'user', 'content' => $prompt]],
            );
            foreach ($message->content as $block) {
                if ($block->type === 'text') {
                    return $block->text;
                }
            }
        } catch (\Throwable) {
            // Non-critical: caller falls back to the extractive summary
        }

        return null;
    }
}
