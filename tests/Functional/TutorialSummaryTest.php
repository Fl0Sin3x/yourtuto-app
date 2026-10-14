<?php

namespace App\Tests\Functional;

use App\Entity\Tutorial;

final class TutorialSummaryTest extends DatabaseWebTestCase
{
    public function testSummaryEndpointReturnsExtractiveFallbackWithoutAi(): void
    {
        $t = (new Tutorial())->setTitle('Git')->setSlug('git')->setPublished(true)
            ->setContent("## Initialiser un dépôt\ntext\n## Faire un commit\ntext\n## Pousser sur GitHub\ntext");
        $draft = (new Tutorial())->setTitle('Draft')->setSlug('draft');
        $this->em->persist($t);
        $this->em->persist($draft);
        $this->em->flush();

        $data = $this->jsonRequest('GET', '/api/tutorials/' . $t->getId() . '/summary');
        self::assertResponseIsSuccessful();
        self::assertSame('extractive', $data['source']);
        self::assertSame(['Initialiser un dépôt', 'Faire un commit', 'Pousser sur GitHub'], $data['points']);

        $this->jsonRequest('GET', '/api/tutorials/' . $draft->getId() . '/summary');
        self::assertResponseStatusCodeSame(404);
    }
}
