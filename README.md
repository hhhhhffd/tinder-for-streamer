# StreamMatch

**StreamMatch** — Tinder-образная платформа для нетворкинга Twitch-стримеров. Система позволяет стримерам находить партнёров для коллабораций через механику свайпов, разделяя пользователей на лиги по числу зрителей и обеспечивая честный матчинг внутри одного уровня аудитории.

**Проблема:** стримерам сложно находить равных по охвату коллег для совместных трансляций — нет инструмента, учитывающего размер аудитории.  
**Решение:** матчинговый движок на основе лиговой системы с Redis-атомарными лимитами, Twitch OAuth-авторизацией и real-time чатом через WebSocket + Redis Pub/Sub.

---

## Технический стек

| Категория | Технологии |
|-----------|-----------|
| **Core** | FastAPI 0.115, React 18, TypeScript 5, Vite 6 |
| **Data** | PostgreSQL 16, Redis 7, SQLAlchemy 2.0 (async), Alembic |
| **Auth** | Twitch OAuth 2.0 (PKCE + state), JWT (httpOnly cookie) |
| **Async** | Celery 5 (worker + beat), Redis broker/backend |
| **Frontend** | Zustand 5, TanStack Query 5, Framer Motion 11, Tailwind CSS 3 |
| **Real-time** | FastAPI WebSocket, Redis Pub/Sub |
| **Push** | Web Push API (VAPID / pywebpush) |
| **Infra** | Docker Compose, Nginx, Cloudflare Tunnel |

---

## Архитектура системы

### Общая схема потоков данных

```mermaid
flowchart TD
    User([Браузер])
    CF[Cloudflare Tunnel]
    Nginx[Nginx\nReverse Proxy]
    FE[Frontend\nReact SPA]
    BE[Backend\nFastAPI]
    WS[WebSocket\n/ws/chat/]
    PG[(PostgreSQL 16)]
    RD[(Redis 7)]
    CW[Celery Worker]
    CB[Celery Beat]
    TW[Twitch Helix API]

    User -->|HTTPS| CF
    CF -->|HTTP :80| Nginx
    Nginx -->|/api/*| BE
    Nginx -->|/ws/*| WS
    Nginx -->|/* SPA| FE

    BE -->|SQLAlchemy async| PG
    BE -->|asyncio-redis| RD
    WS -->|"Pub/Sub chat:{match_id}"| RD
    WS -->|save_message| PG

    CB -->|schedule task| RD
    RD -->|broker| CW
    CW -->|httpx| TW
    CW -->|upsert stats| PG

    BE -->|OAuth exchange| TW
```

### Матчинговый движок: алгоритм фида и лимиты

```mermaid
flowchart LR
    subgraph Feed["Алгоритм фида (feed.py)"]
        direction TB
        F1[Все активные пользователи]
        F2[Исключить: уже оценённые\nи заблокированные]
        F3[Приоритет 0: входящий super_like]
        F4[Приоритет 1: входящий cross-league-up]
        F5[Приоритет 2: та же лига]
        F6[Приоритет 3: остальные]
        F7[Применить фильтры\ncategories / viewers / language]
        F1 --> F2 --> F3 --> F4 --> F5 --> F6 --> F7
    end

    subgraph Like["Лайк-сервис (matching.py)"]
        direction TB
        L1[Определить league_relation\nsame / up / down]
        L2{Тип лайка?}
        L3[Lua: HINCRBY + EXPIRE\nАтомарный инкремент]
        L4[Записать Like в PostgreSQL]
        L5{Взаимный лайк?}
        L6[Создать Match]
        L7[Вернуть LikeResult\n+ remaining limits]
        L1 --> L2 --> L3 --> L4 --> L5
        L5 -->|да| L6 --> L7
        L5 -->|нет| L7
    end

    subgraph League["Лиговая система (league.py)"]
        direction TB
        LG1["Bronze: 0–50 зрителей"]
        LG2["Silver: 51–250 зрителей"]
        LG3["Gold: 251–1000 зрителей"]
        LG4["Platinum: 1001+ зрителей"]
    end
```

### Real-time чат: WebSocket + Redis Pub/Sub

```mermaid
sequenceDiagram
    participant C1 as Клиент A
    participant C2 as Клиент B
    participant WS as FastAPI WS Handler
    participant RD as Redis Pub/Sub
    participant PG as PostgreSQL

    C1->>WS: WS Connect /ws/chat/{match_id}
    WS->>WS: JWT-аутентификация из cookie / query
    WS->>PG: Проверить участие в матче
    WS->>RD: SUBSCRIBE chat:{match_id}

    C1->>WS: {type: "message", text: "..."}
    WS->>PG: save_message()
    WS->>RD: PUBLISH chat:{match_id} payload
    RD-->>WS: broadcast (все процессы)
    WS-->>C1: echo
    WS-->>C2: доставка
```

### Синхронизация Twitch-профилей (Celery)

```mermaid
sequenceDiagram
    participant Beat as Celery Beat
    participant Worker as Celery Worker
    participant TW as Twitch Helix API
    participant PG as PostgreSQL

    Beat->>Worker: sync_all_users_task (по расписанию)
    Worker->>PG: SELECT users WHERE twitch_access_token IS NOT NULL
    loop Для каждого пользователя
        Worker->>TW: GET /helix/channels?broadcaster_id=...
        TW-->>Worker: avg_viewers, followers, game, language
        Worker->>PG: upsert UserStats + recalculate League
    end
```

---

## ADR — Архитектурные решения

**ADR-1: FastAPI вместо Django/Flask**  
FastAPI выбран за нативный `async/await` и автоматическую валидацию через Pydantic. Это критично для одновременной работы WebSocket-соединений и ввода-вывода к PostgreSQL + Redis без блокировки event loop.

**ADR-2: Redis Lua-скрипты для лимитов лайков**  
Операция "проверить лимит → инкрементировать" должна быть атомарной. Lua-скрипт в Redis выполняется как одна транзакция, исключая гонку между двумя конкурентными запросами от одного пользователя. Ключи хранятся в виде хэшей `likes:{user_id}:{date}` с TTL до полуночи UTC.

**ADR-3: Cloudflare Tunnel вместо проброса порта 443**  
Туннель устраняет необходимость в публичном IP, управлении TLS-сертификатами и открытых портах. Nginx доверяет диапазонам IP Cloudflare и читает реальный IP из заголовка `CF-Connecting-IP`. Это упрощает деплой на любую VPS без настройки файрвола.

---

## Запуск и деплой

### 1. Конфигурация окружения

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```dotenv
# База данных
POSTGRES_USER=streammatch
POSTGRES_PASSWORD=CHANGE_ME_strong_password_here
POSTGRES_DB=streammatch
DATABASE_URL=postgresql+asyncpg://streammatch:CHANGE_ME_strong_password_here@postgres:5432/streammatch

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# Twitch OAuth — создать приложение на dev.twitch.tv
TWITCH_CLIENT_ID=your_twitch_client_id_here
TWITCH_CLIENT_SECRET=your_twitch_client_secret_here
TWITCH_REDIRECT_URI=https://your-domain.com/api/auth/twitch/callback

# JWT
JWT_SECRET_KEY=CHANGE_ME_random_secret_at_least_32_chars

# CORS — ваш домен
CORS_ORIGINS=https://your-domain.com

# Web Push (необязательно)
# Сгенерировать: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
VAPID_CONTACT_EMAIL=mailto:admin@your-domain.com

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=your_tunnel_token_here
```

### 2. Настройка Twitch-приложения

1. Перейдите на [dev.twitch.tv/console](https://dev.twitch.tv/console) → **Register Your Application**
2. Укажите **OAuth Redirect URL**: `https://your-domain.com/api/auth/twitch/callback`
3. Скопируйте **Client ID** и **Client Secret** в `.env`

### 3. Настройка Cloudflare Tunnel (опционально)

```bash
# Установить cloudflared и авторизоваться
cloudflared tunnel login
cloudflared tunnel create streammatch

# Скопировать токен в .env → CLOUDFLARE_TUNNEL_TOKEN
```

### 4. Запуск

```bash
docker compose up -d
```

Сервисы и их порядок запуска:

```
postgres (health) ──┐
redis    (health) ──┼──> backend ──> nginx ──> cloudflared
                    └──> celery-worker
                    └──> celery-beat

frontend ──> nginx
```

### 5. Миграции базы данных

```bash
# Применить миграции (выполняется автоматически при первом запуске backend)
docker compose exec backend alembic upgrade head
```

### 6. Проверка работоспособности

```bash
# Health check
curl http://localhost/api/health
# {"status":"ok","services":{"db":"ok","redis":"ok"}}

# Swagger UI
open http://localhost/api/docs
```

### Переменные окружения — справочник

| Переменная | По умолчанию | Описание |
|---|---|---|
| `POSTGRES_USER` | `streammatch` | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | — | Пароль PostgreSQL (обязательно изменить) |
| `POSTGRES_DB` | `streammatch` | Имя базы данных |
| `DATABASE_URL` | `postgresql+asyncpg://streammatch:...@postgres:5432/streammatch` | DSN для SQLAlchemy (хост — `postgres`) |
| `REDIS_URL` | `redis://redis:6379/0` | Redis для кэша и лимитов |
| `CELERY_BROKER_URL` | `redis://redis:6379/1` | Redis-брокер для Celery |
| `JWT_SECRET_KEY` | — | Секрет подписи JWT (мин. 32 символа) |
| `TWITCH_CLIENT_ID` | — | Client ID Twitch-приложения |
| `CLOUDFLARE_TUNNEL_TOKEN` | — | Токен Cloudflare Tunnel |

> **Важно:** хост базы данных в `DATABASE_URL` — `postgres` (имя сервиса в `docker-compose.yml`), не `localhost` и не `db`.

---

## Лиговая система

| Лига | Средние зрители | Дневной лимит (Free) | Дневной лимит (Premium) |
|---|---|---|---|
| 🥉 Bronze | 0 – 50 | 20 лайков, 1 кросс-лига, 0 супер | 40 лайков, 5 кросс-лига, 5 супер |
| 🥈 Silver | 51 – 250 | то же | то же |
| 🥇 Gold | 251 – 1 000 | то же | то же |
| 💎 Platinum | 1 001+ | то же | то же |

Лига пересчитывается автоматически при каждой синхронизации с Twitch Helix API.

---

## Поставляемые материалы

*Soon...*
