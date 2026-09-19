# Imux Web

Браузерная voxel-основа Imux на Three.js.

GitHub Pages: https://cuuw619-maker.github.io/Imux-web/

## Сейчас

Используется небольшая рабочая архитектура без сборщика: index.html -> src/main.js -> src/world.js / src/blocks.js.

В игре уже есть:

- FPS-камера через Pointer Lock.
- Правильное направление WASD: W вперёд, S назад.
- Прыжок и гравитация.
- Объёмная AABB-коллизия игрока с блоками.
- Raycast из центра экрана.
- ЛКМ ломает блок.
- ПКМ ставит выбранный блок.
- После разрушения блок попадает в пустой слот hotbar.
- При старте hotbar пустой.
- Колесо мыши переключает полученные блоки.
- Номера клавиш выбирают слот, но цифры не рисуются поверх интерфейса.
- InstancedMesh для рендера большого количества блоков.
- Отдельные материалы для верхней, боковых и нижней граней grass block.
- dirt.png, stone.png, cobblestone.png, coarse_dirt.png, rooted_dirt.png, dirt_path_top.png, dirt_path_side.png, bedrock.png.
- Minecraft-подобные hotbar.png, hotbar_selection.png и crosshair.png.

## Панорама

Файлы lakeside_sunset_panorama_0.png ... lakeside_sunset_panorama_5.png используются только главным меню.

Они больше не назначаются фоном игрового мира. Для игрового неба используется отдельный процедурный shader sky.

Раскладка panorama сделана отдельным cube renderer с порядком граней 1, 3, 4, 5, 0, 2.

## Текстуры блоков

Для grass block используются отдельные роли текстур:

- grass_block_top — верх.
- grass_block_side — боковые стороны.
- dirt — низ.

В загруженном наборе не было файлов grass_block_top.png и grass_block_side.png, поэтому эти две 16x16 текстуры встроены непосредственно в blocks.js, а остальные материалы берутся из добавленных PNG.

Для остальных блоков используется соответствующая texture-name схема: stone, dirt, cobblestone, coarse_dirt, rooted_dirt, dirt_path_top, dirt_path_side, bedrock.

## Управление

WASD — движение.

Space — прыжок.

ЛКМ — разрушить блок.

ПКМ — поставить блок.

Колесо мыши — переключить полученные блоки.

Цифровые клавиши — выбрать слот.

Esc — отпустить мышь.

## Структура

Imux-web/
  index.html
  style.css
  README.md
  src/
    main.js
    blocks.js
    world.js
  *.png

## Локальный запуск

python -m http.server 8000

Открыть http://localhost:8000/

Three.js подключается через jsDelivr. Браузеру также требуется поддержка ES modules и Pointer Lock.

## Дальше

1. Chunk system и генерация мира вокруг игрока.
2. Face culling / greedy meshing.
3. Полная inventory-система.
4. Отдельные верх/низ/бок текстуры для всех блоков.
5. Pause menu и настройки.
6. IndexedDB-сохранение мира.
7. Worker-based generation.
8. Вода, освещение, частицы, звук и world-time.

## Репозиторий

https://github.com/cuuw619-maker/Imux-web

