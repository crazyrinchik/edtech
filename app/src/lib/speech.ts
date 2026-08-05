// Озвучка для тех, кто ещё не читает.
//
// Первоклассник разбирает вопрос по слогам дольше, чем считает ответ, и на
// этом теряет интерес. Поэтому у каждого задания есть кнопка-ушко: она читает
// вопрос вслух голосом браузера (Web Speech API). Ничего не скачивается и
// никуда не отправляется — синтез идёт на устройстве.
//
// Модуль клиентский: SSR его не выполняет, но все функции всё равно проверяют
// window, чтобы их можно было спокойно звать из общего кода.

const RU = "ru";

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

export function speechSupported(): boolean {
  return !!synth() && typeof window !== "undefined" && "SpeechSynthesisUtterance" in window;
}

/**
 * Первый вызов getVoices() в Chrome возвращает пустой список: голоса
 * подгружаются асинхронно, и событие voiceschanged может прийти раньше,
 * чем на него успели подписаться. Поэтому список прогревается один раз
 * при загрузке модуля — к моменту первого нажатия на ушко он уже готов.
 */
function warmUpVoices(): void {
  const s = synth();
  if (!s) return;
  if (s.getVoices().length) return;
  const onChange = () => {
    s.removeEventListener("voiceschanged", onChange);
  };
  s.addEventListener("voiceschanged", onChange);
  // Ещё и опрос: в части сборок Safari событие не приходит вовсе.
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (s.getVoices().length || tries > 20) window.clearInterval(timer);
  }, 250);
}

if (typeof window !== "undefined") warmUpVoices();

/**
 * Высота и темп подбирались на слух. Пробовали поднять тон до 1.35, чтобы
 * голос звучал мультяшнее, — на единственном системном русском голосе это
 * читается не как зверёк, а как ускоренная запись, и разборчивость падает.
 * Оставлено близко к натуральному: детям важнее понять, чем умилиться.
 */
const PITCH = 1.05;
const RATE = 0.9;

/**
 * Женские голоса звучат мягче и ближе к мультфильму, поэтому идут первыми.
 * Список по именам, а не по полу: у SpeechSynthesisVoice пола нет, а имена
 * системных русских голосов известны и стабильны.
 *
 * Кириллица в списке не для красоты: на системе с русским языком тот же
 * голос называется «Милена», и латинское «milena» не совпало бы с ним
 * никогда — выбор молча падал бы в запасной вариант.
 */
const PREFERRED = [
  "milena", "милена",
  "alyona", "alena", "алёна", "алена",
  "katya", "катя",
  "tatyana", "татьяна",
  "google русский", "google russian",
];

function normalize(name: string): string {
  return name.toLowerCase().replace(/ё/g, "е");
}

function pickVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  if (!voices.length) return null;
  const ru = voices.filter((v) => v.lang.toLowerCase().startsWith(RU));
  if (!ru.length) return null;

  for (const name of PREFERRED) {
    const wanted = normalize(name);
    const hit = ru.find((v) => normalize(v.name).includes(wanted));
    if (hit) return hit;
  }
  // Локальный голос звучит ровнее сетевого и не зависит от связи.
  return ru.find((v) => v.localService) ?? ru[0];
}

/**
 * Текст задания читается медленнее обычного: детям нужен темп ниже взрослого.
 * Повторный вызов прерывает предыдущую фразу — иначе кнопка, нажатая дважды,
 * ставит вторую фразу в очередь и ребёнок ждёт.
 */
export function speak(text: string, opts: { rate?: number } = {}): void {
  const s = synth();
  if (!s || !text.trim()) return;
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
  utterance.lang = "ru-RU";
  utterance.rate = opts.rate ?? RATE;
  utterance.pitch = PITCH;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  s.speak(utterance);
}

export function stopSpeech(): void {
  synth()?.cancel();
}

/**
 * Знаки, которые синтезатор читает буквально или проглатывает: многоточие в
 * заданиях «Вставь букву: ш…шка» произносится как пауза, а знаки сравнения
 * нужно назвать словами, иначе вопрос теряет смысл на слух.
 */
function cleanForSpeech(text: string): string {
  return text
    .replace(/…/g, " ... ")
    .replace(/×/g, " умножить на ")
    .replace(/÷/g, " разделить на ")
    // Только математический минус и дефис между пробелами: в «жи-ши» и
    // «что-то» дефис часть слова, и «минус» там звучал бы дико.
    .replace(/−/g, " минус ")
    .replace(/(\d)\s*-\s*(\d)/g, "$1 минус $2")
    .replace(/\+/g, " плюс ")
    .replace(/>/g, " больше ")
    .replace(/</g, " меньше ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Голосовое сопровождение включается один раз и запоминается на устройстве. */
const AUTO_KEY = "sov_voice_auto";

export function autoSpeakEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoSpeak(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    // приватный режим — просто не запоминаем
  }
}
