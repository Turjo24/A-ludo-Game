# CSE4204 Final Project — SI 7: 3D Ludo (Three.js)

## Objects
- **Ludo board** — procedurally textured (canvas-drawn cross layout, 4 home yards, safe stars, center finish triangle), rendered with a custom lit shader.
- **Ludo dice** — six procedurally textured pip faces (1–6, opposite faces sum to 7), rendered with a custom lit shader, with a physically-plausible tumble-and-settle roll animation.

## Requirements implemented
| Requirement | Where |
|---|---|
| Custom shaders | `litVertexShader` + `boardFragmentShader` / `diceFragmentShader` in `main.js` (manual Blinn-Phong lighting, specular, fresnel, animated pulse) |
| Lighting | `AmbientLight`, `DirectionalLight` (shadow-casting sun), `PointLight` accent — values also fed into the custom shaders as uniforms |
| Perspective projection | `THREE.PerspectiveCamera` |
| Texture per object | Canvas-generated board skins, dice pip faces, wood table texture |
| Animation | Idle dice spin + full roll animation (tumble → slerp settle onto a random face) |
| Keyboard interaction | Arrow keys orbit/tilt the camera around the board, `W`/`S` zoom, `Space` rolls the dice |
| Mouse interaction | Click the board to cycle through 4 board skins (Classic / Neon / Pastel / Walnut) |

## Running it
This project follows the same npm + Vite setup used in Lab 6: Three.js is installed locally instead of being loaded from a CDN.

```bash
cd ludo-game
npm install --save three
npm install --save-dev vite
npx vite
```

(`node_modules/three` is already included here, so `npm install` just fills in Vite — after that, `npx vite` or `npm run dev` starts the dev server and opens the app.)

No external model/texture assets are required — everything is generated at runtime.
