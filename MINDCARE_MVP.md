# MINDCARE — MVP: продуктовая и техническая спецификация

Версия 1.0 · документ для команды разработки (PM, дизайн, mobile, backend, admin)

---

## 1. Чёткое описание MVP

**Что это.** Мобильное приложение (Flutter, iOS + Android) + backend + веб-панель администратора. Платформа, где верифицированные психологи публикуют психологические тесты, студенты проходят их и по собственному согласию отправляют результат автору теста.

**Единственный критический путь MVP:**

```
регистрация студента → лента тестов → прохождение теста → результат
→ согласие на отправку → результат у психолога → психолог просмотрел + заметка
```

Всё, что не обслуживает этот путь, — вторично.

**Что входит в MVP (границы):**

| Входит | Не входит |
|---|---|
| Роли: студент, психолог, админ (практикант — только в схеме БД) | Видеоконсультации, запись, оплата |
| Верификация психолога админом вручную | Автоматическая проверка дипломов |
| Конструктор тестов (single-choice, баллы, диапазоны) | Ветвления, шкалы, мультивыбор, таймеры |
| Автоматический расчёт результата по сумме баллов | Клиническая интерпретация, диагнозы |
| Отправка результата по явному согласию | Двусторонний чат студент↔психолог |
| AI-чат поддержки с кризис-детектором | AI-диагностика, персонализация на реальных данных |
| Push-уведомления (5 типов) | Email-рассылки, маркетинг |
| Аналитика событий + дашборд админа | BI-система, когортный анализ |

**Целевой масштаб пилота:** 1 университет, 300–500 студентов, 5–15 психологов, 20–40 тестов, 3 месяца.

**Позиционирование и юридическая рамка.** Приложение — не медицинский сервис. Ни один экран не даёт диагноз. Дисклеймер обязателен: на карточке теста, на экране результата, в шапке AI-чата.

---

## 2. User Flow по ролям

### 2.1 Студент

```
Splash → (нет токена) Onboarding (3 экрана) → Выбор роли → Регистрация студента
  ├ ФИО, email, пароль, повтор пароля
  ├ чекбокс: согласие с Политикой конфиденциальности + Пользовательским соглашением (обязателен)
  └ POST /auth/register → сразу access+refresh токены, без модерации
→ Главная студента
     ├ Лента тестов → фильтр по категории / поиск → Карточка теста
     │     └ «Начать» → Прохождение (1 вопрос = 1 экран, прогресс-бар, назад разрешён)
     │           → Экран подтверждения завершения
     │           → Результат (баллы, диапазон, текст, дисклеймер)
     │                 ├ «Отправить психологу» → модалка согласия → отправлено
     │                 └ «Оставить себе» → результат виден только студенту
     ├ Психологи → Список → Профиль психолога → его опубликованные тесты
     ├ AI-чат → диалог → (кризис-триггер) → экран экстренной помощи
     ├ История результатов → карточка результата (статус: отправлен / просмотрен / требуется консультация)
     ├ Уведомления
     └ Профиль → Настройки → (смена пароля, отзыв согласия, удаление аккаунта, выход)
```

**Точки отвала, которые надо беречь:** регистрация (≤4 поля), первый тест (карточка обязана объяснять «зачем» за 5 секунд), экран согласия на отправку (объяснить, что именно увидит психолог).

### 2.2 Психолог

```
Splash → Выбор роли → Регистрация психолога
  Шаг 1: ФИО, email, телефон, пароль
  Шаг 2: образование, специализация (мультивыбор из справочника), опыт (лет), о себе (до 600 симв.), фото
  Шаг 3: загрузка документов (диплом — обязателен, ≥1; сертификаты и прочее — опционально)
  Шаг 4: согласия → «Отправить заявку»
→ Экран ожидания (status = PENDING): что происходит, срок проверки (до 3 раб. дней), кнопка «Дополнить документы», выход
   ├ REJECTED → экран с причиной отклонения → «Исправить и отправить снова» (возврат к шагу 2)
   ├ NEEDS_MORE_DOCS → пуш + экран загрузки документов
   └ APPROVED → пуш → Главная психолога
→ Главная психолога (виджеты: новые результаты, мои тесты, статус профиля)
     ├ Мои тесты → Создать тест (мастер из 4 шагов) → Черновик / Предпросмотр / Публикация
     │     └ Тест: редактировать (пока нет прохождений — свободно; после — через версионирование) / архивировать
     ├ Полученные результаты (список, фильтр по статусу и тесту)
     │     └ Подробный результат: ответы студента по вопросам, баллы, диапазон,
     │        заметка психолога (приватная), смена статуса NEW → VIEWED → NEEDS_CONSULT → CLOSED
     └ Профиль → редактирование → Настройки
```

**Мастер создания теста (шаги):**
1. Метаданные: название, описание, категория, инструкция, примерное время (мин), возраст от/до, текст предупреждения (предзаполнен, редактируем).
2. Вопросы: добавить вопрос → 2–6 вариантов → баллы за каждый вариант (целое, может быть 0 и отрицательным). Drag-and-drop порядка.
3. Диапазоны результата: min–max баллов, заголовок, текст интерпретации, рекомендация. Валидация: диапазоны покрывают весь возможный интервал сумм без пересечений.
4. Предпросмотр (студенческий вид) → «Сохранить черновик» / «Опубликовать».

### 2.3 Администратор (веб-панель)

```
Логин (email+пароль + обязательный 2FA TOTP) → Дашборд (счётчики + очередь заявок)
 ├ Заявки психологов: список PENDING → карточка (анкета + документы во встроенном вьюере по presigned URL)
 │     → Подтвердить / Отклонить (обязательная причина) / Запросить документы (комментарий)
 ├ Пользователи: поиск, карточка, блокировка/разблокировка (обязательная причина)
 ├ Тесты: список опубликованных → просмотр → скрыть (HIDDEN) с причиной
 ├ Статистика: метрики из раздела 10
 └ Журнал действий (audit log), только чтение, без удаления
```

### 2.4 Практикант (заложено, не реализовано)

В БД: `role = INTERN`, `verification_status`, поле `supervisor_id → users.id`. В UI роль скрыта (feature-flag `INTERN_ENABLED = false`). Регистрация под этой ролью недоступна.

---

## 3. Список экранов

### Мобильное приложение (Flutter)

| # | Экран | Роль | Ключевые элементы |
|---|---|---|---|
| S01 | Splash | все | лого, проверка токена, роутинг |
| S02 | Onboarding (3 слайда) | гость | ценность, приватность, дисклеймер |
| S03 | Выбор роли | гость | «Я студент» / «Я психолог» |
| S04 | Вход | гость | email, пароль, «забыли пароль» |
| S05 | Регистрация студента | гость | ФИО, email, пароль, согласия |
| S06 | Регистрация психолога (шаги 1–2) | гость | анкета, фото |
| S07 | Загрузка документов | психолог | список файлов, тип, статус, прогресс |
| S08 | Ожидание подтверждения | психолог | статус, причина отклонения, действия |
| S09 | Восстановление пароля (запрос / ввод кода / новый пароль) | гость | 3 состояния |
| S10 | Главная студента | студент | рекомендованные тесты, быстрый вход в AI-чат, последние результаты |
| S11 | Лента тестов | студент | карточки: название, автор, категория, время |
| S12 | Категории и поиск | студент | чипы категорий, строка поиска, «сбросить» |
| S13 | Карточка теста | студент | описание, инструкция, время, возраст, дисклеймер, CTA |
| S14 | Прохождение теста | студент | прогресс, вопрос, варианты, назад/далее, выход с сохранением черновика |
| S15 | Результат теста | студент | баллы, диапазон, текст, рекомендация, дисклеймер, «Отправить психологу» |
| S16 | История результатов | студент | список + фильтр, статус отправки |
| S17 | Список психологов | студент | фото, ФИО, специализация, кол-во тестов |
| S18 | Профиль психолога | студент | анкета (без документов и телефона), его тесты |
| S19 | AI-чат | студент | сообщения, быстрые подсказки, шапка-дисклеймер |
| S19a | Экран экстренной помощи | студент | телефоны служб, «позвонить», «написать близкому» |
| S20 | Уведомления | все | список, непрочитанные, deep-link |
| S21 | Профиль пользователя | все | данные, аватар, редактирование |
| S22 | Настройки | все | пуши, смена пароля, документы (политика/соглашение), отзыв согласия, удаление аккаунта, выход |
| S23 | Главная психолога | психолог | новые результаты, мои тесты, статус верификации |
| S24 | Мои тесты | психолог | вкладки: черновики / опубликованные / архив |
| S25 | Создание/редактирование теста (мастер 4 шага) | психолог | метаданные, вопросы, диапазоны, предпросмотр |
| S26 | Полученные результаты | психолог | список, фильтры по статусу/тесту/дате |
| S27 | Подробный результат студента | психолог | ответы, баллы, диапазон, заметка, смена статуса |

### Админ-панель (React)

A01 Логин + 2FA · A02 Дашборд · A03 Очередь заявок · A04 Карточка заявки + вьюер документов · A05 Пользователи · A06 Тесты и модерация · A07 Статистика · A08 Журнал действий.

---

## 4. Функциональные требования

Формат: `FR-<модуль>-<номер>` · приоритет по MoSCoW (раздел 12).

**Auth**
- FR-AUTH-01 Регистрация студента: ФИО, email (уникальный, регистронезависимый), пароль (≥8 симв., буквы+цифры), обязательные согласия. Доступ выдаётся немедленно.
- FR-AUTH-02 Регистрация психолога: создаёт `users` + `psychologist_profiles` + `verification_requests` со статусом `PENDING`.
- FR-AUTH-03 Вход по email+паролю → `access_token` (15 мин, JWT) + `refresh_token` (30 дней, ротация, хранится хешем в БД).
- FR-AUTH-04 Восстановление пароля по 6-значному коду на email, срок 15 мин, ≤5 попыток.
- FR-AUTH-05 Rate limit: 5 попыток входа / 15 мин / IP+email; блок на 15 мин.
- FR-AUTH-06 Выход = отзыв refresh-токена устройства.

**Verification**
- FR-VER-01 Психолог без `APPROVED` не может создавать/публиковать тесты и не получает результаты (проверка на backend, не только в UI).
- FR-VER-02 Админ переводит заявку в `APPROVED` / `REJECTED` (причина обязательна) / `NEEDS_MORE_DOCS` (комментарий обязателен).
- FR-VER-03 Повторная подача после отклонения разрешена; история заявок сохраняется.
- FR-VER-04 Каждое решение пишется в audit log.

**Documents**
- FR-DOC-01 Загрузка через presigned PUT в приватный бакет; в БД хранится только ключ объекта.
- FR-DOC-02 Разрешены PDF, JPG, PNG; ≤10 МБ; ≤10 файлов на психолога. Проверка MIME по сигнатуре, не по расширению.
- FR-DOC-03 Доступ к файлу: только владелец и админ, через presigned GET со сроком 5 минут.
- FR-DOC-04 Типы: `DIPLOMA` (обязателен ≥1), `CERTIFICATE`, `OTHER`.

**Tests**
- FR-TST-01 Создание/редактирование теста автором в статусе `DRAFT`.
- FR-TST-02 Публикация возможна только при: ≥5 вопросов, у каждого ≥2 варианта, диапазоны покрывают [min_score, max_score] без пересечений и разрывов.
- FR-TST-03 Опубликованный тест с ≥1 прохождением редактируется только через создание новой версии (`version += 1`, старая → `ARCHIVED`); результаты остаются привязаны к своей версии.
- FR-TST-04 Архивирование скрывает тест из ленты, не удаляя результаты.
- FR-TST-05 Лента: только `PUBLISHED` тесты подтверждённых и незаблокированных психологов; фильтр по категории, поиск по названию/описанию, пагинация (cursor).
- FR-TST-06 Админ может перевести тест в `HIDDEN` с причиной; автор получает уведомление.

**Attempts & Results**
- FR-RES-01 Начало прохождения создаёт `test_attempts` со статусом `IN_PROGRESS` (событие для метрики «начатые тесты»).
- FR-RES-02 Ответы сохраняются по мере прохождения; при выходе попытка восстанавливается (TTL черновика 7 дней).
- FR-RES-03 Завершение: сервер (не клиент) считает сумму баллов, определяет диапазон, фиксирует `total_score`, `range_id`, `completed_at`, статус `COMPLETED`.
- FR-RES-04 Отправка результата психологу — отдельное действие с явным согласием; фиксируются `shared = true`, `shared_at`, `consent_version`.
- FR-RES-05 Психолог видит только результаты с `shared = true` по своим тестам. Проверка на уровне запроса к БД.
- FR-RES-06 Студент может отозвать отправку: `shared = false`, психолог теряет доступ (в списке помечается «отозвано»).
- FR-RES-07 Психолог меняет статус: `NEW → VIEWED → NEEDS_CONSULT → CLOSED` (переходы вперёд и в `CLOSED` из любого).
- FR-RES-08 Заметка психолога приватна, студенту не показывается никогда.

**AI Chat**
- FR-AI-01 Диалог с LLM через отдельный сервис; системный промпт запрещает диагнозы, назначения, обещания конфиденциальности.
- FR-AI-02 Кризис-детектор: правила (список маркеров) + классификация моделью. При срабатывании — блокирующий экран S19a с телефонами служб; ответ модели не отправляется как обычное сообщение.
- FR-AI-03 Лимит: 30 сообщений / сутки / пользователь, 1 запрос / 3 сек.
- FR-AI-04 AI может предложить тесты из каталога (подбор по категории, не по «диагнозу»).
- FR-AI-05 История диалога хранится у студента; удаляется по кнопке «Очистить чат» и при удалении аккаунта.
- FR-AI-06 Данные чатов не используются для обучения; флаг `training_consent` по умолчанию `false`.

**Notifications**
- FR-NOT-01 Пять типов: `VERIFICATION_APPROVED`, `VERIFICATION_REJECTED`, `DOCS_REQUESTED`, `RESULT_SHARED`, `RESULT_VIEWED`, плюс `NEW_TEST_PUBLISHED` (подписка на психолога — Should Have).
- FR-NOT-02 Хранение in-app + пуш через FCM; deep-link на нужный экран.
- FR-NOT-03 Тексты пушей без чувствительного содержания: «Вам отправлен новый результат», без имени теста и баллов.

**Admin**
- FR-ADM-01 Отдельный домен/поддомен, 2FA обязательна, роль `ADMIN` не назначается через публичный API.
- FR-ADM-02 Блокировка пользователя: вход запрещён, тесты скрыты, refresh-токены отозваны.
- FR-ADM-03 Все административные действия → `admin_audit_log` (кто, что, над кем, когда, причина, IP).

**Account & Consent**
- FR-ACC-01 Удаление аккаунта: soft-delete + анонимизация ПДн в течение 30 дней, полное удаление файлов и чатов.
- FR-ACC-02 Отзыв согласия на обработку: скрывает все `shared` результаты и запускает процедуру удаления.
- FR-ACC-03 Версионирование документов (политика, соглашение); при обновлении — повторное принятие при входе.

---

## 5. Нефункциональные требования

| Категория | Требование |
|---|---|
| Производительность | p95 API < 400 мс (кроме AI-чата); лента тестов < 1 с на 3G; холодный старт приложения < 2.5 с |
| AI-чат | первый токен < 3 с, таймаут 30 с, graceful-сообщение при ошибке |
| Доступность | 99.5% в месяц для пилота; плановые работы вне 09:00–22:00 |
| Масштаб пилота | 1 000 пользователей, 50 RPS пик — одного инстанса backend + managed PostgreSQL достаточно |
| Безопасность | TLS 1.2+, HSTS, пароли Argon2id (fallback bcrypt cost 12), секреты в secret manager, ротация ключей JWT |
| Приватность | шифрование данных at-rest на уровне БД и хранилища; документы и результаты — приватные бакеты, только presigned URL |
| Роли | RBAC на уровне guard'ов + проверка владения ресурсом (ownership) в каждом запросе |
| Логирование | без ПДн и без содержимого ответов на тесты; корреляционный id запроса |
| Резервные копии | ежедневный бэкап БД, retention 30 дней, ежеквартальная проверка восстановления |
| Мобильное | Android 8+, iOS 14+; офлайн — только просмотр кэшированной ленты и черновика попытки |
| Локализация | RU и KZ на старте, архитектура i18n с первого дня (ARB-файлы), EN — позже |
| Доступность (a11y) | контраст ≥ 4.5:1, поддержка системного масштаба шрифта, семантические метки для screen reader |
| Соответствие | закон о персональных данных РК, отдельное согласие на «данные о здоровье», DPA с провайдером LLM, запрет обучения на данных |

---

## 6. Модель базы данных (PostgreSQL)

Выбор: **PostgreSQL** — данные сильно реляционные (тест → вопросы → варианты → попытки → ответы), нужны транзакции при подсчёте результата и строгие ограничения целостности. ORM: Prisma (или TypeORM).

```sql
-- ========== USERS & AUTH ==========
users (
  id            uuid PK default gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          user_role NOT NULL,            -- STUDENT | PSYCHOLOGIST | INTERN | ADMIN
  full_name     text NOT NULL,
  phone         text NULL,
  avatar_key    text NULL,
  status        user_status NOT NULL default 'ACTIVE',  -- ACTIVE | BLOCKED | DELETED
  blocked_reason text NULL,
  email_verified_at timestamptz NULL,
  last_login_at timestamptz NULL,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz NULL
)

refresh_tokens (
  id uuid PK, user_id uuid FK→users ON DELETE CASCADE,
  token_hash text NOT NULL, device_info text, ip inet,
  expires_at timestamptz NOT NULL, revoked_at timestamptz NULL,
  created_at timestamptz default now()
)

password_reset_codes (
  id uuid PK, user_id uuid FK→users, code_hash text, attempts int default 0,
  expires_at timestamptz, used_at timestamptz NULL
)

consents (
  id uuid PK, user_id uuid FK→users,
  type consent_type NOT NULL,        -- PRIVACY_POLICY | TERMS | HEALTH_DATA | AI_TRAINING
  version text NOT NULL, granted bool NOT NULL,
  granted_at timestamptz, revoked_at timestamptz NULL, ip inet
)

-- ========== PROFILES ==========
student_profiles (
  user_id uuid PK FK→users ON DELETE CASCADE,
  university text NULL, faculty text NULL, study_year smallint NULL,
  birth_year smallint NULL, invite_code text NULL      -- для пилота: код вуза
)

psychologist_profiles (
  user_id uuid PK FK→users ON DELETE CASCADE,
  education text NOT NULL,
  specializations text[] NOT NULL,        -- из справочника
  experience_years smallint NOT NULL,
  about text NULL,                        -- ≤600 симв.
  verification_status verif_status NOT NULL default 'PENDING',  -- PENDING|APPROVED|REJECTED|NEEDS_MORE_DOCS
  verified_at timestamptz NULL,
  verified_by uuid NULL FK→users,
  supervisor_id uuid NULL FK→users,       -- задел под INTERN
  is_public bool default true
)

-- ========== VERIFICATION & DOCUMENTS ==========
verification_requests (
  id uuid PK, psychologist_id uuid FK→users,
  status verif_status NOT NULL default 'PENDING',
  submitted_at timestamptz default now(),
  reviewed_at timestamptz NULL, reviewed_by uuid NULL FK→users,
  rejection_reason text NULL, admin_comment text NULL,
  attempt_no smallint default 1
)

documents (
  id uuid PK, owner_id uuid FK→users,
  request_id uuid NULL FK→verification_requests,
  type doc_type NOT NULL,               -- DIPLOMA | CERTIFICATE | OTHER
  storage_key text NOT NULL,            -- ключ в приватном бакете
  file_name text, mime_type text, size_bytes int,
  checksum_sha256 text,
  uploaded_at timestamptz default now(), deleted_at timestamptz NULL
)

-- ========== TESTS ==========
test_categories ( id smallserial PK, code text UNIQUE, name_ru text, name_kk text, sort_order int )

tests (
  id uuid PK, author_id uuid FK→users,
  title text NOT NULL, description text NOT NULL,
  category_id smallint FK→test_categories,
  instruction text NOT NULL,
  estimated_minutes smallint NOT NULL,
  age_min smallint default 16, age_max smallint default 99,
  disclaimer text NOT NULL,
  status test_status NOT NULL default 'DRAFT',  -- DRAFT|PUBLISHED|ARCHIVED|HIDDEN
  version smallint default 1,
  parent_test_id uuid NULL FK→tests,            -- предыдущая версия
  hidden_reason text NULL,
  published_at timestamptz NULL,
  created_at timestamptz default now(), updated_at timestamptz default now()
)
-- index: (status, category_id, published_at desc), GIN на to_tsvector(title||description)

questions (
  id uuid PK, test_id uuid FK→tests ON DELETE CASCADE,
  text text NOT NULL, order_index smallint NOT NULL,
  UNIQUE (test_id, order_index)
)

answer_options (
  id uuid PK, question_id uuid FK→questions ON DELETE CASCADE,
  text text NOT NULL, score int NOT NULL, order_index smallint NOT NULL,
  UNIQUE (question_id, order_index)
)

score_ranges (
  id uuid PK, test_id uuid FK→tests ON DELETE CASCADE,
  min_score int NOT NULL, max_score int NOT NULL,
  title text NOT NULL, result_text text NOT NULL, recommendation text NULL,
  severity range_severity NULL,          -- LOW | MEDIUM | HIGH (для сортировки и аналитики)
  CHECK (min_score <= max_score)
)

-- ========== ATTEMPTS & RESULTS ==========
test_attempts (
  id uuid PK,
  student_id uuid FK→users,
  test_id uuid FK→tests,
  test_version smallint NOT NULL,
  psychologist_id uuid FK→users,        -- денормализация автора на момент прохождения
  status attempt_status NOT NULL default 'IN_PROGRESS',  -- IN_PROGRESS|COMPLETED|ABANDONED
  total_score int NULL,
  range_id uuid NULL FK→score_ranges,
  started_at timestamptz default now(),
  completed_at timestamptz NULL,
  -- шеринг
  shared bool default false,
  shared_at timestamptz NULL,
  consent_version text NULL,
  revoked_at timestamptz NULL,
  -- сторона психолога
  review_status review_status NULL,      -- NEW|VIEWED|NEEDS_CONSULT|CLOSED
  reviewed_at timestamptz NULL,
  psychologist_note text NULL
)
-- index: (psychologist_id, shared, review_status, shared_at desc), (student_id, completed_at desc)

attempt_answers (
  id uuid PK,
  attempt_id uuid FK→test_attempts ON DELETE CASCADE,
  question_id uuid FK→questions,
  option_id uuid FK→answer_options,
  score int NOT NULL,                    -- зафиксированный балл на момент ответа
  answered_at timestamptz default now(),
  UNIQUE (attempt_id, question_id)
)

-- ========== AI CHAT ==========
ai_conversations (
  id uuid PK, user_id uuid FK→users, title text NULL,
  created_at timestamptz default now(), last_message_at timestamptz,
  deleted_at timestamptz NULL
)

ai_messages (
  id uuid PK, conversation_id uuid FK→ai_conversations ON DELETE CASCADE,
  role msg_role NOT NULL,                -- USER | ASSISTANT | SYSTEM
  content text NOT NULL,
  risk_level risk_level default 'NONE',  -- NONE | CONCERN | CRISIS
  tokens int NULL, created_at timestamptz default now()
)

crisis_events (
  id uuid PK, user_id uuid FK→users, message_id uuid FK→ai_messages,
  trigger_type text, shown_at timestamptz, acknowledged_at timestamptz NULL
)

-- ========== NOTIFICATIONS ==========
device_tokens ( id uuid PK, user_id uuid FK→users, fcm_token text UNIQUE, platform text, updated_at timestamptz )

notifications (
  id uuid PK, user_id uuid FK→users,
  type notif_type NOT NULL, title text, body text,
  payload jsonb,                          -- {screen, entityId}
  read_at timestamptz NULL, created_at timestamptz default now()
)

-- ========== ADMIN & ANALYTICS ==========
admin_audit_log (
  id bigserial PK, admin_id uuid FK→users,
  action text NOT NULL,                   -- APPROVE_PSYCHOLOGIST, HIDE_TEST, BLOCK_USER...
  target_type text, target_id uuid,
  reason text, metadata jsonb, ip inet, created_at timestamptz default now()
)

analytics_events (
  id bigserial PK, user_id uuid NULL, session_id uuid,
  event_name text NOT NULL, properties jsonb,
  platform text, app_version text, created_at timestamptz default now()
)
-- index: (event_name, created_at), BRIN на created_at
```

### 7. Связи между сущностями

```
users 1—1 student_profiles
users 1—1 psychologist_profiles
users 1—* verification_requests            (психолог → заявки, история попыток)
verification_requests 1—* documents
users 1—* documents                        (владелец)
users 1—* tests                            (автор)
tests 1—* questions 1—* answer_options
tests 1—* score_ranges
tests 1—* test_attempts
users 1—* test_attempts                    (student_id)
users 1—* test_attempts                    (psychologist_id — автор теста)
test_attempts 1—* attempt_answers
score_ranges 1—* test_attempts             (итоговый диапазон)
users 1—* ai_conversations 1—* ai_messages
users 1—* notifications, device_tokens, consents
users 1—* admin_audit_log                  (admin_id)
tests *—1 test_categories
users 1—* users                            (supervisor_id: психолог → практиканты)
```

Ключевые инварианты:
- `test_attempts.psychologist_id` = `tests.author_id` на момент старта (не меняется при смене версии теста).
- Психолог читает `test_attempts` только при `psychologist_id = :me AND shared = true AND revoked_at IS NULL`.
- `attempt_answers.score` копируется из `answer_options.score` при ответе — пересчёт баллов задним числом невозможен.

---

## 8. REST API endpoints

База: `/api/v1`. Аутентификация: `Authorization: Bearer <access_token>`. Ошибки: RFC 7807 (`type`, `title`, `status`, `detail`, `code`).

**Auth**
```
POST   /auth/register/student           {fullName,email,password,consents[]}      → tokens
POST   /auth/register/psychologist      {профиль + анкета}                        → tokens + status
POST   /auth/login                      {email,password}                          → tokens
POST   /auth/refresh                    {refreshToken}                            → tokens (ротация)
POST   /auth/logout                     {refreshToken}
POST   /auth/password/forgot            {email}
POST   /auth/password/verify-code       {email,code}                              → resetToken
POST   /auth/password/reset             {resetToken,newPassword}
GET    /auth/me                                                                   → профиль + role + verificationStatus
```

**Users / Profiles**
```
GET    /users/me
PATCH  /users/me                        {fullName,phone,about,...}
POST   /users/me/avatar                                                           → presigned PUT
DELETE /users/me                        {password}                                → запуск удаления аккаунта
GET    /users/me/consents
POST   /users/me/consents               {type,version,granted}
POST   /users/me/consents/revoke        {type}
POST   /users/me/devices                {fcmToken,platform}
DELETE /users/me/devices/:token
```

**Psychologists (публично для студентов)**
```
GET    /psychologists?search=&specialization=&cursor=     → список APPROVED, публичные поля
GET    /psychologists/:id                                 → анкета без телефона и документов
GET    /psychologists/:id/tests                           → его PUBLISHED тесты
```

**Verification & Documents**
```
GET    /verification/me                                   → статус, причина, что дозагрузить
POST   /verification/submit                               → создать/переподать заявку
POST   /documents/presign                {type,fileName,mimeType,sizeBytes} → {uploadUrl, documentId}
POST   /documents/:id/confirm            {checksum}       → подтвердить загрузку
GET    /documents/me                                      → список своих документов
DELETE /documents/:id                                     → только пока заявка PENDING
```

**Tests — психолог**
```
POST   /tests                            {метаданные}                     → DRAFT
GET    /tests/mine?status=                                                → свои тесты
GET    /tests/:id                                                         → полный тест (автор/админ)
PATCH  /tests/:id                        {метаданные}
POST   /tests/:id/questions              {text,orderIndex,options[]}
PATCH  /questions/:id                    {text,orderIndex}
DELETE /questions/:id
PUT    /tests/:id/ranges                 [{minScore,maxScore,title,resultText,recommendation}]
POST   /tests/:id/publish                                                 → валидация + PUBLISHED
POST   /tests/:id/archive
POST   /tests/:id/new-version                                             → клон в DRAFT
```

**Tests — студент**
```
GET    /feed/tests?categoryId=&search=&cursor=&limit=20                   → лента PUBLISHED
GET    /feed/tests/:id                                                    → карточка (без баллов!)
GET    /categories
```
> Важно: студенческие ответы API **никогда** не возвращают `answer_options.score` и `score_ranges` до завершения попытки.

**Attempts & Results — студент**
```
POST   /attempts                         {testId}                         → attemptId (IN_PROGRESS)
GET    /attempts/:id                                                      → текущее состояние + вопросы
PUT    /attempts/:id/answers             {questionId,optionId}            → сохранить ответ
POST   /attempts/:id/complete                                             → расчёт на сервере, результат
POST   /attempts/:id/share               {consentVersion:true}            → отправить психологу
POST   /attempts/:id/revoke                                               → отозвать отправку
GET    /attempts/mine?status=&cursor=                                     → история
GET    /attempts/:id/result                                               → результат студента
DELETE /attempts/:id                                                      → удалить незавершённую попытку
```

**Results — психолог**
```
GET    /psychologist/results?status=&testId=&cursor=                      → только shared=true, свои тесты
GET    /psychologist/results/:attemptId                                   → ответы + баллы + диапазон
PATCH  /psychologist/results/:attemptId  {reviewStatus, note}
```

**AI Chat**
```
POST   /ai/conversations                                                  → conversationId
GET    /ai/conversations                                                  → список
GET    /ai/conversations/:id/messages?cursor=
POST   /ai/conversations/:id/messages    {content}   → SSE-стрим ответа + {riskLevel}
DELETE /ai/conversations/:id
GET    /ai/emergency-contacts?region=KZ                                   → телефоны служб
```

**Notifications**
```
GET    /notifications?cursor=&unreadOnly=
POST   /notifications/:id/read
POST   /notifications/read-all
GET    /notifications/unread-count
```

**Admin** (`/admin`, guard `ADMIN` + 2FA)
```
POST   /admin/auth/login                 {email,password,otp}
GET    /admin/verifications?status=PENDING&cursor=
GET    /admin/verifications/:id                                → анкета + документы
POST   /admin/verifications/:id/approve
POST   /admin/verifications/:id/reject   {reason}
POST   /admin/verifications/:id/request-docs {comment}
GET    /admin/documents/:id/url                                → presigned GET, 5 мин, пишется в audit
GET    /admin/users?role=&status=&search=
POST   /admin/users/:id/block            {reason}
POST   /admin/users/:id/unblock
GET    /admin/tests?status=
POST   /admin/tests/:id/hide             {reason}
POST   /admin/tests/:id/unhide
GET    /admin/stats?from=&to=
GET    /admin/audit-log?cursor=
```

**Служебное:** `GET /health`, `GET /version`, `POST /analytics/events` (батч клиентских событий).

---

## 9. Структура backend-проекта (NestJS)

```
backend/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  ├─ common/
│  │   ├─ guards/         jwt.guard.ts, roles.guard.ts, verified-psychologist.guard.ts, ownership.guard.ts
│  │   ├─ decorators/     @CurrentUser, @Roles, @Public
│  │   ├─ filters/        http-exception.filter.ts (RFC7807)
│  │   ├─ interceptors/   logging (без ПДн), transform, timeout
│  │   ├─ pipes/          zod-validation.pipe.ts
│  │   └─ utils/          pagination (cursor), hashing, scoring.ts
│  ├─ config/             env schema (zod), configuration.ts
│  ├─ database/           prisma/schema.prisma, migrations/, seed.ts
│  └─ modules/
│      ├─ auth/           controller, service, strategies (jwt, refresh), dto
│      ├─ users/
│      ├─ student-profiles/
│      ├─ psychologist-profiles/
│      ├─ verification/
│      ├─ documents/      storage.service.ts (S3 presign), antivirus hook
│      ├─ tests/          tests.service, validation/publish-rules.ts
│      ├─ questions/
│      ├─ attempts/       attempts.service, scoring.service (сумма → диапазон)
│      ├─ results/        psychologist-facing слой над attempts
│      ├─ ai-chat/        ai.controller, ai.service, providers/llm.provider.ts,
│      │                  safety/crisis-detector.ts, prompts/system-prompt.ts
│      ├─ notifications/  fcm.service, notifications.service, templates/
│      ├─ admin/          verifications, users, tests, stats, audit
│      └─ analytics/      events.controller, metrics.service
├─ test/                  e2e (supertest), unit (jest)
├─ docker-compose.yml     postgres, minio, redis, backend
└─ .env.example
```

Слои: `controller → service → repository (Prisma)`. Бизнес-правила (расчёт баллов, правила публикации, права доступа к результатам) — только в service, покрыты unit-тестами.

Отдельный сервис `ai-service` (тоже Node) допустим, но для пилота достаточно модуля с изолированным провайдером — вынести можно позже без изменения контракта API.

---

## 10. Структура мобильного приложения (Flutter)

Архитектура: feature-first + Clean-lite (data / domain / presentation), состояние — Riverpod, роутинг — go_router, сеть — dio + retrofit, локальное хранение — flutter_secure_storage (токены) + hive (кэш ленты и черновиков попыток).

```
lib/
├─ main.dart
├─ app/
│   ├─ app.dart, router.dart (guards: auth, role, verification)
│   ├─ theme/  colors.dart, typography.dart, spacing.dart
│   └─ di.dart
├─ core/
│   ├─ network/    dio_client.dart, auth_interceptor.dart (refresh), error_mapper.dart
│   ├─ storage/    secure_storage.dart, local_cache.dart
│   ├─ analytics/  analytics.dart (события из раздела 11)
│   ├─ push/       fcm_service.dart, deep_links.dart
│   ├─ l10n/       app_ru.arb, app_kk.arb
│   └─ widgets/    primary_button, app_text_field, empty_state, error_view, disclaimer_banner
├─ features/
│   ├─ onboarding/
│   ├─ auth/            (login, register_student, register_psychologist, forgot_password)
│   ├─ verification/    (pending, upload_documents, rejected)
│   ├─ student_home/
│   ├─ tests_feed/      (feed, search, categories, test_card)
│   ├─ test_taking/     (attempt_controller, question_page, result_page, share_consent_sheet)
│   ├─ results_history/
│   ├─ psychologists/   (list, profile)
│   ├─ ai_chat/         (chat_page, message_bubble, crisis_sheet, emergency_page)
│   ├─ notifications/
│   ├─ profile_settings/
│   └─ psychologist/    (home, my_tests, test_editor/{meta,questions,ranges,preview}, results_list, result_detail)
└─ shared/models/   (сгенерированные из OpenAPI: user, test, question, attempt, result...)
```

Правила:
- Расчёт баллов **не дублируется** на клиенте — источник истины сервер.
- Экран прохождения работает офлайн-толерантно: ответы буферизуются и досылаются.
- Каждый экран имеет три состояния: loading / empty / error.

---

## 11. План разработки по этапам

Команда-минимум: 1 backend, 1 Flutter, 1 fullstack/React (админка, частично помогает backend), 1 дизайнер (первые 3 недели), PM/владелец.

| Спринт | Недели | Результат («что можно показать») |
|---|---|---|
| 0. Подготовка | 1 | Репозитории, CI, docker-compose, схема БД, OpenAPI-контракт, дизайн-система, макеты S01–S15 |
| 1. Auth & профили | 2–3 | Регистрация/вход обеих ролей, JWT+refresh, профиль, восстановление пароля. Приложение открывается и держит сессию |
| 2. Верификация | 4 | Загрузка документов в приватный бакет, экран ожидания, админ-панель: очередь заявок, approve/reject, audit log |
| 3. Конструктор тестов | 5–6 | Психолог создаёт тест с вопросами, баллами, диапазонами, публикует. Валидация публикации |
| 4. Лента и прохождение | 7–8 | Студент видит ленту, фильтрует, проходит тест, получает результат. **Критический путь наполовину готов** |
| 5. Шеринг результатов | 9 | Согласие, отправка, кабинет психолога, статусы, заметки, отзыв согласия. **Критический путь закрыт** |
| 6. Уведомления + аналитика | 10 | FCM, 5 типов уведомлений, события аналитики, дашборд статистики в админке |
| 7. AI-чат | 11–12 | Чат, системный промпт, кризис-детектор, экран экстренной помощи, лимиты |
| 8. Стабилизация | 13 | Пентест-чеклист, нагрузочный тест, тексты (политика, соглашение), сборки в сторы, closed beta |
| 9. Пилот | 14–16 | Онбординг вуза, обучение психологов, сбор метрик, еженедельные правки |

Порядок принципиален: до 5-го спринта продукт бесполезен; AI-чат сознательно после, потому что он не входит в критический путь.

---

## 12. Приоритеты MoSCoW

**Must Have (без этого MVP не существует)**
Регистрация студента и психолога · JWT + RBAC · загрузка документов и верификация админом · конструктор тестов (single-choice + баллы + диапазоны) · публикация · лента + карточка · прохождение и серверный расчёт результата · экран результата с дисклеймером · явное согласие и отправка результата · кабинет психолога со списком и детальным результатом · статусы результата и заметка · блокировка пользователя и скрытие теста админом · политика конфиденциальности и соглашение · базовая аналитика событий.

**Should Have (в пилот, но можно на неделю позже)**
AI-чат с кризис-детектором · push-уведомления (5 типов) · история результатов с фильтрами · поиск и категории · профиль психолога с его тестами · дашборд статистики · отзыв согласия и удаление аккаунта · восстановление пароля.

**Could Have (если останется время)**
Подписка на психолога и уведомление о новом тесте · рекомендация тестов из AI-чата · экспорт результата в PDF для студента · тёмная тема · казахская локализация · дыхательные упражнения как отдельный мини-модуль · сортировка ленты по популярности.

**Won't Have (явно вне MVP)**
Видеоконсультации · запись и оплата · чат студент↔психолог · соцсеть и комментарии · функционал практиканта · мультивыбор/шкалы/ветвления в тестах · автоматическая интерпретация ИИ по результатам тестов.

---

## 13. Критерии готовности MVP (Definition of Done)

**Функциональные**
1. Новый студент проходит путь регистрация → тест → результат → отправка за ≤5 минут без подсказок.
2. Психолог от регистрации до публикации теста доходит без обращения в поддержку (проверено на 3 внешних психологах).
3. Админ обрабатывает заявку за ≤3 минуты, включая просмотр документов.
4. Психолог не видит ни одного результата без `shared = true` — подтверждено автотестом и ручной проверкой.
5. Кризис-фразы (набор из 30 тестовых формулировок) в 100% случаев дают экран экстренной помощи.

**Технические**
6. Покрытие тестами бизнес-логики (scoring, права доступа, правила публикации) ≥ 80%.
7. E2E-сценарий критического пути в CI зелёный.
8. p95 основных endpoint'ов < 400 мс при 50 RPS.
9. Crash-free sessions ≥ 99% на closed beta.
10. Пройден security-чеклист: OWASP Mobile Top 10 + API Top 10, нет доступа к чужим документам по прямой ссылке.

**Юридические и операционные**
11. Опубликованы политика конфиденциальности и пользовательское соглашение; версии зафиксированы в `consents`.
12. Есть DPA с провайдером LLM и подтверждение отключённого обучения на данных.
13. Приложение опубликовано в TestFlight и Google Play Internal Testing.
14. Есть runbook: что делать при кризисном событии, при жалобе на психолога, при утечке.

---

## 14. Риски и меры

| # | Риск | Вероятность / Влияние | Мера |
|---|---|---|---|
| R1 | Кризисная ситуация у пользователя, приложение не помогло → репутационный и человеческий ущерб | Средняя / Критическое | Кризис-детектор на двух уровнях, заметный экран экстренных контактов, дисклеймеры, runbook, ежедневный просмотр `crisis_events` ответственным лицом |
| R2 | Утечка психологических данных | Низкая / Критическое | Приватные бакеты + presigned URL, шифрование, минимизация в логах и пушах, RBAC + ownership-проверки, аудит, пентест перед пилотом |
| R3 | Мало психологов → пустая лента → студенты не возвращаются | Высокая / Высокое | Перед запуском набрать 5–10 психологов и 20+ тестов вручную; ленту не открывать студентам, пока < 10 тестов |
| R4 | Психологи не хотят возиться с конструктором | Высокая / Высокое | Библиотека шаблонов-заготовок, импорт вопросов из текста, 30-минутный онбординг-звонок, поддержка в мессенджере |
| R5 | Студенты не отправляют результаты (боятся) | Средняя / Высокое | Прозрачный экран согласия: показать ровно то, что увидит психолог; возможность отзыва; отсутствие ФИО в списке до открытия — по договорённости с вузом |
| R6 | Некорректный/вредный тест опубликован | Средняя / Высокое | Пре-модерация первых 3 тестов каждого психолога, кнопка «пожаловаться», HIDDEN админом за минуту |
| R7 | Стоимость и латентность LLM | Средняя / Среднее | Лимиты 30 сообщений/сутки, короткий контекст (последние 10 сообщений), кэш типовых ответов, недельный бюджет-алерт |
| R8 | Изменение теста ломает старые результаты | Средняя / Среднее | Версионирование тестов, фиксация баллов в `attempt_answers` |
| R9 | Правовые требования к обработке данных о здоровье | Средняя / Высокое | Отдельное согласие `HEALTH_DATA`, консультация юриста до пилота, хранение данных в юрисдикции РК |
| R10 | Срыв сроков из-за AI-чата | Средняя / Среднее | AI-чат вынесен в спринт 7 (после критического пути), может быть выключен feature-flag'ом |
| R11 | Отказ вуза на этапе пилота | Средняя / Высокое | Письменное соглашение до старта разработки пилотной фазы, запасной вуз |

---

## 15. План тестирования на реальных пользователях

**Этап 1 — юзабилити (неделя 12, до релиза).** 8 студентов + 4 психолога, модерируемые сессии по 40 мин, think-aloud, задания: «зарегистрируйся и пройди любой тест про стресс», «создай тест из 5 вопросов и опубликуй». Метрика: доля задач, выполненных без помощи (цель ≥ 80%), число ошибок на задачу. Правим всё, что провалили ≥3 человека.

**Этап 2 — closed beta (неделя 13, 2 недели).** 30 студентов + 5 психологов из знакомой среды. TestFlight / Internal Testing. Ежедневный мониторинг crash-rate, ошибок API, воронки. Форма обратной связи внутри приложения (в Настройках).

**Этап 3 — пилот в вузе (недели 14–16+).** Развёртывание по плану раздела 17. Инструменты: аналитика событий, еженедельные короткие опросы (NPS + 2 вопроса), 5 глубинных интервью в конце месяца, канал поддержки.

**Обязательные проверки безопасности до любого этапа с реальными людьми:**
- попытка получить чужой документ по прямому URL и по чужому `documentId`;
- попытка психолога A прочитать результат теста психолога B;
- попытка прочитать `shared = false` результат;
- 30 кризисных формулировок → экран помощи;
- проверка, что пуш не содержит содержания результата.

---

## 16. Метрики полезности

**Воронка активации (главное)**
1. Регистрация → первый открытый тест (цель ≥ 60%)
2. Открыт тест → начат (≥ 70%)
3. Начат → завершён (**completion rate, ключевая метрика**, цель ≥ 65%)
4. Завершён → отправлен психологу (цель ≥ 30%)
5. Отправлен → просмотрен психологом за 48 ч (цель ≥ 80%)

**Метрики из раздела 10 ТЗ (реализуются как запросы к `analytics_events` + агрегаты БД):**
регистрации студентов · заявки психологов · подтверждённые психологи · опубликованные тесты · начатые тесты · завершённые тесты · отправленные результаты · процент завершения · DAU / WAU / MAU · количество AI-диалогов · возвращаемость (D1, D7, D30).

**Метрики качества, а не только объёма**
- Медианное время от отправки результата до просмотра психологом.
- Доля результатов со статусом `NEEDS_CONSULT` (сигнал, что платформа находит людей, которым нужна помощь).
- Доля результатов с заполненной заметкой психолога (вовлечённость специалистов).
- Доля студентов, прошедших ≥2 теста.
- Доля AI-диалогов длиной ≥4 сообщения (не «зашёл и вышел»).
- Частота срабатывания кризис-экрана и доля подтверждений («я посмотрел контакты»).
- NPS студентов и психологов раздельно.

**Список событий аналитики (именование `snake_case`)**
```
app_open, signup_started{role}, signup_completed{role},
psychologist_docs_uploaded, verification_approved, verification_rejected,
feed_viewed, test_card_opened{test_id,category}, test_started{test_id},
test_question_answered{test_id,index}, test_abandoned{test_id,index},
test_completed{test_id,score_range,duration_sec},
share_prompt_shown, result_shared{test_id}, share_declined, share_revoked,
result_viewed_by_psychologist{attempt_id}, result_status_changed{from,to},
ai_chat_opened, ai_message_sent, ai_crisis_triggered,
psychologist_test_created, psychologist_test_published,
notification_opened{type}
```

**Критерий «продукт полезен» по итогам 8 недель пилота:** completion rate ≥ 65%, ≥ 30% завершённых результатов отправлены психологам, ≥ 80% отправленных просмотрены, D30-возвращаемость студентов ≥ 20%, ≥ 3 задокументированных случая, когда студент дошёл до реальной консультации. Если отправка < 15% — проблема доверия, а не UI; менять модель согласия, а не кнопки.

---

## 17. Как запустить пилот в одном университете

**T-6 недель — договорённости.** Выйти на психологическую службу вуза и департамент по работе со студентами (не на IT). Подписать соглашение: цель пилота, какие данные собираются, кто отвечает за кризисные случаи, срок, отчётность. Определить куратора со стороны вуза — без него пилот не взлетает.

**T-4 недели — наполнение контентом.** Набрать 5–10 психологов (штатные психологи вуза + приглашённые). Провести с каждым 30-минутный онбординг, помочь опубликовать первые 2 теста. Цель к старту: **≥20 опубликованных тестов минимум в 5 категориях** (стресс, тревога, сон, выгорание/учёба, отношения). Пустая лента убивает пилот.

**T-2 недели — операционная готовность.** Определить дежурного админа (проверка заявок в течение 1 рабочего дня) и ответственного за кризисные события. Заготовить: телефоны экстренных служб РК и контакты психологической службы вуза, скрипт действий при кризисном триггере, канал поддержки (Telegram-бот или email).

**T-0 — запуск, волнами.**
1. Волна 1: один факультет / 2–3 общежития, ~100 студентов. Каналы: кураторы групп, 10-минутное выступление на потоковой лекции, QR-плакаты в общежитии и столовой, пост в студенческом Telegram-канале.
2. Через 2 недели, если completion rate ≥ 60% и нет критичных багов — волна 2 на весь вуз.

**Механика привлечения, которая работает лучше рекламы:** «неделя ментального здоровья» с офлайн-точкой, где студент проходит тест прямо на месте, и психолог тут же комментирует результат. Это создаёт первый опыт «отправил → получил ответ», ради которого продукт и существует.

**Ритм пилота.** Еженедельно: дашборд метрик + 30-минутный созвон с куратором вуза. Раз в 2 недели: релиз с правками. В конце месяца: 5 интервью со студентами и 3 с психологами. По итогам 8 недель — отчёт вузу с метриками из раздела 16 и решение о масштабировании.

**Чего не делать на пилоте:** не обещать анонимность, которой нет; не запускать без живых психологов, готовых отвечать; не масштабироваться на второй вуз, пока первый не показал completion rate и долю просмотренных результатов на целевом уровне.
