/*
# MINDCARE — seed demo data (fix variable names)

Re-applies the seed with corrected variable references (psy_a instead of psy_a_id).
Idempotent: skips if admin already exists.
*/

CREATE OR REPLACE FUNCTION add_question(p_test_id uuid, p_text text, opt_texts text[], opt_scores integer[])
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  q_id uuid; i integer;
BEGIN
  INSERT INTO questions (test_id, text, order_index)
  VALUES (p_test_id, p_text, (SELECT count(*) FROM questions WHERE test_id = p_test_id))
  RETURNING id INTO q_id;
  FOR i IN 1..array_length(opt_texts, 1) LOOP
    INSERT INTO answer_options (question_id, text, score, order_index)
    VALUES (q_id, opt_texts[i], opt_scores[i], i - 1);
  END LOOP;
  RETURN q_id;
END $$;

CREATE OR REPLACE FUNCTION make_attempt(
  p_student_id uuid, p_student_name text, p_test_id uuid, p_test_title text,
  p_psych_id uuid, scores integer[], p_shared boolean, p_review text, p_note text
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  a_id uuid; total integer := 0; i integer; q uuid; opt uuid; qtext text; otext text; rng uuid;
BEGIN
  FOR i IN 1..array_length(scores, 1) LOOP
    total := total + scores[i];
  END LOOP;
  SELECT id INTO rng FROM score_ranges
    WHERE test_id = p_test_id AND total BETWEEN min_score AND max_score
    ORDER BY min_score LIMIT 1;
  INSERT INTO test_attempts (student_id, student_name, test_id, test_title, psychologist_id,
    status, total_score, range_id, started_at, completed_at, shared, shared_at, review_status, reviewed_at, note)
  VALUES (p_student_id, p_student_name, p_test_id, p_test_title, p_psych_id,
    'COMPLETED', total, rng, now() - interval '3 days', now() - interval '3 days',
    p_shared, CASE WHEN p_shared THEN now() - interval '3 days' ELSE NULL END,
    p_review, CASE WHEN p_review IS NOT NULL AND p_review <> 'NEW' THEN now() - interval '2 days' ELSE NULL END, p_note)
  RETURNING id INTO a_id;

  FOR i IN 1..array_length(scores, 1) LOOP
    SELECT q.id, q.text INTO q, qtext FROM questions q WHERE q.test_id = p_test_id ORDER BY order_index OFFSET (i - 1) LIMIT 1;
    SELECT o.id, o.text INTO opt, otext FROM answer_options o WHERE o.question_id = q ORDER BY order_index OFFSET scores[i] LIMIT 1;
    INSERT INTO attempt_answers (attempt_id, question_id, question_text, option_id, option_text, score)
    VALUES (a_id, q, qtext, opt, otext, scores[i]);
  END LOOP;
  RETURN a_id;
END $$;

DO $$
DECLARE
  admin_id uuid;
  psy_a uuid; psy_b uuid; psy_c uuid; psy_d uuid; psy_e uuid;
  i integer;
  now_ts timestamptz := now();
  disclaimer_text text := 'Результат теста — не медицинский диагноз. Он показывает, как вы описали своё состояние сегодня, и может быть поводом поговорить со специалистом.';
  t_stress uuid; t_sleep uuid; t_anxiety uuid; t_self uuid; t_rel uuid; t_burnout uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid;
BEGIN
  PERFORM 1 FROM users WHERE email = 'admin@mindcare.kz';
  IF FOUND THEN RETURN; END IF;

  INSERT INTO users (id, email, password, role, full_name, phone, status, email_verified_at)
  VALUES (gen_random_uuid(), 'marzhan@gmail.kz', 'admin123', 'ADMIN', 'Маржан Омар', '+7 777 777 77 77', 'ACTIVE', now_ts)
  RETURNING id INTO psy_a;
  INSERT INTO psychologist_profiles (user_id, education, specializations, experience_years, about, verification_status, verified_at, verified_by, submitted_at)
  VALUES (psy_a, 'Astana IT University, software engineering, professor', ARRAY['Стресс','Учёба и выгорание'], 7,
    'Работаю со студентами: тревога перед сессией, выгорание, сон. Веду группы поддержки.',
    'APPROVED', now_ts, admin_id, now_ts);
  INSERT INTO documents (owner_id, type, file_name, mime_type, size_bytes) VALUES
    (psy_a, 'DIPLOMA', 'докторская диссертация.pdf', 'application/pdf', 480000),
    (psy_a, 'CERTIFICATE', 'сертификат_КПТ.pdf', 'application/pdf', 220000);

  INSERT INTO users (id, email, password, role, full_name, status, email_verified_at)
  VALUES (gen_random_uuid(), 'admin@mindcare.kz', 'admin123', 'ADMIN', 'Администратор', 'ACTIVE', now_ts)
  RETURNING id INTO admin_id;

  INSERT INTO users (id, email, password, role, full_name, phone, status, email_verified_at)
  VALUES (gen_random_uuid(), 'aigerim@mindcare.kz', 'demo1234', 'PSYCHOLOGIST', 'Айгерим Сарсенова', '+7 700 000 00 00', 'ACTIVE', now_ts)
  RETURNING id INTO psy_a;
  INSERT INTO psychologist_profiles (user_id, education, specializations, experience_years, about, verification_status, verified_at, verified_by, submitted_at)
  VALUES (psy_a, 'КазНУ им. аль-Фараби, психология, магистр', ARRAY['Стресс','Учёба и выгорание'], 7,
    'Работаю со студентами: тревога перед сессией, выгорание, сон. Веду группы поддержки.',
    'APPROVED', now_ts, admin_id, now_ts);
  INSERT INTO documents (owner_id, type, file_name, mime_type, size_bytes) VALUES
    (psy_a, 'DIPLOMA', 'диплом_магистра.pdf', 'application/pdf', 480000),
    (psy_a, 'CERTIFICATE', 'сертификат_КПТ.pdf', 'application/pdf', 220000);

  INSERT INTO users (id, email, password, role, full_name, phone, status, email_verified_at)
  VALUES (gen_random_uuid(), 'daulet@mindcare.kz', 'demo1234', 'PSYCHOLOGIST', 'Даulet Nurlan', '+7 701 111 11 11', 'ACTIVE', now_ts)
  RETURNING id INTO psy_b;
  INSERT INTO psychologist_profiles (user_id, education, specializations, experience_years, about, verification_status, verified_at, verified_by, submitted_at)
  VALUES (psy_b, 'ENU им. Л. Гумилёва, клиническая психология', ARRAY['Тревога','Самооценка'], 5,
    'Когнитивно-поведенческая терапия. Помогаю справиться с тревожными мыслями и неуверенностью.',
    'APPROVED', now_ts, admin_id, now_ts);
  INSERT INTO documents (owner_id, type, file_name, mime_type, size_bytes) VALUES
    (psy_b, 'DIPLOMA', 'daulet_diplom.pdf', 'application/pdf', 510000);

  INSERT INTO users (id, email, password, role, full_name, phone, status, email_verified_at)
  VALUES (gen_random_uuid(), 'mariya@mindcare.kz', 'demo1234', 'PSYCHOLOGIST', 'Mariya Petrova', '+7 702 222 22 22', 'ACTIVE', now_ts)
  RETURNING id INTO psy_c;
  INSERT INTO psychologist_profiles (user_id, education, specializations, experience_years, about, verification_status, verified_at, verified_by, submitted_at)
  VALUES (psy_c, 'МГУ, психологическое консультирование', ARRAY['Отношения','Учёба и выгорание'], 9,
    'Работаю с межличностными трудностями и выгоранием у студентов старших курсов.',
    'APPROVED', now_ts, admin_id, now_ts);
  INSERT INTO documents (owner_id, type, file_name, mime_type, size_bytes) VALUES
    (psy_c, 'DIPLOMA', 'mariya_diplom.pdf', 'application/pdf', 600000),
    (psy_c, 'CERTIFICATE', 'mariya_gestalt.pdf', 'application/pdf', 180000);

  INSERT INTO users (id, email, password, role, full_name, phone, status, email_verified_at)
  VALUES (gen_random_uuid(), 'ernur@mindcare.kz', 'demo1234', 'PSYCHOLOGIST', 'Ернур Касым', '+7 703 333 33 33', 'ACTIVE', now_ts)
  RETURNING id INTO psy_d;
  INSERT INTO psychologist_profiles (user_id, education, specializations, experience_years, about, verification_status, submitted_at)
  VALUES (psy_d, 'KazGUU, психология, бакалавр', ARRAY['Стресс','Сон'], 2,
    'Молодой специалист, работаю со студентами первого курса.', 'PENDING', now_ts);
  INSERT INTO documents (owner_id, type, file_name, mime_type, size_bytes) VALUES
    (psy_d, 'DIPLOMA', 'ernur_diplom.pdf', 'application/pdf', 390000);

  INSERT INTO users (id, email, password, role, full_name, phone, status, email_verified_at)
  VALUES (gen_random_uuid(), 'rejected@mindcare.kz', 'demo1234', 'PSYCHOLOGIST', 'Test Testov', '+7 704 444 44 44', 'ACTIVE', now_ts)
  RETURNING id INTO psy_e;
  INSERT INTO psychologist_profiles (user_id, education, specializations, experience_years, about, verification_status, submitted_at, rejection_reason)
  VALUES (psy_e, 'Не указано', ARRAY['Стресс'], 0, 'Тестовая заявка.', 'REJECTED', now_ts, 'Диплом нечитаемый, загрузите разворот целиком.');

  FOR i IN 1..8 LOOP
    DECLARE
      sid uuid;
      nm text := (ARRAY['Айсулу Ермекова','Бекзат Орман','Дина Жумабаева','Алмас Кайрат','Гульнара Сатбаева','Темирхан Асет','Лаура Исабек','Нурлан Беков'])[i];
      em text := 'student' || i || '@mindcare.kz';
    BEGIN
      INSERT INTO users (id, email, password, role, full_name, status, email_verified_at)
      VALUES (gen_random_uuid(), em, 'demo1234', 'STUDENT', nm, 'ACTIVE', now_ts) RETURNING id INTO sid;
    END;
  END LOOP;

  INSERT INTO tests (id, author_id, title, description, category, instruction, estimated_minutes, disclaimer, status, published_at)
  VALUES (gen_random_uuid(), psy_a, 'Уровень учебного стресса',
    'Короткий тест о том, как учёба влияет на ваше состояние в последние две недели.',
    'Учёба и выгорание', 'Отвечайте про последние две недели, не задумываясь подолгу. Правильных ответов нет.',
    4, disclaimer_text, 'PUBLISHED', now_ts) RETURNING id INTO t_stress;
  INSERT INTO tests (id, author_id, title, description, category, instruction, estimated_minutes, disclaimer, status, published_at)
  VALUES (gen_random_uuid(), psy_a, 'Как вы спите?', 'Пять вопросов про сон за последний месяц.',
    'Сон', 'Вспомните обычную учебную неделю, а не выходные.',
    3, disclaimer_text, 'PUBLISHED', now_ts) RETURNING id INTO t_sleep;
  INSERT INTO tests (id, author_id, title, description, category, instruction, estimated_minutes, disclaimer, status, published_at)
  VALUES (gen_random_uuid(), psy_b, 'Тревога перед сессией',
    'Оцените, как часто тревожные мысли мешают вам заниматься.',
    'Тревога', 'Отвечайте про последние 7 дней.',
    4, disclaimer_text, 'PUBLISHED', now_ts) RETURNING id INTO t_anxiety;
  INSERT INTO tests (id, author_id, title, description, category, instruction, estimated_minutes, disclaimer, status, published_at)
  VALUES (gen_random_uuid(), psy_b, 'Отношение к себе',
    'Шесть вопросов о том, как вы оцениваете себя в учёбе и общении.',
    'Самооценка', 'Отвечайте первое, что приходит в голову.',
    4, disclaimer_text, 'PUBLISHED', now_ts) RETURNING id INTO t_self;
  INSERT INTO tests (id, author_id, title, description, category, instruction, estimated_minutes, disclaimer, status, published_at)
  VALUES (gen_random_uuid(), psy_c, 'Отношения с близкими',
    'Насколько вам сейчас тепло и опорно в отношениях с семьёй и друзьями.',
    'Отношения', 'Вспомните последние две недели общения.',
    5, disclaimer_text, 'PUBLISHED', now_ts) RETURNING id INTO t_rel;
  INSERT INTO tests (id, author_id, title, description, category, instruction, estimated_minutes, disclaimer, status, published_at)
  VALUES (gen_random_uuid(), psy_c, 'Выгорание по учёбе',
    'Десять вопросов про усталость, цинизм и ощущение успешности.',
    'Учёба и выгорание', 'Отвечайте про последний месяц.',
    6, disclaimer_text, 'PUBLISHED', now_ts) RETURNING id INTO t_burnout;

  PERFORM add_question(t_stress, 'Мне трудно сосредоточиться на учебных задачах', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_stress, 'Я откладываю дела, хотя понимаю, что сроки горят', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_stress, 'Я чувствую усталость даже после отдыха', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_stress, 'Мысли об учёбе мешают мне засыпать', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_stress, 'Я перестал(а) радоваться тому, что раньше нравилось', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  INSERT INTO score_ranges (test_id, min_score, max_score, title, result_text, recommendation) VALUES
    (t_stress, 0, 4, 'Спокойный фон', 'Учебная нагрузка сейчас не выбивает вас из равновесия. Это хорошая точка, чтобы сохранять режим сна и отдыха.', 'Ничего срочного делать не нужно.'),
    (t_stress, 5, 9, 'Заметное напряжение', 'Стресс присутствует и уже влияет на концентрацию и отдых. Это частое состояние в сессию, но за ним стоит следить.', 'Попробуйте разгрузить одну неделю и вернуться к тесту через 14 дней.'),
    (t_stress, 10, 15, 'Высокая нагрузка', 'Ваши ответы описывают состояние, в котором организм долго не выдерживает: усталость, нарушенный сон, потеря интереса.', 'Имеет смысл поговорить с психологом. Вы можете отправить этот результат автору теста.');

  PERFORM add_question(t_sleep, 'Я засыпаю дольше 30 минут', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_sleep, 'Я просыпаюсь ночью и не могу уснуть', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_sleep, 'Утром я чувствую себя разбитым(ой)', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_sleep, 'Я сплю меньше 6 часов', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_sleep, 'Днём меня клонит в сон на парах', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  INSERT INTO score_ranges (test_id, min_score, max_score, title, result_text, recommendation) VALUES
    (t_sleep, 0, 4, 'Сон в порядке', 'Серьёзных сбоев режима нет.', ''),
    (t_sleep, 5, 9, 'Сон нарушен', 'Есть признаки недосыпа: долгое засыпание, тяжёлые пробуждения.', 'Начните с фиксированного времени подъёма — это работает лучше, чем ранний отбой.'),
    (t_sleep, 10, 15, 'Стойкие проблемы со сном', 'Ответы описывают затяжной недосып, который влияет на учёбу и настроение.', 'Стоит обсудить это со специалистом.');

  PERFORM add_question(t_anxiety, 'Тревожные мысли не дают сосредоточиться', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_anxiety, 'Я представляю худшие сценарии перед экзаменом', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_anxiety, 'Тело напряжено, когда думаю об учёбе', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_anxiety, 'Я избегаю подготовки, потому что страшно', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_anxiety, 'Тревога мешает заснуть накануне', ARRAY['Почти никогда','Иногда','Часто','Почти всё время'], ARRAY[0,1,2,3]);
  INSERT INTO score_ranges (test_id, min_score, max_score, title, result_text, recommendation) VALUES
    (t_anxiety, 0, 4, 'Тревога в норме', 'Тревога есть, но она не мешает учёбе.', ''),
    (t_anxiety, 5, 9, 'Заметная тревога', 'Тревога влияет на подготовку и сон.', 'Попробуйте дыхательные упражнения перед сном.'),
    (t_anxiety, 10, 15, 'Высокая тревога', 'Тревога уже мешает готовиться и отдыхать.', 'Имеет смысл поговорить с психологом.');

  PERFORM add_question(t_self, 'Я считаю, что способен(на) справиться с учёбой', ARRAY['Совсем не согласен','Скорее нет','Скорее да','Полностью согласен'], ARRAY[3,2,1,0]);
  PERFORM add_question(t_self, 'Я стесняюсь говорить на парах', ARRAY['Никогда','Редко','Часто','Почти всегда'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_self, 'Я сравниваю себя с другими не в свою пользу', ARRAY['Никогда','Редко','Часто','Почти всегда'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_self, 'Я ценю свои достижения', ARRAY['Совсем нет','Скорее нет','Скорее да','Полностью'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_self, 'Мне трудно принять похвалу', ARRAY['Никогда','Редко','Часто','Почти всегда'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_self, 'Я отношусь к себе доброжелательно', ARRAY['Никогда','Редко','Часто','Почти всегда'], ARRAY[3,2,1,0]);
  INSERT INTO score_ranges (test_id, min_score, max_score, title, result_text, recommendation) VALUES
    (t_self, 0, 6, 'Низкая самооценка', 'Вы часто бываете строги к себе.', 'Имеет смысл обсудить это с психологом.'),
    (t_self, 7, 12, 'Средняя самооценка', 'Баланс критики и поддержки смещён в сторону критики.', 'Попробуйте замечать свои достижения в конце дня.'),
    (t_self, 13, 18, 'Здоровая самооценка', 'Вы относитесь к себе бережно и опираетесь на свои сильные стороны.', '');

  PERFORM add_question(t_rel, 'Я чувствую поддержку от семьи', ARRAY['Почти никогда','Иногда','Часто','Почти всегда'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_rel, 'Мне есть с кем поговорить по душам', ARRAY['Почти никогда','Иногда','Часто','Почти всегда'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_rel, 'Я чувствую одиночество даже рядом с людьми', ARRAY['Почти никогда','Иногда','Часто','Почти всегда'], ARRAY[3,2,1,0]);
  PERFORM add_question(t_rel, 'Конфликты с близкими выбивают меня надолго', ARRAY['Почти никогда','Иногда','Часто','Почти всегда'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_rel, 'Я умею просить о помощи', ARRAY['Почти никогда','Иногда','Часто','Почти всегда'], ARRAY[0,1,2,3]);
  PERFORM add_question(t_rel, 'Мне комфортно в компании сверстников', ARRAY['Почти никогда','Иногда','Часто','Почти всегда'], ARRAY[0,1,2,3]);
  INSERT INTO score_ranges (test_id, min_score, max_score, title, result_text, recommendation) VALUES
    (t_rel, 0, 6, 'Острая нехватка опоры', 'Похоже, поддержки сейчас мало.', 'Имеет смысл обратиться к психологу или в службу поддержки вуза.'),
    (t_rel, 7, 12, 'Нестабильная опора', 'Опора есть, но её не хватает в трудные моменты.', 'Подумайте, кому вы можете довериться, и попробуйте поговорить.'),
    (t_rel, 13, 18, 'Тёплая опора', 'Рядом есть люди, на которых вы можете опереться.', '');

  PERFORM add_question(t_burnout, 'Я чувствую себя истощённым(ой) после учёбы', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Мне трудно начать учиться утром', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Учёба вызывает у меня раздражение', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Я стал(а) циничнее относиться к учёбе', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Я сомневаюсь в смысле своей учёбы', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Я работаю больше, а успеваю меньше', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Мне трудно сосредоточиться', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Я перестал(а) видеть смысл в достижениях', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Учебные задачи вызывают отвращение', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  PERFORM add_question(t_burnout, 'Я чувствую, что учусь впустую', ARRAY['Никогда','Редко','Иногда','Часто','Постоянно'], ARRAY[0,1,2,3,4]);
  INSERT INTO score_ranges (test_id, min_score, max_score, title, result_text, recommendation) VALUES
    (t_burnout, 0, 13, 'Без выгорания', 'Признаков выгорания сейчас нет.', ''),
    (t_burnout, 14, 27, 'Начальное выгорание', 'Есть первые признаки выгорания: усталость и снижение мотивации.', 'Сделайте паузу на неделю, вернитесь к тесту.'),
    (t_burnout, 28, 40, 'Выраженное выгорание', 'Выгорание уже влияет на учёбу и самочувствие.', 'Имеет смысл поговорить с психологом и пересмотреть нагрузку.');

  SELECT id INTO s1 FROM users WHERE email='student1@mindcare.kz';
  SELECT id INTO s2 FROM users WHERE email='student2@mindcare.kz';
  SELECT id INTO s3 FROM users WHERE email='student3@mindcare.kz';
  SELECT id INTO s4 FROM users WHERE email='student4@mindcare.kz';
  SELECT id INTO s5 FROM users WHERE email='student5@mindcare.kz';
  SELECT id INTO s6 FROM users WHERE email='student6@mindcare.kz';

  PERFORM make_attempt(s1, 'Айсулу Ермекова', t_stress, 'Уровень учебного стресса', psy_a, ARRAY[3,2,2,2,2], true, 'VIEWED', 'Рекомендовать консультацию очно.');
  PERFORM make_attempt(s1, 'Айсулу Ермекова', t_sleep, 'Как вы спите?', psy_a, ARRAY[1,2,1,1,1], true, 'NEW', NULL);
  PERFORM make_attempt(s2, 'Бекзат Орман', t_stress, 'Уровень учебного стресса', psy_a, ARRAY[0,1,1,1,0], false, NULL, NULL);
  PERFORM make_attempt(s2, 'Бекзат Орман', t_anxiety, 'Тревога перед сессией', psy_b, ARRAY[3,3,2,2,2], true, 'NEEDS_CONSULT', 'Сильная тревога, рекомендую КПТ-сессии.');
  PERFORM make_attempt(s3, 'Дина Жумабаева', t_self, 'Отношение к себе', psy_b, ARRAY[1,2,2,0,1,1], true, 'CLOSED', 'Работаем над самосостраданием.');
  PERFORM make_attempt(s3, 'Дина Жумабаева', t_rel, 'Отношения с близкими', psy_c, ARRAY[1,2,1,2,1,2], false, NULL, NULL);
  PERFORM make_attempt(s4, 'Алмас Кайрат', t_burnout, 'Выгорание по учёбе', psy_c, ARRAY[3,3,3,3,3,3,3,3,3,4], true, 'VIEWED', NULL);
  PERFORM make_attempt(s4, 'Алмас Кайрат', t_sleep, 'Как вы спите?', psy_a, ARRAY[0,0,1,0,1], false, NULL, NULL);
  PERFORM make_attempt(s5, 'Гульнара Сатбаева', t_anxiety, 'Тревога перед сессией', psy_b, ARRAY[1,0,1,1,1], true, 'NEW', NULL);
  PERFORM make_attempt(s5, 'Гульнара Сатбаева', t_stress, 'Уровень учебного стресса', psy_a, ARRAY[1,2,1,2,1], true, 'VIEWED', 'Контроль через 2 недели.');
  PERFORM make_attempt(s6, 'Лаура Исабек', t_rel, 'Отношения с близкими', psy_c, ARRAY[3,3,0,2,3,3], true, 'NEEDS_CONSULT', 'Острая нехватка опоры, рекомендую встречу.');
  PERFORM make_attempt(s6, 'Лаура Исабек', t_self, 'Отношение к себе', psy_b, ARRAY[1,1,2,1,2,3], false, NULL, NULL);
  PERFORM make_attempt(s1, 'Айсулу Ермекова', t_burnout, 'Выгорание по учёбе', psy_c, ARRAY[2,2,2,1,2,2,2,1,2,2], true, 'NEW', NULL);
  PERFORM make_attempt(s3, 'Дина Жумабаева', t_anxiety, 'Тревога перед сессией', psy_b, ARRAY[2,2,1,2,1], true, 'VIEWED', NULL);
  PERFORM make_attempt(s4, 'Алмас Кайрат', t_stress, 'Уровень учебного стресса', psy_a, ARRAY[2,2,1,2,2], true, 'CLOSED', 'Состояние улучшилось.');
  PERFORM make_attempt(s5, 'Гульнара Сатбаева', t_rel, 'Отношения с близкими', psy_c, ARRAY[1,1,2,0,0,0], false, NULL, NULL);
  PERFORM make_attempt(s2, 'Бекзат Орман', t_sleep, 'Как вы спите?', psy_a, ARRAY[2,3,2,2,2], true, 'VIEWED', 'Направил к сомнологу.');
  PERFORM make_attempt(s6, 'Лаура Исабек', t_burnout, 'Выгорание по учёбе', psy_c, ARRAY[2,3,2,2,3,2,2,2,3,3], true, 'NEW', NULL);

  INSERT INTO notifications (user_id, type, title, read, created_at) VALUES
    (psy_a, 'RESULT_SHARED', 'Вам отправлен новый результат', false, now() - interval '2 hours'),
    (psy_a, 'RESULT_VIEWED', 'Студент увидел, что вы просмотрели результат', true, now() - interval '1 day'),
    (psy_b, 'RESULT_SHARED', 'Вам отправлен новый результат', false, now() - interval '5 hours'),
    (psy_c, 'RESULT_SHARED', 'Вам отправлен новый результат', false, now() - interval '1 day'),
    (psy_d, 'VERIFICATION_PENDING', 'Заявка на проверке', false, now() - interval '6 hours'),
    (psy_e, 'VERIFICATION_REJECTED', 'Заявка отклонена', false, now() - interval '2 days');

  INSERT INTO audit (admin_id, action, target_id, reason, created_at) VALUES
    (admin_id, 'APPROVE_PSYCHOLOGIST', psy_a, NULL, now() - interval '30 days'),
    (admin_id, 'APPROVE_PSYCHOLOGIST', psy_b, NULL, now() - interval '20 days'),
    (admin_id, 'APPROVE_PSYCHOLOGIST', psy_c, NULL, now() - interval '15 days'),
    (admin_id, 'REJECT_PSYCHOLOGIST', psy_e, 'Диплом нечитаемый, загрузите разворот целиком.', now() - interval '2 days');
END $$;
