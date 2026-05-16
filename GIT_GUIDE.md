# Руководство по Git для проекта Tanktoon Survivors

## Настройка (один раз)

```powershell
git config --global user.name "Твое Имя"
git config --global user.email "email@example.com"
git config --global credential.helper manager
```

## Базовый workflow

### Сохранить текущие изменения и отправить на GitHub

```powershell
git add .
git commit -m "описание изменений"
git push
```

### Проверить статус

```powershell
git status
```

### Посмотреть историю коммитов

```powershell
git log --oneline -10
```

---

## Workflow для работы с ИИ-ассистентом

### 1. Чекпоинт перед каждой сессией

```powershell
git add .
git commit -m "checkpoint: перед задачей X"
git push
```

### 2. Работа в отдельной ветке (рекомендуется)

```powershell
git checkout -b ai/task-name
# работаешь с ИИ, коммитишь по ходу
git add .
git commit -m "wip: ..."
git push -u origin ai/task-name
```

### 3. Если ИИ сломал код — откат одной командой

```powershell
git reset --hard HEAD~1
```

Откатит последний коммит. Все изменения из него будут потеряны.

### 4. Если работал в ветке и всё сломалось

```powershell
git checkout main
git branch -D ai/task-name
```

Ветка удалится, а `main` останется в чистом состоянии.

---

## Ветки

### Создать новую ветку и переключиться

```powershell
git checkout -b имя-ветки
```

### Переключиться между ветками

```powershell
git checkout main
git checkout имя-ветки
```

### Посмотреть все ветки

```powershell
git branch -a
```

### Удалить локальную ветку (после мержа или если не нужна)

```powershell
git branch -d имя-ветки   # мягкое удаление
git branch -D имя-ветки   # принудительное удаление
```

---

## Устранение конфликтов push/pull

### Если `git push` отклонён (remote contains work)

```powershell
git pull
git push
```

Если во время `pull` возник конфликт:
- IDE покажет конфликтные файлы
- Выбери нужные изменения
- Закоммить результат:

```powershell
git add .
git commit -m "merge: разрешён конфликт"
git push
```

---

## Полезные алиасы (сокращения)

Добавь в консоль PowerShell (один раз):

```powershell
function gs { git status }
function ga { git add . }
function gc($msg) { git commit -m "$msg" }
function gp { git push }
function gco($branch) { git checkout $branch }
function gcb($branch) { git checkout -b $branch }
```

После этого:
- `gs` — статус
- `ga` + `gc "msg"` + `gp` — быстрый коммит и пуш
- `gcb ai/new-feature` — новая ветка

---

## Правила для проекта

1. **Коммить перед каждым крупным запросом к ИИ** — это единственный надёжный чекпоинт.
2. **Не пушь в `main` напрямую** если экспериментируешь. Создавай ветку `ai/...`.
3. **Сообщения коммитов** пиши на русском или английском, но единообразно.
4. **`.gitignore`** уже настроен: игнорируются `node_modules/`, `dist/`, `build/`, логи и `.env` файлы.

---

## Аварийный откат

### Отменить незакоммиченные изменения

```powershell
git checkout -- .
```

### Откатить последний коммит, но сохранить изменения в файлах

```powershell
git reset --soft HEAD~1
```

### Полный откат к определённому коммиту

```powershell
git log --oneline
# скопируй хеш нужного коммита
git reset --hard хеш-коммита
```

---

## Связь с GitHub

Репозиторий: `https://github.com/Shadowknaz/TanktoonSurvivors.git`

Если push требует логин/пароль:
- **Username:** `Shadowknaz`
- **Password:** Personal Access Token (не пароль от GitHub!)

Токен создаётся тут: https://github.com/settings/tokens → Generate new token (classic) → выбрать `repo` → Generate.
