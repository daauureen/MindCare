import { uid, nowISO, DISCLAIMER } from './utils.js';

// Демо-данные при первом запуске
export function seedDB() {
  const psyId = uid();
  const t1 = uid(), t2 = uid();
  const q = (text, opts) => ({ id: uid(), text, options: opts.map(([text, score]) => ({ id: uid(), text, score })) });
  const scale4 = (a, b, c, d) => [[a, 0], [b, 1], [c, 2], [d, 3]];
  const freq = () => scale4("Почти никогда", "Иногда", "Часто", "Почти всё время");

  return {
    users: [
      {
        id: "admin-1", role: "ADMIN", fullName: "Администратор", email: "admin@mindcare.kz",
        password: "admin123", status: "ACTIVE", emailVerifiedAt: nowISO(), createdAt: nowISO(),
      },
      {
        id: psyId, role: "PSYCHOLOGIST", fullName: "Айгерим Сарсенова", email: "aigerim@mindcare.kz",
        password: "demo1234", phone: "+7 700 000 00 00", status: "ACTIVE", emailVerifiedAt: nowISO(), createdAt: nowISO(),
        profile: {
          education: "КазНУ им. аль-Фараби, психология, магистр",
          specializations: ["Стресс", "Учёба и выгорание"],
          experienceYears: 7,
          about: "Работаю со студентами: тревога перед сессией, выгорание, сон. Веду группы поддержки.",
          verificationStatus: "APPROVED", verifiedAt: nowISO(), submittedAt: nowISO(), documents: [
            { id: uid(), type: "DIPLOMA", fileName: "диплом_магистра.pdf" },
            { id: uid(), type: "CERTIFICATE", fileName: "сертификат_КПТ.pdf" },
          ],
        },
      },
    ],
    tests: [
      {
        id: t1, authorId: psyId, title: "Уровень учебного стресса",
        description: "Короткий тест о том, как учёба влияет на ваше состояние в последние две недели.",
        category: "Учёба и выгорание", instruction: "Отвечайте про последние две недели, не задумываясь подолгу. Правильных ответов нет.",
        minutes: 4, disclaimer: DISCLAIMER, status: "PUBLISHED", createdAt: nowISO(), publishedAt: nowISO(),
        questions: [
          q("Мне трудно сосредоточиться на учебных задачах", freq()),
          q("Я откладываю дела, хотя понимаю, что сроки горят", freq()),
          q("Я чувствую усталость даже после отдыха", freq()),
          q("Мысли об учёбе мешают мне засыпать", freq()),
          q("Я перестал(а) радоваться тому, что раньше нравилось", freq()),
        ],
        ranges: [
          { id: uid(), min: 0, max: 4, title: "Спокойный фон", text: "Учебная нагрузка сейчас не выбивает вас из равновесия. Это хорошая точка, чтобы сохранять режим сна и отдыха.", rec: "Ничего срочного делать не нужно." },
          { id: uid(), min: 5, max: 9, title: "Заметное напряжение", text: "Стресс присутствует и уже влияет на концентрацию и отдых. Это частое состояние в сессию, но за ним стоит следить.", rec: "Попробуйте разгрузить одну неделю и вернуться к тесту через 14 дней." },
          { id: uid(), min: 10, max: 15, title: "Высокая нагрузка", text: "Ваши ответы описывают состояние, в котором организм долго не выдерживает: усталость, нарушенный сон, потеря интереса.", rec: "Имеет смысл поговорить с психологом. Вы можете отправить этот результат автору теста." },
        ],
      },
      {
        id: t2, authorId: psyId, title: "Как вы спите?",
        description: "Пять вопросов про сон за последний месяц.",
        category: "Сон", instruction: "Вспомните обычную учебную неделю, а не выходные.",
        minutes: 3, disclaimer: DISCLAIMER, status: "PUBLISHED", createdAt: nowISO(), publishedAt: nowISO(),
        questions: [
          q("Я засыпаю дольше 30 минут", freq()),
          q("Я просыпаюсь ночью и не могу уснуть", freq()),
          q("Утром я чувствую себя разбитым(ой)", freq()),
          q("Я сплю меньше 6 часов", freq()),
          q("Днём меня клонит в сон на парах", freq()),
        ],
        ranges: [
          { id: uid(), min: 0, max: 4, title: "Сон в порядке", text: "Серьёзных сбоев режима нет.", rec: "" },
          { id: uid(), min: 5, max: 9, title: "Сон нарушен", text: "Есть признаки недосыпа: долгое засыпание, тяжёлые пробуждения.", rec: "Начните с фиксированного времени подъёма — это работает лучше, чем ранний отбой." },
          { id: uid(), min: 10, max: 15, title: "Стойкие проблемы со сном", text: "Ответы описывают затяжной недосып, который влияет на учёбу и настроение.", rec: "Стоит обсудить это со специалистом." },
        ],
      },
    ],
    attempts: [],
    chats: {},
    notifications: [],
    audit: [],
  };
}
