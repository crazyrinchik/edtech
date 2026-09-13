/**
 * Кабинет взрослого один, а ролей в нём две — и живут они на разных
 * уровнях.
 *
 * Раньше кабинетов было два: /roditel со вкладками и /repetitor со списком
 * учеников, — и половина экранов существовала в двух адресах с одинаковым
 * содержимым. Разница на поверку оказалась маленькой, и теперь она описана
 * данными.
 *
 * Учётная запись отвечает на вопрос «можно ли брать чужих детей»: это не
 * оформление, а обязательства — пригласить законного представителя, дать
 * ему подписать согласие, не знать его пароля. Отсюда роль tutor.
 *
 * А «чей это ребёнок» — свойство связи, а не записи: оно лежит в
 * child_access.role и у одного взрослого может быть разным для разных
 * детей. Пока на этот вопрос отвечала роль записи, репетитор со своим
 * первоклассником был невозможен — всё, что он заводил, становилось
 * учеником, с приглашением родителя самому себе.
 */

export type Audience = "tutor" | "parent";

/** Кем взрослый приходится конкретному ребёнку. */
export type Access = "parent" | "tutor";

/** Что можно в этой учётной записи. */
export type Caps = {
  audience: Audience;
  /** Дверь с кодом из четырёх цифр. Только в семье: компьютер общий. */
  pin: boolean;
  /** Заводить чужих детей — с приглашением их родителей. */
  canTakeStudents: boolean;
  /** Подпись ссылки на список: у репетитора там ученики. */
  homeLabel: string;
};

/** Что можно с конкретным ребёнком. */
export type LinkCaps = {
  access: Access;
  /** «ребёнок» или «ученик» — в именительном и дательном. */
  who: string;
  whoDat: string;
  /** Личная заметка: saveStudentNote пускает только репетитора ученика. */
  note: boolean;
  /** Приглашение родителя кодом — только к ученику. */
  invite: boolean;
  /** Лимит времени, звук, удаление профиля — дело семьи. */
  childSettings: boolean;
};

/** Админ ходит по кабинету как репетитор — так было и до общего кабинета. */
export function capsFor(role: string | undefined): Caps {
  const tutor = role === "tutor" || role === "admin";
  return {
    audience: tutor ? "tutor" : "parent",
    pin: !tutor,
    canTakeStudents: tutor,
    homeLabel: tutor ? "Ученики" : "Дети",
  };
}

export function linkCaps(access: string | undefined): LinkCaps {
  return access === "tutor"
    ? {
        access: "tutor",
        who: "ученик",
        whoDat: "ученику",
        note: true,
        invite: true,
        childSettings: false,
      }
    : {
        access: "parent",
        who: "ребёнок",
        whoDat: "ребёнку",
        note: false,
        invite: false,
        childSettings: true,
      };
}

/** Слова разделов, которые зависят от того, чей это кабинет. */
export const SCREEN_WORDS: Record<
  Audience,
  {
    back: string;
    backTo: string;
    topicsTo: string;
    drillsTo: string;
    whoDat: string;
    pick: string;
    assigned: string;
    paidHint: string;
    noOne: string;
  }
> = {
  tutor: {
    back: "К ученикам",
    backTo: "/kabinet",
    topicsTo: "/kabinet/temy",
    drillsTo: "/kabinet/trenazhery",
    whoDat: "ученику",
    pick: "Выберите учеников",
    assigned: "Задано ученикам",
    paidHint:
      "Названия тем и порядок видны всегда, а содержимое — на первой теме каждого предмета. С подпиской открываются задания всех тем, и их можно задавать любому ученику.",
    noOne:
      "Учеников пока нет — добавьте первого в списке учеников, и тренажёры можно будет задавать.",
  },
  parent: {
    back: "В кабинет",
    backTo: "/kabinet",
    topicsTo: "/kabinet/temy",
    drillsTo: "/kabinet/trenazhery",
    whoDat: "ребёнку",
    pick: "Выберите, кому",
    assigned: "Задано",
    paidHint:
      "Названия тем и порядок видны всегда, а содержимое — на первой теме каждого предмета. С подпиской открываются задания всех тем, и их можно задавать ребёнку.",
    noOne: "Профиля ребёнка пока нет — заведите его в кабинете, и тренажёры можно будет задавать.",
  },
};

/**
 * Куда отправить взрослого, если он открыл не свой раздел.
 *
 * Осталась ровно одна причина уйти: родитель за закрытой дверью. Раздел по
 * роли больше не выбирается — темы и тренажёры живут по одному адресу на
 * обе роли, и отправлять репетитора «в его копию» стало некуда.
 */
export function wrongDoor(account: {
  user: { role: string } | null;
  parentPinSet: boolean;
  parentUnlocked: boolean;
}): string | null {
  if (!account.user) return "/vhod";
  const caps = capsFor(account.user.role);
  if (caps.pin && account.parentPinSet && !account.parentUnlocked) return "/kabinet";
  return null;
}
