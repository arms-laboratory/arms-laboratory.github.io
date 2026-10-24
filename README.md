# ARMS Laboratory website

Static Astro and TypeScript source for the ARMS Laboratory at the University of California, Davis. Initial public address: https://arms-laboratory.github.io.

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

The browser suite covers desktop and phone layouts, publication expansion/search/topic filtering, keyboard navigation, the mobile menu, reduced motion, image loading, research-card alignment, the hybrid grid-mold layout, and automated accessibility checks against WCAG 2.2 AA tags. Automated checks do not establish full accessibility conformance; human review and deployed-site performance checks remain part of release review.

`npm run validate` checks all generated internal links and anchors, all 44 publication records, and the student inquiry URL. `node scripts/check-external.mjs` optionally reports external-link HTTP responses; publishers may reject automated requests even when a link works in a browser. Browser reports are generated in `playwright-report/`, which is excluded from Git.

## Content

- `src/pages/` contains page content and useful older page addresses, including `/map/`.
- `src/data/publications.json` contains the complete bibliography. Missing article links are intentionally omitted.
- `src/components/` and `src/styles/` contain the shared design.
- `public/images/` contains selected optimized image derivatives with metadata removed. Keep image descriptions accurate and preserve scientific diagram content.

Original photographs, internal notes, local review snapshots, dependency folders, environment files, and generated builds do not belong in the public repository. `dist/` is generated; GitHub Actions builds it from source. This repository is the site project root; do not publish its parent workspace.

## GitHub Pages

Create an empty **public** repository named `arms-laboratory.github.io` owned by the `arms-laboratory` organization. Leave GitHub's README, license, and `.gitignore` initialization options unchecked when importing this prepared repository.

After the reviewed source is approved for its first public push, connect that repository as `origin` and push `main`. In repository **Settings → Pages**, choose **GitHub Actions** as the publishing source. Check the Actions result and review https://arms-laboratory.github.io in desktop and mobile browsers.

Every push to `main` runs validation and deployment. Pull requests run the same checks without deployment. The workflow installs locked dependencies, checks formatting and types, builds the static site, validates internal links, runs browser and accessibility checks, and deploys the generated artifact only after those checks pass. It uses the built-in short-lived GitHub token with read-only build access and narrowly scoped Pages deployment permissions.

After the first successful workflow, protect `main`: require pull requests and the `build` status check, and disable force pushes and branch deletion. Routine updates should be reviewed in a pull request before merging.

## Domain and release review

The intended future address is https://arms.engr.ucdavis.edu. Keep the initial `astro.config.mjs` site setting and sitemap on the GitHub Pages address during review. Do not configure a custom domain or change university DNS until the GitHub Pages version has been approved.

At the approved domain transition, coordinate GitHub Pages custom-domain settings and DNS with university IT, update the site URL and sitemap, and verify HTTPS and all retained page paths. A repository `CNAME` file is not required for this GitHub Actions publishing workflow.

Before the university cutover, confirm member details and image publication permissions, test the student inquiry form, inspect external destinations and accessibility manually, and measure performance on the deployed site.
