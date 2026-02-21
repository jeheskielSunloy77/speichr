# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-02-21

### Changed

- Project renamed from "cachify-studio" to "speichr" — this release updates branding and package identifiers to use the new name.

## [1.0.1] - 2026-02-19

### Fixed

- Fixed Linux `.deb` startup crash caused by a missing runtime `keytar` module in packaged releases.
- Updated Electron Forge Vite packaging filters so required native runtime dependencies are bundled correctly.
- Added resilient secret-store initialization: when keychain integration is unavailable, the app falls back to in-memory secret storage instead of crashing.

## [1.0.0] - 2026-02-18

### Added

- Initial stable desktop release for Speichr.
- Multi-platform release packaging for Windows, macOS, and Linux.
- Release workflow with CI validation gates and checksum publishing.
