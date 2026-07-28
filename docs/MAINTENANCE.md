# Website maintenance workflow

## Source of truth

- GitHub `main` is the source and version history for website files.
- `nathanchengyi.com` is the production result that must be verified after a
  deployment.
- AWS EC2 and Nginx serve production; GitHub Pages remains disabled.
- Infrastructure facts such as DNS, server addresses, certificates, and
  credentials do not belong in this repository.

Production should correspond to a known Git commit. Do not make an EC2-only
content edit and leave GitHub behind.

## Main portfolio

The main portfolio consists of:

- `index.html`
- `assets/`

Validate a deployable package without changing production:

```bash
./scripts/deploy-site.sh portfolio --dry-run
```

Deploy from GitHub Actions by running **Deploy website** with `portfolio`.
The workflow is manual so a push cannot unexpectedly overwrite the public
site.

## Small sites below the domain

Each small static site lives in its own directory:

```text
sites/
└── example/
    ├── index.html
    ├── styles.css
    └── assets/
```

The directory name becomes the public path. For example:

```text
sites/example/ → https://nathanchengyi.com/example/
```

Slug rules:

- lowercase letters, numbers, and hyphens only;
- must begin and end with a letter or number;
- cannot be `assets`, `portfolio`, `www`, or `api`;
- every site must contain `index.html`.

Use relative URLs such as `assets/cover.webp` or `./styles.css`. Root-relative
URLs such as `/styles.css` point to the main domain root and usually break a
site hosted below a path.

If a project later needs a backend, authentication, or an independent release
cycle, give it a separate repository and subdomain instead of placing it in
`sites/`.

## GitHub Actions setup

Add these repository secrets before the first deployment:

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` | EC2 hostname or IP address |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | Private SSH key used only for deployment |
| `DEPLOY_KNOWN_HOSTS` | Pinned SSH host-key line for the server |

Do not store private keys, passwords, `.env` files, or secret values in Git.
Use a dedicated deployment key where practical.

The EC2 deployment user must be able to run the limited `sudo` operations used
by `scripts/deploy-site.sh`. The server also needs `tar` and Nginx.

## Normal maintenance loop

1. Pull the latest `main`.
2. Make the smallest content or site change.
3. Preview locally and check desktop and mobile layouts.
4. Run the dry-run packaging validation.
5. Review the Git diff and commit the exact change.
6. Push to GitHub.
7. Manually run **Deploy website** for `portfolio` or the relevant slug.
8. Open the public URL and verify content, assets, links, console errors, and
   mobile overflow.
9. Record durable infrastructure changes in the infrastructure source of
   truth, not in this repository.

## Backups and rollback

Every deployment creates a timestamped backup under
`/var/www/site-backups/` before replacing the current files. GitHub Actions
also records the deployed commit in its run summary.

To roll back content, the preferred path is:

1. identify the last known-good Git commit;
2. restore or revert the relevant files in Git;
3. run the deployment workflow again;
4. verify the public result.

Server backups are an emergency recovery layer, not the normal source of
truth. They are not automatically pruned; periodically review disk usage and
remove old backups deliberately.

