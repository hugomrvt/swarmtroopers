# Changelog

## 0.5.0 (2026-11-22)

### Changed
- The finale is now a small clap where the orchestrator stands: two emoji-sized hands, a short burst and both name tags. The completion panel, its title and its summary line are gone, and the page stays fully visible.
- The supplied finale artwork is two SVG hands instead of nine WebP layers. The full script went from about 89 kB to about 32 kB gzipped.

### Removed
- `chat.summary` and its `{t}`, `{a}`, `{d}` placeholders: the finale no longer shows text. The option is ignored if passed.

### Fixed
- The pressed button of the quality switch was invisible on some themes.

Earlier versions are described in the commit history.
