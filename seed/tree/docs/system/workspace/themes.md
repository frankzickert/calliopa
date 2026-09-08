# Themes

## Theme System

* Components use semantic CSS custom properties, never fixed colors: `canvas`, `panel`, `panel-raised`, `border`, `text`, `text-muted`, `accent`, `selection`, `success`, `warning`, `error`, `running`, `timeline-track`, `waveform`, `playhead`.
* Themes are configuration objects mapped to these tokens, so branded or accessibility-oriented themes can be added without touching components.
* The toggle supports `light`, `dark`, and `system`. The choice persists per browser and is applied before first paint so arrival and navigation never flash the wrong ground.

- The default dark theme uses graphite surfaces with restrained cyan/electric-blue interaction color, amber for attention, and coral-red for errors.
- The default light theme preserves the same hierarchy without becoming sterile white.
- Fonts use `--font-ui` with a system sans stack for chrome, `--font-narrative` with a system serif stack for script and narrative text, and `--font-mono` with self-hosted Fira Code (OFL) for timecodes and process output. A later licensed sans or serif may replace a system stack without changing components.

## Implementation

- Dark and light configuration objects generate the complete semantic color-token contract before body paint. Chrome uses a system UI stack, narrative surfaces use a system serif stack, and time/process output uses the self-hosted Fira Code asset. Behavior coverage rejects literal colors in component styles (`CA_0002_012`).
- The header toggle cycles `light → dark → system`, persists the choice per browser, resolves system preference, and updates immediately. An inline head script applies persisted choice before body paint; Playwright proves cycling, reload, arrival theme, and accessibility (`CA_0002_013`).
