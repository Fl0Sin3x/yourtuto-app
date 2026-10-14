<?php

namespace App\Enum;

enum TutorialSource: string
{
    case Community = 'community';
    case YouTube   = 'youtube';
    case DevTo     = 'devto';
    case Reddit    = 'reddit';
    case Medium    = 'medium';
    case Recipe        = 'recipe';
    case Instructables = 'instructables';
    case Generated     = 'generated';
    case Dev           = 'dev';
}
