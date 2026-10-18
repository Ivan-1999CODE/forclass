import crypto from "node:crypto";

// 沿用 English Quest src/config/firebase.js 的公開 Web app 設定。
// 僅呼叫 Firestore 的 runQuery（POST 唯讀查詢）和 get document。
// 不使用管理員憑證、登入、寫入 API，也不建立索引。
const firebaseConfig = Object.freeze({
  projectId: "english-quest-95028",
  apiKey: "AIzaSyAfeRxb_HVaLU8UuJ20xgmGfxWWqMCKVvg"
});
const documentsUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const allLessons = Array.from({ length: 133 }, (_, i) => i + 1);
const clean = (value) => typeof value === "string" ? value.trim() : "";
const key = (value) => clean(value).normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
// 將省略符號和「的時候／時」等標示正規化，避免 when / while 因標點不同互為答案。
const meanings = (value) => new Set(key(value).split(/[;；、，,／/()（）]/)
  .map((v) => v.replace(/[.。…⋯_\s]/g, "").replace(/的時候/g, "時")).filter(Boolean));
const overlaps = (left, right) => [...left].some((value) => right.has(value));

export function normalizeVocabularyLessons(value = []) {
  if (!Array.isArray(value) || value.length > 133 || value.some((n) => !Number.isInteger(n) || n < 1 || n > 133)) {
    throw new Error("單字課次必須是第 1～133 課的整數。");
  }
  return [...new Set(value)].sort((a, b) => a - b);
}

function fromFirestore(value) {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, fromFirestore(v)]));
  return undefined;
}

export function createVocabularyReader({ fetchImpl = globalThis.fetch, cacheMs = 10 * 60 * 1000 } = {}) {
  let cached;
  let expiresAt = 0;
  let pending;

  async function request(suffix, body) {
    const response = await fetchImpl(`${documentsUrl}${suffix}${suffix.includes("?") ? "&" : "?"}key=${firebaseConfig.apiKey}`, {
      method: body ? "POST" : "GET",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    const remoteError = data.error || (Array.isArray(data) ? data.find((row) => row.error)?.error : null);
    if (!response.ok || remoteError) {
      throw new Error(remoteError?.status === "PERMISSION_DENIED" ? "沒有單字資料的讀取權限。" : "單字來源暫時無法讀取，請稍後重試。");
    }
    return data;
  }

  async function readLesson(lesson) {
    const data = await request(":runQuery", {
      structuredQuery: {
        select: { fields: ["series", "lesson", "word", "chinese", "pos", "part"].map((fieldPath) => ({ fieldPath })) },
        from: [{ collectionId: "vocabulary" }],
        where: { compositeFilter: { op: "AND", filters: [
          { fieldFilter: { field: { fieldPath: "series" }, op: "EQUAL", value: { stringValue: "advanced" } } },
          { fieldFilter: { field: { fieldPath: "lesson" }, op: "EQUAL", value: { integerValue: String(lesson) } } }
        ] } }
      }
    });
    if (!Array.isArray(data)) throw new Error("單字來源回傳格式錯誤。");
    return data.filter((row) => row.document).map(({ document }) => {
      const v = Object.fromEntries(Object.entries(document.fields || {}).map(([k, value]) => [k, fromFirestore(value)]));
      if (v.series !== "advanced" || v.lesson !== lesson || !clean(v.word) || !clean(v.chinese) || !(clean(v.pos) || clean(v.part))) {
        throw new Error(`第 ${lesson} 課的單字欄位不完整，請先確認來源。`);
      }
      return { id: document.name, lesson, word: clean(v.word), chinese: clean(v.chinese), pos: clean(v.pos) || clean(v.part) };
    });
  }

  async function readAll() {
    let next = 0;
    let failure;
    const rows = [];
    // 標題非必要，讀不到時仍可用課次選課。
    const titlesPromise = request("/meta/advanced?mask.fieldPaths=titles").then((data) => fromFirestore(data.fields?.titles) || {}).catch(() => ({}));
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < allLessons.length && !failure) {
        const lesson = allLessons[next++];
        try { rows.push(...await readLesson(lesson)); }
        catch (error) { failure = new Error(`第 ${lesson} 課讀取失敗：${error.message}`); }
      }
    }));
    if (failure) throw failure;
    rows.sort((a, b) => a.lesson - b.lesson || a.word.localeCompare(b.word));
    const titles = await titlesPromise;
    return { rows, lessons: allLessons.map((lesson) => ({ lesson, title: clean(titles[String(lesson)]) || `第 ${lesson} 課`, wordCount: rows.filter((row) => row.lesson === lesson).length })) };
  }

  async function load() {
    if (cached && Date.now() < expiresAt) return cached;
    if (!pending) {
      pending = readAll().then((result) => { cached = result; expiresAt = Date.now() + cacheMs; return result; }).finally(() => { pending = null; });
    }
    return pending;
  }

  return {
    async catalogue() {
      const { rows, lessons } = await load();
      return { lessons, totalWords: rows.length, availableLessons: lessons.filter((l) => l.wordCount > 0).length };
    },
    async quiz(selectedLessons) {
      const lessons = normalizeVocabularyLessons(selectedLessons);
      if (!lessons.length) throw new Error("請先勾選至少一課單字。");
      return buildVocabularyQuiz((await load()).rows, lessons);
    }
  };
}

function shuffled(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildVocabularyQuiz(rows, selectedLessons) {
  const lessons = normalizeVocabularyLessons(selectedLessons);
  const selected = rows.filter((row) => lessons.includes(row.lesson));
  const missing = lessons.filter((lesson) => !selected.some((row) => row.lesson === lesson));
  if (missing.length) throw new Error(`第 ${missing.join("、")} 課沒有單字，請重新選課。`);
  if (!selected.length) throw new Error("請先勾選至少一課單字。");
  const pool = rows.map((row) => ({ ...row, wordKey: key(row.word), meaningKeys: meanings(row.chinese) }));
  const questions = selected.map((word) => {
    const wordKey = key(word.word);
    const knownMeanings = new Set(pool.filter((r) => r.wordKey === wordKey).flatMap((r) => [...r.meaningKeys]));
    const candidates = shuffled(pool.filter((r) => r.wordKey !== wordKey && !overlaps(r.meaningKeys, knownMeanings)))
      .sort((a, b) => Number(lessons.includes(b.lesson)) - Number(lessons.includes(a.lesson)) || Number(b.pos === word.pos) - Number(a.pos === word.pos));
    const choices = [];
    const usedWords = new Set([wordKey]);
    const usedMeanings = new Set(knownMeanings);
    for (const candidate of candidates) {
      if (usedWords.has(candidate.wordKey) || overlaps(candidate.meaningKeys, usedMeanings)) continue;
      choices.push(candidate);
      usedWords.add(candidate.wordKey);
      candidate.meaningKeys.forEach((meaning) => usedMeanings.add(meaning));
      if (choices.length === 3) break;
    }
    if (choices.length !== 3) throw new Error(`「${word.word}」找不到足夠且不重複的選項，暫時無法出題。`);
    const explanation = `第 ${word.lesson} 課｜${word.word} ${word.pos}：${word.chinese}`;
    return {
      prompt: `「${word.word}」（${word.pos}）的中文意思是什麼？`,
      options: [word.chinese, ...choices.map((r) => r.chinese)],
      answerIndex: 0,
      explanation,
      vocabulary: { lesson: word.lesson, word: word.word, chinese: word.chinese, pos: word.pos },
      vocabularyDirection: "en-zh",
      alternateQuestion: {
        prompt: `「${word.chinese}」（${word.pos}）的英文是哪一個？`,
        options: [word.word, ...choices.map((r) => r.word)],
        answerIndex: 0,
        explanation
      }
    };
  });
  return {
    id: `english-quest-advanced-${lessons.join("-")}`,
    title: `單字測驗｜進階第 ${formatLessonRanges(lessons)} 課｜英中混合`,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    defaultTimeLimitSec: 20,
    questions: alternateVocabularyDirections(questions)
  };
}

export function alternateVocabularyDirections(questions) {
  let index = 0;
  return questions.map((question) => {
    if (!question.alternateQuestion) return question;
    const direction = index++ % 2 === 0 ? "en-zh" : "zh-en";
    if (question.vocabularyDirection === direction) return question;
    const { prompt, options, answerIndex, explanation } = question;
    return { ...question, ...question.alternateQuestion, vocabularyDirection: direction, alternateQuestion: { prompt, options, answerIndex, explanation } };
  });
}

function formatLessonRanges(lessons) {
  const ranges = [];
  for (let i = 0; i < lessons.length; i++) {
    const start = lessons[i];
    let end = start;
    while (lessons[i + 1] === end + 1) end = lessons[++i];
    ranges.push(start === end ? String(start) : `${start}～${end}`);
  }
  return ranges.join("、");
}

export const vocabularyReader = createVocabularyReader();
