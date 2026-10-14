<?php

namespace App\Tests\Unit;

use App\Entity\Tag;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use App\Service\SimilarityScorer;
use PHPUnit\Framework\TestCase;

final class SimilarityScorerTest extends TestCase
{
    private function tag(int $id, string $name): Tag
    {
        $t = (new Tag())->setName($name)->setSlug($name);
        (new \ReflectionProperty(Tag::class, 'id'))->setValue($t, $id);

        return $t;
    }

    private function tuto(int $id, string $title, array $tags = [], TutorialSource $src = TutorialSource::Dev, ?string $diff = null): Tutorial
    {
        $t = (new Tutorial())->setTitle($title)->setSlug('s' . $id)->setSource($src)->setDifficulty($diff);
        (new \ReflectionProperty(Tutorial::class, 'id'))->setValue($t, $id);
        foreach ($tags as $tag) {
            $t->addTag($tag);
        }

        return $t;
    }

    public function testTitleWordsIgnoreStopWords(): void
    {
        self::assertSame(['docker', 'compose'], (new SimilarityScorer())->words('Guide complet : Docker Compose pour les débutants'));
    }

    public function testRankPrefersSharedTagsThenTitleOverlap(): void
    {
        $react = $this->tag(1, 'react');
        $css = $this->tag(2, 'css');
        $base = $this->tuto(1, 'React hooks en profondeur', [$react], diff: 'intermediate');

        $sameTag   = $this->tuto(2, 'State management', [$react]);
        $sameTitle = $this->tuto(3, 'Les hooks React personnalisés', [], TutorialSource::YouTube);
        $unrelated = $this->tuto(4, 'Cuisine italienne', [$css], TutorialSource::Recipe);

        $ranked = (new SimilarityScorer())->rank($base, [$unrelated, $sameTitle, $sameTag, $base]);

        self::assertSame([2, 3], array_map(fn ($t) => $t->getId(), $ranked));
    }

    public function testScoreIsSymmetric(): void
    {
        $s = new SimilarityScorer();
        $a = $this->tuto(1, 'Python FastAPI', [$this->tag(5, 'python')]);
        $b = $this->tuto(2, 'FastAPI async', [$this->tag(5, 'python')]);
        self::assertSame($s->score($a, $b), $s->score($b, $a));
    }
}
