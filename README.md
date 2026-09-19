# Imux Web

Web voxel prototype of Imux.

GitHub Pages: https://cuuw619-maker.github.io/Imux-web/

## Texture layout

Resources are stored under the Minecraft-style namespace:

assets/minecraft/textures/block/
assets/minecraft/textures/gui/
assets/minecraft/textures/gui/container/
assets/minecraft/textures/gui/title/background/
assets/minecraft/textures/colormap/

Block textures are addressed by block face instead of applying one flat texture to every face.

Grass block:
- grass_block_top.png — grayscale top mask, multiplied by the biome grass colormap.
- dirt.png — normal dirt base for the bottom and side base.
- grass_block_side_overlay.png — transparent grayscale grass edge overlay, tinted by the biome colormap.
- grass_block_snow.png — snow-covered side texture reserved for the snow state.

Ordinary blocks are rendered without tinting: dirt, coarse_dirt, rooted_dirt, stone, cobblestone and bedrock.

Dirt path uses dirt_path_top.png and dirt_path_side.png and is 15/16 block high.

The biome lookup texture is assets/minecraft/textures/colormap/grass.png. The current project uses it as a small local LUT so the shader samples a real texture instead of hard-coding one green color.

## Menu panorama

lakeside_sunset_panorama_0.png ... lakeside_sunset_panorama_5.png are used only by the main menu.

Panorama face mapping:
0 = right, 1 = left, 2 = top, 3 = bottom, 4 = front, 5 = back.

The panorama rotates slowly around Y. lakeside_sunset_panorama_overlay.png is drawn above it as a 2D alpha overlay.

The gameplay sky is a separate procedural shader and never uses the menu panorama.

## HUD

crosshair.png is rendered in the center with difference blending so its white pixels invert the background.

crosshair_attack_indicator_background.png, progress.png and full.png are used by the attack indicator.

food_full.png, food_half.png and food_empty.png render the normal 20-point hunger bar. The *_hunger variants are available for a future Hunger effect state.

hotbar.png is the 9-slot background. hotbar_selection.png moves with the selected slot. Offhand textures are hidden while the second hand is empty.

inventory.png is the 176x166 inventory background. Slot positions are calculated in JavaScript.

## Controls

WASD — movement.
Space — jump.
LMB — break block.
RMB — place block.
Mouse wheel — change hotbar slot.
1-9 — select hotbar slot.
E — open/close inventory.
Esc — release mouse.

Hotbar starts empty. Breaking blocks adds them to the inventory.

## Project

index.html loads the browser entry point.
src/main.js contains the renderer, input, FPS controller, menu, HUD, inventory and interaction loop.
src/world.js contains voxel data, generation, collision, instanced rendering and block edits.
src/blocks.js contains block definitions, texture paths and grass tint materials.

## Run locally

python -m http.server 8000

Open http://localhost:8000/

## Repository

https://github.com/cuuw619-maker/Imux-web

