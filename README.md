# ARMS Laboratory website

Static Astro and TypeScript source for the ARMS Laboratory at the University of California, Davis. Public address: https://arms.engr.ucdavis.edu.

## Develop and review

Use Node.js 24 LTS and npm. Install the exact locked dependencies with `npm ci`, then run `npm run dev` to edit locally.

Before committing, run:

```sh
npm run format:check
npm run check
npm run build
npm run validate
npm run test:browser
```

On Windows, browser checks use an installed Google Chrome. On Linux or macOS, first run `npx playwright install chromium`. Linux environments may need `npx playwright install --with-deps chromium`. Tests start their own local Astro preview server on port 4173.

The browser suite covers desktop and phone layouts, publication expansion/search/topic filtering, alumni navigation, click-to-load research videos, keyboard navigation, the mobile menu, reduced motion, image loading, research-card alignment, the hybrid grid-mold layout, and automated accessibility checks against WCAG 2.2 AA tags. Automated checks do not establish full accessibility conformance; human review and deployed-site performance checks remain part of release review. Video tests use a substitute player response to verify activation without depending on YouTube availability; actual playback must be reviewed separately.

`npm run validate` checks all generated internal links and anchors, all publication records (currently 46), and the student inquiry URL. `node scripts/check-external.mjs` optionally reports external-link HTTP responses; publishers may reject automated requests even when a link works in a browser. Browser reports are generated in `playwright-report/`, which is excluded from Git.

## Content

- `src/pages/` contains page content and useful older page addresses, including `/map/`.
- `src/data/publications.json` contains the complete bibliography. Missing article links are intentionally omitted.
- `src/data/alumni.json` contains the 24 alumni entries recovered from the former website and two 2026 Ph.D. graduates. Preserve the archived education and past research roles; current employer affiliations are intentionally omitted.
- Research videos use local YouTube preview images in `public/images/videos/`. The privacy-enhanced YouTube player loads only after activation, without autoplay, and every video includes a direct YouTube link that also works without JavaScript.
- `src/components/` and `src/styles/` contain the shared design.
- `public/images/` contains selected optimized image derivatives with metadata removed. Keep image descriptions accurate and preserve scientific diagram content.

Original photographs, internal notes, local review snapshots, dependency folders, environment files, and generated builds do not belong in the public repository. `dist/` is generated; GitHub Actions builds it from source. This repository is the site project root; do not publish its parent workspace.

## GitHub Pages

The public repository is `arms-laboratory/arms-laboratory.github.io`, owned by the `arms-laboratory` organization. GitHub Pages uses **GitHub Actions** as its publishing source. The website is served at https://arms.engr.ucdavis.edu.

Every push to `main` runs validation and deployment. Pull requests run the same checks without deployment. The workflow installs locked dependencies, checks formatting and types, builds the static site, validates internal links, runs browser and accessibility checks, and deploys the generated artifact only after those checks pass. It uses the built-in short-lived GitHub token with read-only build access and narrowly scoped Pages deployment permissions.

`main` is protected: use a branch and pull request for changes. The `build` status check must pass before merging; force pushes and branch deletion are disabled. Review the preview before merging, because merging to `main` publishes the update.

## Custom domain

University IT manages DNS for `arms.engr.ucdavis.edu`, which points to `arms-laboratory.github.io`. The university hostname must also remain configured in repository **Settings → Pages → Custom domain**, with HTTPS enforced once its certificate is provisioned. A repository `CNAME` file is not required for this GitHub Actions workflow.

The `site` value in `astro.config.mjs`, the sitemap and robots.txt use the university address. The generated canonical links should always use HTTPS on that address. Keep these settings consistent when changing domains.

Retain the prior university website archive separately from this repository. Before retiring any previous hosting, confirm the archive with university IT. After domain or hosting changes, verify HTTPS, retained page paths, the student inquiry form, external links, accessibility and deployed performance.
