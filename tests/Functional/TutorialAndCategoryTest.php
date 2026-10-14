<?php

namespace App\Tests\Functional;

use App\Entity\Category;
use App\Entity\Tutorial;

final class TutorialAndCategoryTest extends DatabaseWebTestCase
{
    private function seed(): Tutorial
    {
        $category = (new Category())->setName('Symfony')->setSlug('symfony');
        $tutorial = (new Tutorial())
            ->setTitle('Getting started with Symfony')
            ->setSlug('getting-started-with-symfony')
            ->setDescription('A first tutorial')
            ->setPublished(true);
        $tutorial->addCategory($category);

        $this->em->persist($category);
        $this->em->persist($tutorial);
        $this->em->flush();

        return $tutorial;
    }

    public function testCategoriesCollectionListsSeededCategory(): void
    {
        $this->seed();

        $data = $this->jsonRequest('GET', '/api/categories');
        self::assertResponseIsSuccessful();
        self::assertContains('Symfony', array_column($data['member'] ?? [], 'name'));
    }

    public function testTutorialCanBeFetchedById(): void
    {
        $tutorial = $this->seed();

        $data = $this->jsonRequest('GET', '/api/tutorials/' . $tutorial->getId());
        self::assertResponseIsSuccessful();
        self::assertSame('Getting started with Symfony', $data['title'] ?? null);
    }

    public function testUnknownTutorialReturns404(): void
    {
        $this->jsonRequest('GET', '/api/tutorials/999999');
        self::assertResponseStatusCodeSame(404);
    }
}
