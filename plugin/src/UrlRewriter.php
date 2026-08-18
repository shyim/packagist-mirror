<?php

declare(strict_types=1);

namespace Shyim\PackagistMirror;

final class UrlRewriter
{
    private const EXACT_HOSTS = [
        'api.github.com',
        'codeload.github.com',
        'github.com',
        'gitlab.com',
        'bitbucket.org',
    ];

    private const HOST_SUFFIXES = [
        '.githubusercontent.com',
    ];

    /**
     * @param list<string> $extraHosts
     */
    public static function rewrite(string $url, string $mirror, array $extraHosts = []): ?string
    {
        $parts = parse_url($url);
        if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
            return null;
        }

        $mirror = rtrim($mirror, '/');
        $mirrorHost = strtolower((string) parse_url($mirror, PHP_URL_HOST));
        $host = strtolower($parts['host']);
        if ($mirrorHost !== '' && $host === $mirrorHost) {
            return null;
        }

        if (!self::isAllowedHost($host, $extraHosts)) {
            return null;
        }

        $path = ltrim($parts['path'] ?? '', '/');
        $query = isset($parts['query']) ? '?'.$parts['query'] : '';

        return $mirror.'/dist/https/'.$parts['host'].'/'.$path.$query;
    }

    /**
     * @param list<string> $extraHosts
     */
    public static function isAllowedHost(string $host, array $extraHosts = []): bool
    {
        $host = strtolower($host);
        if (in_array($host, self::EXACT_HOSTS, true)) {
            return true;
        }
        foreach ($extraHosts as $extra) {
            if ($host === strtolower($extra)) {
                return true;
            }
        }
        foreach (self::HOST_SUFFIXES as $suffix) {
            if (str_ends_with($host, $suffix)) {
                return true;
            }
        }

        return false;
    }
}
