# shyim/packagist-mirror-plugin

Composer 2 plugin that downloads package zips through [packages.shyim.de](https://packages.shyim.de) without changing `composer.lock`.

```bash
composer global config allow-plugins.shyim/packagist-mirror-plugin true
composer global require shyim/packagist-mirror-plugin
```

Optional:

```json
{
    "extra": {
        "packagist-mirror": {
            "url": "https://packages.shyim.de",
            "hosts": ["downloads.drupal.org"]
        }
    }
}
```

Or `PACKAGIST_MIRROR=https://packages.shyim.de`.
