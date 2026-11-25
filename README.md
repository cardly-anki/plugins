# Cardly Plugins Registry

Official catalog and community add-ons for [Cardly](https://github.com/cardly-anki/cardly).

## How Add-ons Work in Cardly

Unlike desktop Anki add-ons (Python + Qt), Cardly add-ons are lightweight **ES Modules (JavaScript/TypeScript)** running in the browser via the `PluginSDK`.

### Plugin Structure

A plugin is either a single `.js` / `.mjs` file or a `.cardlyaddon` / `.zip` archive containing:
- `manifest.json` — metadata (`id`, `name`, `version`, `description`, `author`, `permissions`)
- `index.js` — ES module exporting `default { onLoad(sdk) { ... } }`

### Available Slots
- `decks:top` — above the deck list
- `decks:bottom` — below the deck list
- `reviewer:actions` — bottom action bar in the reviewer
- `card:after` — directly below the active card content

### Permissions
- `ui:decks` — mount UI in `decks:top` / `decks:bottom`
- `ui:reviewer` — mount UI in `reviewer:actions` / `card:after`
- `events:cards` — subscribe to `card:shown` / `card:answered`
- `events:app` — subscribe to `decks:updated` / `sync:completed`
- `storage` — persistent per-plugin key-value storage
- `app:read` — read-only app state (`view`, `currentDeckId`, `theme`, etc.)

## Submitting a Plugin
Open a Pull Request adding your plugin entry to `registry.json` (with `id`, `name`, `version`, `description`, `author`, `permissions`, and `codeUrl` or `packageUrl`).
