<?php

namespace App\Tests\Unit;

use App\Entity\Tutorial;
use App\Service\Summary\AiSummaryClient;
use App\Service\Summary\TutorialSummarizer;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;

final class TutorialSummarizerTest extends TestCase
{
    private const MD = "## Introduction\nBla.\n## Étape 1 : Installer **Docker**\nInstall.\n## Écrire un [Dockerfile](https://x)\nWrite.\n### Lancer le conteneur\nRun.\n## Conclusion\nEnd.\n" ;

    private function tutorial(string $content): Tutorial
    {
        return (new Tutorial())->setTitle('Docker')->setSlug('docker')->setContent($content . str_repeat(' filler', 40));
    }

    public function testExtractiveUsesHeadingsWithoutBoilerplate(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects(self::never())->method('flush');
        $s = new TutorialSummarizer(new AiSummaryClient(null), $em);

        $result = $s->summarize($this->tutorial(self::MD));

        self::assertSame('extractive', $result['source']);
        self::assertSame(['Installer Docker', 'Écrire un Dockerfile', 'Lancer le conteneur'], $result['points']);
    }

    public function testExtractiveFallsBackToSentences(): void
    {
        $s = new TutorialSummarizer(new AiSummaryClient(null), $this->createStub(EntityManagerInterface::class));
        $points = $s->extractive('Premier point assez long pour compter. Court. Deuxième phrase également suffisamment longue ! ```code ignored here please```');

        self::assertSame(['Premier point assez long pour compter.', 'Deuxième phrase également suffisamment longue !'], $points);
    }

    public function testAiSummaryIsGeneratedOnceAndCached(): void
    {
        $ai = $this->createMock(AiSummaryClient::class);
        $ai->method('isAvailable')->willReturn(true);
        $ai->expects(self::once())->method('complete')->willReturn("- Installer Docker sur sa machine\n- Écrire un premier Dockerfile\n- Lancer et inspecter un conteneur");
        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects(self::once())->method('flush');
        $s = new TutorialSummarizer($ai, $em);
        $t = $this->tutorial(self::MD);

        $first = $s->summarize($t);
        $second = $s->summarize($t);

        self::assertSame('ai', $first['source']);
        self::assertFalse($first['cached']);
        self::assertTrue($second['cached']);
        self::assertSame($first['points'], $second['points']);
        self::assertCount(3, $t->getAiSummary());
    }

    public function testFallsBackWhenAiFails(): void
    {
        $ai = $this->createStub(AiSummaryClient::class);
        $ai->method('isAvailable')->willReturn(true);
        $ai->method('complete')->willReturn(null);
        $s = new TutorialSummarizer($ai, $this->createStub(EntityManagerInterface::class));

        self::assertSame('extractive', $s->summarize($this->tutorial(self::MD))['source']);
    }

    public function testAiClientIsDisabledByDefault(): void
    {
        self::assertFalse((new AiSummaryClient('sk-test'))->isAvailable());
        self::assertFalse((new AiSummaryClient(null, true))->isAvailable());
        self::assertTrue((new AiSummaryClient('sk-test', true))->isAvailable());
    }
}
