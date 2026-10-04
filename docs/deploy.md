# Сборка и выкладка

```bash
npm run check        # линтеры + тесты + сборка
npm run preview      # посмотреть dist/ локально
```

Результат — папка `dist/`: HTML, `assets/` с хешами в именах файлов (`main-BI7qGVvk.js`),
содержимое `public/` как есть.

## Сайт в подпапке

`site.ru/promo/` или GitHub Pages (`user.github.io/repo/`):

```bash
BASE_URL=/promo/ npm run build
```

Иначе 404 на стили и скрипты. В React-стартере маршрутизатор подхватывает base сам.

## Вёрстка для бэкенда (CMS)

Отдайте `dist/` или ссылку на репозиторий. Бэкенд-разработчику важно:

- имена файлов в `assets/` меняются при каждой сборке — подключать их из `dist/*.html`
  или настроить `build.manifest: true` в `vite.config.js` (появится `manifest.json`
  «исходник → файл»);
- точки интеграции: `action` форм, мок-ответы в `mocks/` — это и есть «контракт» API;
- модули оживают по `data-module` — CMS может выводить блоки в любом порядке и количестве.

## SPA (React) на хостинге

Сервер должен отдавать `index.html` на любой путь, иначе обновление `/about` даст 404.

**nginx**

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

**Apache** (`public/.htaccess`)

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

**Netlify** (`public/_redirects`): `/*  /index.html  200`

**GitHub Pages**: скопируйте `dist/index.html` в `dist/404.html` после сборки.

## Кеширование

- `assets/*` — навсегда (`Cache-Control: immutable`): имя меняется вместе с содержимым.
- `*.html` — без долгого кеша (`no-cache`): иначе пользователи не увидят новую версию.

## Переменные окружения

`.env` (не в git) → `import.meta.env.VITE_…`. Для разных стендов: `.env.production`,
`.env.staging` + `vite build --mode staging`. Всё с `VITE_` попадает в код браузера — никаких
секретов.

## Тестовый домен

Пока сайт на тестовом адресе — закройте индексацию: в `public/robots.txt` `Disallow: /`.
Не забудьте открыть при запуске (см. [checklist.md](checklist.md)).
