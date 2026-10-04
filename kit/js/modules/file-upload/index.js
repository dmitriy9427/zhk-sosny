/**
 * Загрузка файлов: перетаскивание, превью, удаление, лимиты.
 *
 *   <div class="upload" data-module="file-upload"
 *        data-file-upload-max-files="3" data-file-upload-max-size="5"
 *        data-file-upload-accept="image/*,.pdf">
 *     <input class="upload__input" type="file" name="files" id="files" multiple>
 *     <label class="upload__zone" for="files">
 *       Перетащите файлы сюда или <u>выберите</u>
 *       <small data-file-upload-hint></small>
 *     </label>
 *     <ul class="upload__list" data-file-upload-list></ul>
 *   </div>
 *
 * Модуль работает поверх НАСТОЯЩЕГО <input type="file">: выбранные файлы
 * всегда лежат в input.files, поэтому их видят FormData, модуль form,
 * схема (s.files()) и обычная отправка формы — без отдельного кода.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Повторный выбор ЗАМЕНЯЕТ файлы (так устроен input) — пользователь
 *    выбрал 2 файла, потом ещё 1, и первые пропали. Здесь новые добавляются
 *    к списку (DataTransfer собирает итоговый список и кладётся в input.files).
 * 2. Тот же файл второй раз не выбирается (change не срабатывает, т.к.
 *    значение не изменилось) — после обработки сбрасываем value.
 * 3. Утечка памяти: превью через URL.createObjectURL держат файл в памяти,
 *    пока не вызван revokeObjectURL — вызываем при удалении и destroy.
 * 4. Браузер открывает файл в вкладке, если промахнуться мимо зоны при
 *    перетаскивании — гасим drop по всему окну, пока модуль активен.
 * 5. Дубликаты (тот же файл дважды) — отбрасываем по имени+размеру+дате.
 * 6. accept в input — только подсказка для окна выбора; при перетаскивании
 *    он не работает. Проверяем тип сами.
 * Ошибки (большой файл, не тот тип, слишком много) — под полем, как у формы.
 * @module kit/modules/file-upload
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { formatSize, matchesAccept } from '../../form/schema.js'
import { t } from '../../core/i18n.js'

const DEFAULTS = {
  /** Максимум файлов (0 — без ограничения; без multiple — всегда 1). */
  maxFiles: 0,
  /** Максимальный размер одного файла, МБ (0 — без ограничения). */
  maxSize: 0,
  /** Разрешённые типы: 'image/*,.pdf'. Пусто — берётся accept у input. */
  accept: '',
  /** Показывать превью картинок. */
  preview: true,
}

const fileKey = (f) => `${f.name}:${f.size}:${f.lastModified}`

/**
 * Отобрать файлы, которые можно добавить. Чистая функция — для тестов.
 * @returns {{ accepted: File[], errors: string[] }}
 */
export function pickFiles(current, incoming, { maxFiles = 0, maxSize = 0, accept = [] } = {}) {
  const accepted = []
  const errors = []
  const known = new Set(current.map(fileKey))
  for (const file of incoming) {
    if (known.has(fileKey(file))) continue
    if (accept.length && !matchesAccept(file, accept)) {
      errors.push(t('kit.schema.fileType', { name: file.name, types: accept.join(', ') }))
      continue
    }
    if (maxSize && file.size > maxSize * 1024 * 1024) {
      errors.push(t('kit.schema.fileSize', { name: file.name, size: formatSize(maxSize * 1024 * 1024) }))
      continue
    }
    if (maxFiles && current.length + accepted.length >= maxFiles) {
      errors.push(t('kit.upload.tooMany', { count: maxFiles }))
      break
    }
    known.add(fileKey(file))
    accepted.push(file)
  }
  return { accepted, errors }
}

export default function fileUpload(root, ctx = {}) {
  const options = readOptions(root, 'file-upload', DEFAULTS, ctx.options)
  const input = root.querySelector('input[type="file"]')
  if (!input) throw new Error('[kit] file-upload: нужен <input type="file"> внутри')
  const d = createDisposer()
  const list = root.querySelector('[data-file-upload-list]')
  const zone = root.querySelector('.upload__zone, label') ?? root
  const hint = root.querySelector('[data-file-upload-hint]')
  const accept = (options.accept || input.accept || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const maxFiles = input.multiple ? options.maxFiles : 1
  if (accept.length) input.accept = accept.join(',')
  const previews = new Map() // file → objectURL
  let files = Array.from(input.files ?? [])

  if (hint && !hint.textContent.trim()) {
    hint.textContent = [
      accept.length && accept.join(', '),
      options.maxSize && t('kit.upload.upTo', { size: formatSize(options.maxSize * 1024 * 1024) }),
      maxFiles > 1 && t('kit.upload.maxCount', { count: maxFiles }),
    ]
      .filter(Boolean)
      .join(' · ')
  }

  // Ошибки показываем в том же месте и так же, как модуль form.
  const errorBox = () => {
    let box = root.querySelector('[data-form-error]')
    if (!box) {
      box = document.createElement('p')
      box.className = 'field__error'
      box.setAttribute('data-form-error', '')
      root.append(box)
    }
    return box
  }
  const showErrors = (errors) => {
    const box = errorBox()
    box.textContent = errors.join('. ')
    if (errors.length) box.setAttribute('role', 'alert')
    else box.removeAttribute('role')
    root.classList.toggle('is-invalid', errors.length > 0)
  }

  /** Положить список в input.files, чтобы его видели FormData и форма. */
  const commit = () => {
    if (typeof DataTransfer !== 'undefined') {
      const transfer = new DataTransfer()
      files.forEach((f) => transfer.items.add(f))
      input.files = transfer.files
    }
    render()
    root.classList.toggle('has-files', files.length > 0)
    root.dispatchEvent(new CustomEvent('file-upload:change', { bubbles: true, detail: { files: [...files] } }))
  }

  const revoke = (file) => {
    const url = previews.get(file)
    if (url) URL.revokeObjectURL(url)
    previews.delete(file)
  }

  function render() {
    if (!list) return
    list.replaceChildren(
      ...files.map((file, index) => {
        const item = document.createElement('li')
        item.className = 'upload__item'
        if (options.preview && file.type.startsWith('image/') && typeof URL.createObjectURL === 'function') {
          if (!previews.has(file)) previews.set(file, URL.createObjectURL(file))
          const img = document.createElement('img')
          img.className = 'upload__preview'
          img.src = previews.get(file)
          img.alt = ''
          item.append(img)
        }
        const name = document.createElement('span')
        name.className = 'upload__name'
        name.textContent = file.name // textContent: имя файла может содержать «<script>»
        const size = document.createElement('span')
        size.className = 'upload__size'
        size.textContent = formatSize(file.size)
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.className = 'upload__remove'
        remove.setAttribute('aria-label', t('kit.upload.remove', { name: file.name }))
        remove.textContent = '×'
        remove.addEventListener('click', () => {
          revoke(file)
          files = files.filter((f) => f !== file)
          showErrors([])
          commit()
          // Фокус — на соседний «удалить» или на поле, а не «в никуда».
          const buttons = list.querySelectorAll('.upload__remove')
          ;(buttons[Math.min(index, buttons.length - 1)] ?? input).focus()
        })
        item.append(name, size, remove)
        return item
      }),
    )
  }

  function add(incoming) {
    const { accepted, errors } = pickFiles(files, incoming, { maxFiles, maxSize: options.maxSize, accept })
    // Без multiple новый файл заменяет старый (как обычный input).
    if (maxFiles === 1 && accepted.length) {
      files.forEach(revoke)
      files = []
    }
    files = [...files, ...accepted]
    showErrors(errors)
    commit()
  }

  // Выбор через окно: input.files сейчас = ТОЛЬКО новые файлы.
  d.listen(input, 'change', () => {
    const incoming = Array.from(input.files ?? [])
    if (!incoming.length && files.length) {
      // Нажали «Отмена» в окне выбора — Chrome очищает input. Возвращаем список.
      commit()
      return
    }
    add(incoming)
    input.value = '' // чтобы тот же файл можно было выбрать снова…
    commit() // …а input.files снова содержал весь список
  })

  // Перетаскивание.
  let depth = 0 // dragenter/dragleave срабатывают на каждом потомке — считаем вложенность
  d.listen(zone, 'dragenter', (e) => {
    e.preventDefault()
    depth++
    root.classList.add('is-dragover')
  })
  d.listen(zone, 'dragover', (e) => e.preventDefault())
  d.listen(zone, 'dragleave', () => {
    depth = Math.max(0, depth - 1)
    if (!depth) root.classList.remove('is-dragover')
  })
  d.listen(zone, 'drop', (e) => {
    e.preventDefault()
    depth = 0
    root.classList.remove('is-dragover')
    add(Array.from(e.dataTransfer?.files ?? []))
  })
  // Промах мимо зоны не должен открывать файл вместо сайта.
  const stop = (e) => {
    if (e.dataTransfer?.types?.includes?.('Files')) e.preventDefault()
  }
  d.listen(window, 'dragover', stop)
  d.listen(window, 'drop', stop)

  if (input.form) {
    d.listen(input.form, 'reset', () => {
      files.forEach(revoke)
      files = []
      showErrors([])
      setTimeout(commit)
    })
  }

  d.add(() => {
    files.forEach(revoke)
    list?.replaceChildren()
  })
  render()

  return {
    get files() {
      return [...files]
    },
    add,
    clear() {
      files.forEach(revoke)
      files = []
      commit()
    },
    destroy: d.dispose,
  }
}
