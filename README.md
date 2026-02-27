# Speichr

Speichr is an Electron desktop app for managing cache connections, workflow automation, observability, governance controls, and incident export workflows.

## Supported Release Artifacts

- Windows: Squirrel installer (`.exe`) and related update packages.
- macOS: ZIP archive (`.zip`).
- Linux: Debian package (`.deb`) and ZIP archive (`.zip`).

All release assets are built in GitHub Actions and attached to GitHub releases.

## Installation

### Windows

1. Download the latest Windows setup executable from the GitHub Release assets.
2. Run the installer and complete setup.

### macOS

1. Download the macOS ZIP from the GitHub Release assets.
2. Extract and move `Speichr.app` into `Applications`.
3. Open the app (Gatekeeper prompts may appear for unsigned builds).

### Linux (Debian/Ubuntu)

1. Download the `.deb` artifact from the GitHub Release assets.
2. Install:

```bash
sudo dpkg -i speichr_*_amd64.deb
sudo apt-get install -f
```

## Verify Artifacts

Each release includes `SHA256SUMS.txt`.

```bash
sha256sum -c SHA256SUMS.txt
```

Run the command in the same directory as the downloaded release assets and checksum file.

## Development

```bash
bun install
bun run start
```

Useful quality checks:

```bash
bun run typecheck
bun run lint
bun run test:all
bun run check:release:readiness
```

## Security

See `SECURITY.md` for vulnerability reporting guidance.
