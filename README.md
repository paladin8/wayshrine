# Wayshrine

An open-ended, non-combat exploration game in a low-poly isometric style. Walk an endless procedural world of dead, grey lands; restore each region's shrine and the land around it comes alive. Each restoration unlocks the means to cross terrain that was closed to you (boat, snowshoes, walking sticks, geta, lantern, ash sandals, ship) and uncovers more of an older, more advanced civilisation that the shrines once powered.

Three.js + TypeScript + Vite. Runs in the browser and as a desktop app.

## Run

```
npm install
npm run dev        # http://localhost:5173  (?seed=anything picks the world)
npm run check      # typecheck + tests + production build
```

Press **Z** for a brief wide view while exploring.

For a public web build, set `VITE_SITE_URL` to the published site URL (including any subdirectory) before running `npm run build`. The build uses it for the canonical URL and social preview image.

## Desktop builds

Toggle fullscreen in **Options** or with **F11**. **Quit game** is available on the title screen and in the in-game settings. Quitting from the game saves your journey.

Use Node.js 24 and run `npm ci`, then `npm run desktop:package` on your platform. The build goes in `release/`. The **Desktop release** GitHub Actions workflow also builds both platforms on demand and on `v*` tags.

| Platform | Bundle | Steam launch option |
| --- | --- | --- |
| Windows x64 | `Wayshrine-win32-x64/` | `Wayshrine.exe` |
| macOS (Apple silicon and Intel) | `Wayshrine-darwin-universal/` | `Wayshrine.app` |

Download the workflow's ZIP artifacts, then upload the unpacked contents of each bundle folder to its own [SteamPipe depot](https://partner.steamgames.com/doc/sdk/uploading). Steam installs the whole folder. Progress and preferences are stored in the desktop app's own profile.

The macOS workflow produces ad hoc signed builds for testing. To build for release, install a Developer ID Application certificate and create a `notarytool` keychain profile on a Mac. Set `WAYSHRINE_MAC_SIGN_IDENTITY` to that certificate name and `WAYSHRINE_MAC_NOTARY_PROFILE` to the profile name before running `npm run desktop:package -- mac`. [macOS signing and notarization](https://www.electronforge.io/guides/code-signing/code-signing-macos)

## Where to look

| You want to… | Read |
| --- | --- |
| Understand the game and its design intent | [docs/DESIGN.md](docs/DESIGN.md) |
| Understand how the code is organised, and add to it | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Know why a choice was made | [docs/decisions/](docs/decisions/) |
| See what is built and what is next | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Work on the code with an AI agent | [CLAUDE.md](CLAUDE.md) |

Full index: [docs/README.md](docs/README.md).

## License

Code: [Apache License 2.0](LICENSE). The collection of Japanese texts shown on the
monuments is separate and licensed CC BY-SA 4.0; see [content/LICENSE.md](content/LICENSE.md).
