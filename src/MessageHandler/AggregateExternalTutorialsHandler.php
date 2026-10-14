<?php

namespace App\MessageHandler;

use App\Message\AggregateExternalTutorials;
use App\Service\Aggregator\ClaudeGeneratorAggregator;
use App\Service\Aggregator\DevToAggregator;
use App\Service\Aggregator\InstructablesAggregator;
use App\Service\Aggregator\RedditAggregator;
use App\Service\Aggregator\YouTubeAggregator;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class AggregateExternalTutorialsHandler
{
    public function __construct(
        private readonly YouTubeAggregator       $youTubeAggregator,
        private readonly DevToAggregator         $devToAggregator,
        private readonly RedditAggregator        $redditAggregator,
        private readonly InstructablesAggregator $instructablesAggregator,
        private readonly ClaudeGeneratorAggregator $claudeGeneratorAggregator,
        private readonly LoggerInterface           $logger,
    ) {}

    public function __invoke(AggregateExternalTutorials $message): void
    {
        $aggregator = match ($message->source) {
            'youtube'       => $this->youTubeAggregator,
            'devto'         => $this->devToAggregator,
            'reddit'        => $this->redditAggregator,
            'instructables' => $this->instructablesAggregator,
            'claude'        => $this->claudeGeneratorAggregator,
            default         => throw new \InvalidArgumentException("Unknown source: {$message->source}"),
        };

        $result = $aggregator->aggregate($message->options);

        $this->logger->info("Aggregation [{$message->source}]: {$result['count']} new tutorials imported.");
    }
}
