<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

class QueryTranslator
{
    public function __construct(
        private readonly HttpClientInterface $httpClient,
    ) {}

    /**
     * Common French words that Google Translate misdetects as English.
     * @var array<string, string>
     */
    private const FR_DICTIONARY = [
        'boeuf'      => 'beef',
        'poulet'     => 'chicken',
        'porc'       => 'pork',
        'agneau'     => 'lamb',
        'veau'       => 'veal',
        'canard'     => 'duck',
        'lapin'      => 'rabbit',
        'crevettes'  => 'shrimp',
        'saumon'     => 'salmon',
        'thon'       => 'tuna',
        'cabillaud'  => 'cod',
        'pate'       => 'pasta',
        'pâte'       => 'pasta',
        'pates'      => 'pasta',
        'pâtes'      => 'pasta',
        'riz'        => 'rice',
        'pommes de terre' => 'potato',
        'pomme de terre'  => 'potato',
        'patate'     => 'potato',
        'patates'    => 'potatoes',
        'tomate'     => 'tomato',
        'tomates'    => 'tomatoes',
        'oignon'     => 'onion',
        'oignons'    => 'onions',
        'ail'        => 'garlic',
        'champignon' => 'mushroom',
        'champignons'=> 'mushrooms',
        'courgette'  => 'zucchini',
        'aubergine'  => 'eggplant',
        'poivron'    => 'pepper',
        'lait'       => 'milk',
        'fromage'    => 'cheese',
        'oeuf'       => 'egg',
        'oeufs'      => 'eggs',
        'beurre'     => 'butter',
        'farine'     => 'flour',
        'sucre'      => 'sugar',
        'gateau'     => 'cake',
        'gâteau'     => 'cake',
        'tarte'      => 'pie',
        'soupe'      => 'soup',
        'curry'      => 'curry',
        'chou'       => 'cabbage',
        'carotte'    => 'carrot',
        'carottes'   => 'carrots',
        'epinard'    => 'spinach',
        'épinard'    => 'spinach',
        'creme'      => 'cream',
        'crème'      => 'cream',
        'poisson'    => 'fish',
        'viande'     => 'meat',
        'salade'     => 'salad',
        'pain'       => 'bread',
        'grille'     => 'grilled',
        'roti'       => 'roast',
        'rôti'       => 'roast',
        'frit'       => 'fried',
        'frite'      => 'fried',
        'frites'     => 'fries',
    ];

    /**
     * Translates a search query to English.
     * Uses a French dictionary first, then the translation API.
     */
    public function toEnglish(string $query): string
    {
        $query = trim($query);
        if ($query === '') {
            return $query;
        }

        // Replace known French words first (case-insensitive)
        $lower   = mb_strtolower($query);
        $working = $lower;
        foreach (self::FR_DICTIONARY as $fr => $en) {
            $working = preg_replace('/\b' . preg_quote($fr, '/') . '\b/ui', $en, $working) ?? $working;
        }
        // If dictionary changed something, use it
        if ($working !== $lower) {
            // Still try API for remaining French words, but on the partially-translated string
            $query = $working;
        }

        return $query;
    }
}
