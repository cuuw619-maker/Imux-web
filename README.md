# Imux Web

Браузерная voxel-основа Imux. Сейчас это минимальный игровой прототип: 3D-мир, FPS-камера, процедурный terrain, блоки, взаимодействие и Minecraft-подобный HUD.

## Play

**GitHub Pages:** https://cuuw619-maker.github.io/Imux-web/

Открой ссылку в браузере. После загрузки кликни по миру, чтобы захватить мышь.

Управление:

| Клавиша / действие | Функция |
|---|---|
| WASD | движение |
| Space | прыжок |
| ЛКМ | сломать блок |
| ПКМ | поставить выбранный блок |
| 1–9 | выбор слота |
| Q / E | предыдущий / следующий слот |
| Esc | отпустить мышь |

## Что уже есть

- Three.js WebGL renderer через ES modules.
- Pointer Lock FPS-управление.
- Гравитация и прыжок.
- Процедурный voxel terrain.
- Реальные блоки в data-map.
- Raycast из центра экрана.
- Разрушение и установка блоков.
- Защита от установки блока внутрь игрока.
- `InstancedMesh` вместо отдельного `Mesh` на каждый блок.
- Minecraft-подобные `hotbar`, selection и crosshair из добавленных ассетов.
- Кубическая panorama из `lakeside_sunset_panorama_0..5.png`.
- Pixel-art фильтрация текстур через nearest filtering.
- Выбор блока через 1–9 и Q/E.

## Структура

```text
Imux-web/
├─ index.html
├─ style.css
├─ README.md
├─ src/
│  ├─ main.js
│  ├─ blocks.js
│  └─ world.js
└─ *.png
```

Текстуры и GUI лежат в корне репозитория, поэтому GitHub Pages может отдавать их напрямую без отдельного asset-сервера.

## Архитектура базы

`blocks.js` — реестр блоков, hotbar и загрузка текстур.

`world.js` — voxel data, генерация terrain, высота поверхности, установка/удаление блоков и instanced rendering.

`main.js` — renderer, камера, pointer lock, ввод, raycast и игровой цикл.

Это намеренно небольшая база. Следующие слои можно добавлять поверх неё без переписывания текущего мира.

## Следующие этапы

1. Нормальная chunk-система и генерация вокруг игрока.
2. Корректный collision controller вместо проверки одной высоты.
3. Texture atlas и отдельные текстуры верх/низ/стороны блоков.
4. Полный главный экран, pause menu и настройки.
5. Inventory, предметы и сохранение мира в IndexedDB.
6. Water, освещение, частицы, звук и sky transition.
7. Worker-based world generation и дальнейшая оптимизация.

## Локальный запуск

GitHub Pages уже используется как публичный сайт. Для локальной разработки достаточно любого статического HTTP-сервера:

```bash
python -m http.server 8000
```

Затем открой `http://localhost:8000/`.

Three.js подключается с jsDelivr, поэтому первый запуск требует доступа к CDN.

## Repository

https://github.com/cuuw619-maker/Imux-web