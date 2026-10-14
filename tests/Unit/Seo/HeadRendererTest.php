<?php

namespace App\Tests\Unit\Seo;

use App\Seo\HeadRenderer;
use App\Seo\SeoMetadata;
use PHPUnit\Framework\TestCase;

final class HeadRendererTest extends TestCase
{
    private function meta(string $title = 'Hello "world" <b>'): SeoMetadata
    {
        return new SeoMetadata($title, 'Desc', 'https://site.test/x', 'https://site.test/img.jpg', jsonLd: [['name' => '</script><script>alert(1)']]);
    }

    public function testReplacesMarkedBlockAndEscapes(): void
    {
        $shell = tempnam(sys_get_temp_dir(), 'shell');
        file_put_contents($shell, "<html><head><!--seo:start--><title>Old</title><!--seo:end--><link rel=\"x\"></head><body></body></html>");

        $html = (new HeadRenderer($shell))->render($this->meta());

        self::assertStringNotContainsString('<title>Old</title>', $html);
        self::assertStringContainsString('<title data-seo>Hello &quot;world&quot; &lt;b&gt;</title>', $html);
        self::assertStringContainsString('<link rel="x">', $html);
        self::assertStringNotContainsString('</script><script>alert', $html);
        unlink($shell);
    }

    public function testFallsBackToTitleReplacementAndMissingShell(): void
    {
        $shell = tempnam(sys_get_temp_dir(), 'shell');
        file_put_contents($shell, '<html><head><title>Old</title></head></html>');
        self::assertStringContainsString('data-seo name="description"', (new HeadRenderer($shell))->render($this->meta()));
        unlink($shell);

        $html = (new HeadRenderer('/nonexistent/index.html'))->render($this->meta('Fallback'));
        self::assertStringContainsString('<title data-seo>Fallback</title>', $html);
    }
}
