# Small static sites

Create one directory per site:

```text
sites/<slug>/index.html
```

The slug becomes the URL path on `nathanchengyi.com`. Keep a site's scripts,
styles, images, and fonts inside its directory and use relative links.

Do not put secrets, server applications, databases, or private source files
here. Projects that require a backend or their own release lifecycle should
use a separate repository and subdomain.
