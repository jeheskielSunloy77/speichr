# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-03-10

### Changed

- Rebranded the desktop app from `Speichr` to `Volatile` across package metadata, installer metadata, runtime titles, and project documentation.
- Updated runtime identifiers to the new brand, including package name, executable name, bundle ID, database filename, keychain service name, temporary export filenames, and repository URLs.

### Internal

- Replaced brand-coupled code identifiers with descriptive names, including `OperationsService`, `DesktopApi`, `desktopApi`, and neutral IPC channel/type naming.
- Renamed preload and application module filenames to remove the product name from source structure and test entrypoints.

## [1.2.0] - 2026-02-27

### Added

- Added namespace domain support and scoped cache operations.
- Added namespace selection and scoped workspace flows.
- Added a standalone connections management page with search and filters.
- Added a shared app layout and global alerts popover.
- Added resizable panel support with drag handles.
- Added exact key counting and prefix-aware key listing.
- Redesigned the key workspace with modal key upsert and visualizer flows.

### Changed

- Split the app into routed connections and workspace screens.
- Split workspace tools into mode-aware panels.
- Widened the connection upsert dialog.

### Removed

- Removed native system notifications and kept in-app alerts only.
- Removed the quick theme toggle row from settings.

### Internal

- Updated SQLite persistence tests for unread alert counts.
- Removed outdated AGENTS guidance for shadcn/ui components.

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
