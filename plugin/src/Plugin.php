<?php

declare(strict_types=1);

namespace Shyim\PackagistMirror;

use Composer\Composer;
use Composer\EventDispatcher\EventSubscriberInterface;
use Composer\IO\IOInterface;
use Composer\Plugin\PluginEvents;
use Composer\Plugin\PluginInterface;
use Composer\Plugin\PreFileDownloadEvent;

final class Plugin implements PluginInterface, EventSubscriberInterface
{
    private const DEFAULT_MIRROR = 'https://packages.shyim.de';

    private Composer $composer;
    private IOInterface $io;

    public function activate(Composer $composer, IOInterface $io): void
    {
        $this->composer = $composer;
        $this->io = $io;
    }

    public function deactivate(Composer $composer, IOInterface $io): void
    {
    }

    public function uninstall(Composer $composer, IOInterface $io): void
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            PluginEvents::PRE_FILE_DOWNLOAD => ['onPreFileDownload', 0],
        ];
    }

    public function onPreFileDownload(PreFileDownloadEvent $event): void
    {
        $type = $event->getType();
        if (in_array($type, ['metadata', 'provider', 'composer'], true)) {
            return;
        }

        $url = $event->getProcessedUrl();
        $rewritten = UrlRewriter::rewrite($url, $this->mirrorUrl(), $this->extraHosts());
        if ($rewritten === null || $rewritten === $url) {
            return;
        }

        $event->setProcessedUrl($rewritten);
        if ($event->getCustomCacheKey() === null) {
            $event->setCustomCacheKey($url);
        }

        $this->io->writeError('  <info>[packagist-mirror]</info> '.$url, true, IOInterface::VERBOSE);
    }

    private function mirrorUrl(): string
    {
        $fromEnv = getenv('PACKAGIST_MIRROR');
        if (is_string($fromEnv) && $fromEnv !== '') {
            return $fromEnv;
        }

        $extra = $this->composer->getPackage()->getExtra()['packagist-mirror'] ?? null;
        if (is_string($extra) && $extra !== '') {
            return $extra;
        }
        if (is_array($extra) && isset($extra['url']) && is_string($extra['url']) && $extra['url'] !== '') {
            return $extra['url'];
        }

        return self::DEFAULT_MIRROR;
    }

    /**
     * @return list<string>
     */
    private function extraHosts(): array
    {
        $extra = $this->composer->getPackage()->getExtra()['packagist-mirror'] ?? null;
        if (!is_array($extra) || !isset($extra['hosts'])) {
            return [];
        }
        if (is_string($extra['hosts'])) {
            return array_values(array_filter(array_map('trim', explode(',', $extra['hosts']))));
        }
        if (is_array($extra['hosts'])) {
            return array_values(array_filter(array_map('strval', $extra['hosts'])));
        }

        return [];
    }
}
