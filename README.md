# Secure Project Brief

A recruiter-facing candidate briefing page for Maxim Teleguz, designed for selective sharing with the Anduril Industries recruiting team.

This repository intentionally separates **presentation** from **content protection**:

- The GitHub Pages interface is public static content.
- The video is encrypted **before** it is committed.
- The passphrase is never stored in the repository or JavaScript.
- The browser derives a key from the supplied passphrase and decrypts the video locally.

## Security model

The encrypted video format uses:

- PBKDF2 with SHA-256 and 600,000 iterations
- a random 16-byte salt
- AES-256-GCM
- a random 12-byte IV

The encrypted file is stored as `assets/recruiter-brief.enc`.

Because GitHub Pages is static hosting, this is **encryption-based access control**, not server-side authentication. Anyone who knows the URL can download the encrypted blob, so use a long unique passphrase and deliver it separately from the page URL.

## Add the video

1. Open `tools/encrypt.html` locally in a modern browser.
2. Select the final MP4.
3. Enter the passphrase you intend to provide to the recruiter.
4. Download the encrypted output.
5. Rename it to `recruiter-brief.enc` if needed.
6. Place it at `assets/recruiter-brief.enc`.
7. Commit and push.

The encryption tool runs entirely in the browser. It does not upload the selected video anywhere.

> GitHub blocks normal repository files larger than 100 MiB. If the encrypted video approaches that size, host the encrypted blob in object storage and update `ENCRYPTED_VIDEO_URL` in `app.js`.

## Publish with GitHub Pages

In repository settings:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save.

Expected site URL:

`https://greyframe-labs.github.io/secure-project-brief/`

## Candidate positioning

The page is intentionally focused on:

- Siemens Teamcenter and NX
- PLM administration and engineering workflows
- configuration control and product data integrity
- CAD/PLM automation and internal tooling
- mission architecture and systems thinking
- hands-on builder mentality

The site does not use Anduril trademarks as its own branding, does not imply affiliation, and does not use actual security classification markings.
