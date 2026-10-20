# Nathan Cheng personal website

This repository is the source and maintenance entry point for
[nathanchengyi.com](https://nathanchengyi.com).

Production is a static site served by Nginx on AWS EC2. GitHub Pages is no
longer used. GitHub keeps the reviewed source, history, maintenance tasks, and
the manually triggered deployment workflow.

## Repository layout

```text
index.html, site.css       Main portfolio: the interactive gallery (since 2026-10-20)
site.js, sprite.js,        Scroll strip, character, simulator
models.js, scenes/         One module per card
data/                      Real numbers behind the research cards (see SOURCES.md)
assets/                    Font and the two character atlases
sites/<slug>/              Small static sites published below the main domain
sites/classic/             The previous single-page portfolio, at /classic/
scripts/deploy-site.sh      Shared validation and deployment script
scripts/*.py               Atlas builders, data export, local preview server
.github/workflows/         Manual GitHub deployment entry point
docs/MAINTENANCE.md         Maintenance and recovery workflow
docs/DESIGN.md              Design of the interactive site and open decisions
```

The main portfolio is published at `/`. A small site in `sites/example/` is
published at `/example/`. Preview locally with `python3 scripts/serve.py`
(<http://localhost:4184/>); module scripts and the JSON data need HTTP.

## Add a small site

1. Create `sites/<slug>/index.html` and keep all of that site's files inside
   the same directory.
2. Use relative asset links so the site works below
   `https://nathanchengyi.com/<slug>/`.
3. Validate the package locally:

   ```bash
   ./scripts/deploy-site.sh <slug> --dry-run
   ```

4. Commit and push the reviewed files.
5. Run the **Deploy website** workflow in GitHub Actions and enter the slug.
6. Verify the public URL on desktop and mobile.

See [docs/MAINTENANCE.md](docs/MAINTENANCE.md) for setup, deployment, backup,
and rollback details.
