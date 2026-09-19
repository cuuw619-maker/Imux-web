# Imux Web

Браузерная voxel-основа Imux на Three.js.

GitHub Pages: https://cuuw619-maker.github.io/Imux-web/

## Игровая база

- Minecraft-style движение с ускорением, трением и отдельной скоростью ходьбы/спринта.
- Shift — sprint.
- Ctrl — sneak.
- Space — jump.
- LMB — break block.
- RMB — place block.
- Колесо — смена hotbar slot.
- E — inventory.
- Esc — release mouse.
- Объёмная AABB-коллизия игрока с блоками.
- Автоматический step-up до 0.6 блока.

## Chunk streaming

Мир больше не является одной заранее созданной плоскостью.

- Размер чанка: 16x16 блоков.
- Высота мира: 40 блоков.
- Дальность загрузки: 4 чанка от текущего чанка игрока.
- Чанки генерируются детерминированным procedural noise.
- Дальние чанки выгружаются.
- Внутренние полностью закрытые блоки не добавляются в chunk render.
- Для групп одинаковых блоков используется InstancedMesh.

При переходе игрока через границу чанка новые области автоматически загружаются, а старые выгружаются.

## Panorama главного меню

Файлы lakeside_sunset_panorama_0.png ... lakeside_sunset_panorama_5.png используются только меню.

Камера стоит в центре куба.

Для Three.js BoxGeometry используется точная матрица:

- +X = _3.png = East / Left.
- -X = _1.png = West / Right.
- +Y = _4.png = Up / Top.
- -Y = _5.png = Down / Bottom.
- +Z = _0.png = South / Front.
- -Z = _2.png = North / Back.

Начальный взгляд камеры направлен на South (+Z). Затем камера медленно вращается вокруг Y примерно на 2.4 градуса в секунду, что соответствует заданному диапазону на типичной частоте кадров.

lakeside_sunset_panorama_overlay.png находится над canvas как 2D overlay с альфа-смешиванием и небольшим backdrop blur.

Игровое небо — отдельный procedural shader. Menu panorama в него не попадает.

## Texture pipeline

Ресурсы расположены в:

assets/minecraft/textures/block/
assets/minecraft/textures/gui/
assets/minecraft/textures/gui/container/
assets/minecraft/textures/gui/title/background/
assets/minecraft/textures/colormap/

Grass block:

- grass_block_top.png — grayscale top texture, умножаемая на biome grass colormap.
- dirt.png — базовая боковая и нижняя текстура.
- grass_block_side_overlay.png — отдельный grayscale grass overlay для боков, также tint-ится colormap.
- grass_block_snow.png — отдельная snow-side texture для будущего snow state.

Обычные блоки не получают green tint.

dirt_path_top.png и dirt_path_side.png используются для блока высотой 15/16.

## HUD

crosshair.png выводится через difference blending.

Attack indicator использует background/progress/full.

10 hunger icons используют full/half/empty и варианты *_hunger.

hotbar.png — фон 9 слотов; hotbar_selection.png — рамка выбора; offhand показывается только когда вторая рука занята.

inventory.png — фон окна 176x166; сетка слотов строится программно.

## Структура

Imux-web/
  index.html
  style.css
  README.md
  src/
    main.js
    world.js
    chunk.js
    blocks.js
  assets/minecraft/textures/

## Локальный запуск

python -m http.server 8000

Открыть http://localhost:8000/

## Репозиторий

https://github.com/cuuw619-maker/Imux-web

