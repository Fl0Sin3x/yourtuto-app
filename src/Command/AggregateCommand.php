<?php

namespace App\Command;

use App\Message\AggregateExternalTutorials;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Messenger\MessageBusInterface;

#[AsCommand(
    name: 'app:aggregate',
    description: 'Importe des tutoriels depuis les sources externes (youtube, devto, reddit, instructables)',
)]
class AggregateCommand extends Command
{
    public function __construct(private readonly MessageBusInterface $bus)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('source', InputArgument::OPTIONAL, 'Source : youtube, devto, reddit, instructables, claude (défaut : toutes)', 'all')
            ->addOption('query',     null, InputOption::VALUE_OPTIONAL, 'Terme de recherche YouTube / Reddit',            'tutorial')
            ->addOption('tag',       null, InputOption::VALUE_OPTIONAL, 'Tag DEV.to',                                     'programming')
            ->addOption('subreddit', null, InputOption::VALUE_OPTIONAL, 'Subreddit Reddit',                               'learnprogramming')
            ->addOption('category',  null, InputOption::VALUE_OPTIONAL, 'Catégorie Instructables (homeimprovement, workshop, craft…)', 'homeimprovement')
            ->addOption('max',        null, InputOption::VALUE_OPTIONAL, 'Nombre max de résultats',                            '25')
            ->addOption('difficulty', null, InputOption::VALUE_OPTIONAL, 'Difficulté Claude (débutant / intermédiaire / avancé)', '')
            ->addOption('topic',      null, InputOption::VALUE_OPTIONAL, 'Sujet précis à générer avec Claude',                    '');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io     = new SymfonyStyle($input, $output);
        $source = $input->getArgument('source');
        $max    = (int) $input->getOption('max');

        $sources = $source === 'all' ? ['youtube', 'devto', 'reddit', 'instructables'] : [$source];
        // 'claude' is intentionally excluded from 'all' — run it explicitly to control API spend

        foreach ($sources as $src) {
            $options = match ($src) {
                'youtube'       => ['query'    => $input->getOption('query'),    'maxResults' => $max],
                'devto'         => ['tag'      => $input->getOption('tag'),      'perPage'    => $max],
                'reddit'        => ['subreddit'=> $input->getOption('subreddit'),'query'      => $input->getOption('query'), 'limit' => $max],
                'instructables' => ['category' => $input->getOption('category'), 'limit' => $max],
                'claude'        => [
                    'limit'      => $max,
                    'difficulty' => $input->getOption('difficulty') ?: null,
                    'topic'      => $input->getOption('topic') ?: null,
                ],
                default         => [],
            };

            $io->info("Agrégation {$src}...");
            $this->bus->dispatch(new AggregateExternalTutorials($src, $options));
            $io->success("Source {$src} traitée.");
        }

        return Command::SUCCESS;
    }
}
