<?php

declare(strict_types=1);

namespace Shyim\PackagistMirror\Tests;

use PHPUnit\Framework\TestCase;
use Shyim\PackagistMirror\UrlRewriter;

final class UrlRewriterTest extends TestCase
{
    public function testRewritesAllowlistedGithubZipball(): void
    {
        $this->assertSame(
            'https://packages.shyim.de/dist/https/api.github.com/repos/Seldaek/monolog/zipball/abc123',
            UrlRewriter::rewrite(
                'https://api.github.com/repos/Seldaek/monolog/zipball/abc123',
                'https://packages.shyim.de',
            ),
        );
    }

    public function testKeepsGitlabQueryString(): void
    {
        $this->assertSame(
            'https://packages.shyim.de/dist/https/gitlab.com/api/v4/projects/1/repository/archive.zip?sha=deadbeef',
            UrlRewriter::rewrite(
                'https://gitlab.com/api/v4/projects/1/repository/archive.zip?sha=deadbeef',
                'https://packages.shyim.de/',
            ),
        );
    }

    public function testLeavesUnknownHostsAlone(): void
    {
        $this->assertNull(
            UrlRewriter::rewrite('https://downloads.example.com/acme.zip', 'https://packages.shyim.de'),
        );
    }

    public function testDoesNotRewriteUrlsAlreadyOnTheMirror(): void
    {
        $url = 'https://packages.shyim.de/dist/https/api.github.com/repos/Seldaek/monolog/zipball/abc123';
        $this->assertNull(UrlRewriter::rewrite($url, 'https://packages.shyim.de'));
    }

    public function testAllowsConfiguredExtraHosts(): void
    {
        $this->assertSame(
            'https://packages.shyim.de/dist/https/downloads.drupal.org/files/foo.zip',
            UrlRewriter::rewrite(
                'https://downloads.drupal.org/files/foo.zip',
                'https://packages.shyim.de',
                ['downloads.drupal.org'],
            ),
        );
    }
}
