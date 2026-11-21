# Kongshan · A Chinese Temple You Can Step Into

[中文](README.md) | English

[![CI](https://github.com/haoyangyuying/kongshan/actions/workflows/ci.yml/badge.svg)](https://github.com/haoyangyuying/kongshan/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2f6f4e.svg)](LICENSE)

> The gate is always open. Stay quiet, stay as long as you like.  
> Light a stick of incense, knock the wooden fish three times, and sit in front of the hall with strangers for a while.

Kongshan is a fully procedural Chinese temple built with WebGL, Three.js, TypeScript, and Vite. It is not a game: there are no quests, levels, rankings, or accounts. It is a place you can walk into for three minutes and then leave.

It is inspired by the “silent co-presence” of the Korean online temple [Sansatemple](https://sansatemple.com/), but the architecture, texts, sound, interactions, and code are original to this project.

**Live (static Workers build):** <https://kongshan.291540038.workers.dev/>

The Workers version serves the static site; real-time seat presence falls back to a local single-player simulation. For the full seat service, run the Node server locally.

## What you can do

| Place | Action | Detail |
| --- | --- | --- |
| Incense burner | **Light incense** | Press `E`: the monk takes three sticks, steps forward, and plants them. Smoke and glowing tips follow. |
| Main hall | **Bow** | Three bows with wooden-fish and bell sounds. |
| Hall | **Wooden fish** | One knock, one merit point; sound is synthesized live. |
| Bell / drum tower | **Bell / drum** | Enter the tower, hold the striker or drumstick, and strike; the character, tool, instrument, and sound move together. |
| Library | **Draw a lot** | One Guanyin lot per day, with a modern reading. |
| Library | **Copy a sutra** | Trace the Heart Sutra on paper with a finger or mouse. |
| Release pond | **Release a lantern** | Choose a colour, write a wish, and send a lotus lantern onto the water. |
| Ginkgo tree | **Tie a ribbon** | Leave a sentence in the branches. |
| Cushion | **Chant** | Choose a sutra and 5 / 15 / 30 minutes. The monk finds an empty cushion, sits, holds a wooden fish and mallet, and chants automatically. The browser reads the sutra aloud with the system Chinese voice; you can turn the voice off. |
| Cushion | **Sit quietly** | 3 / 5 / 10 / 20 minutes of breathing with a quieter camera. |
| Seven-storey pagoda | **Circumambulate** | Walk one slow circuit around the pagoda. Merit +5. |
| Steles, lanterns, ribbons | **Read** | Old words left in the mountain. |

Walking is constrained: no walking into the pond, through walls, tables, the bell, or the drum. If you get stuck, the character steps out automatically, and `R` returns to the gate.

## Controls

- **Move:** `W A S D`, arrow keys, click the ground, or the mobile joystick (bottom left).
- **Look:** drag; scroll or pinch to zoom.
- **Interact:** press `E` near a prompt, or tap the mobile action button.
- **Chant:** `E` at the cushions; choose a sutra and duration; chanting and the Chinese voice start automatically.
- **Return to gate:** `R`.
- **Nav:** `M`; **wishes:** `H`; **meditate:** `Q`; **copy sutra:** `J`; **time:** `T`; **sound:** `P`.
- `Esc` closes panels / ends meditation.

The first visit may take 10–30 seconds to compile shaders, especially on integrated graphics. Wait for the loading screen to finish.

## Nine cushions

The hall has nine cushions. One is kept for the resident monk; the other eight are for real visitors when the Node seat service is running.

- Two people entering at the same time can see each other sit down.
- If all seats are occupied, the next visitor is told the cushions are full.
- Standing up, cancelling, or closing the page releases the seat.
- The online count is the real number of WebSocket connections; the walking NPCs are scenery and are not counted.

When deployed only as static assets (Cloudflare Workers/Pages), the seat service is not running and the app falls back to a local single-player simulation.

## Run locally

Requires Node 20.19+ (Node 22 recommended).

```bash
npm install
npm run dev       # http://127.0.0.1:5199
npm run build     # type check + production build
npm run serve     # http://127.0.0.1:5200 with the seat service
npm run preview   # static preview only, no seat service
```

## Deploy to Cloudflare Workers

The repository includes `wrangler.jsonc` and `worker/index.js` for static assets.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Output directory | `dist` |
| Node version | 22 or 24 |

The static Worker serves `dist`. It cannot run `server.mjs` or real-time WebSocket seats; those require a Node server plus a named tunnel, or a Cloudflare Durable Object implementation.

A Cloudflare Pages deployment is also possible with build command `npm run build` and output `dist`; the same seat limitation applies.

## Tech

- **Three.js + TypeScript + Vite**, no external 3D models or texture libraries. Architecture, Buddhas, trees, water, clouds, and particles are procedural.
- **WebAudio** synthesizes bells, chimes, wooden fish, drums, wind, water, birds, insects, and a low chant bed. No audio files.
- **Web Speech API** reads the chosen sutra with the operating system's Chinese voice. No external TTS service.
- **Adaptive resolution** adjusts pixel ratio between 0.7 and 1.35; `?hq=1` pins high quality for screenshots.
- **Accessible:** keyboard-only operation for main actions; reduced-motion support; focus-managed panels.
- **localStorage:** wishes, lanterns, ribbons, lots, merit, time, mute, visits; key `kongshan.v1`.

## Privacy and security

- No accounts, no chat, no analytics, no tracking scripts.
- The seat service keeps anonymous connection IDs, seat occupancy, and connection count in memory; it does not persist IP addresses or messages.
- See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).
- Do not commit API tokens, Cloudflare certificates, private keys, or `.env` files.
- `server.mjs` binds to `127.0.0.1` by default; put it behind a reverse proxy and set `ALLOWED_ORIGINS` when exposing it publicly.

## Open source

- Code and original content: **MIT**, see [LICENSE](LICENSE).
- Third-party dependencies and public-domain texts: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Contributions: [CONTRIBUTING.md](CONTRIBUTING.md).
- Changelog: [CHANGELOG.md](CHANGELOG.md).

## Credits

- [Sansatemple](https://sansatemple.com/) for the “silent co-presence” idea; no assets or code were copied.
- Chinese Chan/Huayan/Pure Land textual traditions; the Heart Sutra and other classical excerpts are public domain.
- The Guanyin lots are traditional folk texts; the modern readings are original to this project.

## Contact

Email: <yanghaoyuying@126.com>

## Disclaimer

Kongshan is a fictional digital temple. It is not a real religious venue, is not affiliated with any religious organization, and does not provide religious services, divination, or medical advice. If you are going through something you cannot carry alone, please seek help from a real person or a qualified professional.
