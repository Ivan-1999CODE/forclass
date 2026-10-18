import assert from "node:assert/strict";
import test from "node:test";
import { createVocabularyReader, buildVocabularyQuiz, normalizeVocabularyLessons, alternateVocabularyDirections } from "./english-quest.js";

const rows = Array.from({ length: 133 }, (_, i) => [
  { lesson: i + 1, word: `apple-${i}`, chinese: `蘋果${i}`, pos: "n." },
  { lesson: i + 1, word: `book-${i}`, chinese: `書本${i}`, pos: "n." },
  { lesson: i + 1, word: `cat-${i}`, chinese: `貓咪${i}`, pos: "n." },
  { lesson: i + 1, word: `dog-${i}`, chinese: `小狗${i}`, pos: "n." },
  { lesson: i + 1, word: `bird-${i}`, chinese: `小鳥${i}`, pos: "n." }
]).flat().map((r, i) => ({ ...r, id: `row-${i}` }));

function document(row) {
  return { document: { name: row.id, fields: {
    series: { stringValue: "advanced" }, lesson: { integerValue: String(row.lesson) },
    word: { stringValue: row.word }, chinese: { stringValue: row.chinese }, part: { stringValue: row.pos }
  } } };
}

test("只查指定 Firestore，133 課數字條件、part 後備、缺課與快取都正確", async () => {
  const requests = [];
  const reader = createVocabularyReader({ fetchImpl: async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://firestore.googleapis.com");
    assert.match(parsed.pathname, /^\/v1\/projects\/english-quest-95028\/databases\/\(default\)\/documents/);
    assert.equal(init.headers?.Authorization, undefined);
    requests.push({ url, init });
    if (parsed.pathname.endsWith("/meta/advanced")) {
      assert.equal(init.method, "GET");
      return Response.json({ fields: { titles: { mapValue: { fields: { "133": { stringValue: "最後一課" } } } } } });
    }
    assert.ok(parsed.pathname.endsWith(":runQuery"), "禁止所有雲端寫入端點");
    assert.equal(init.method, "POST");
    const body = JSON.parse(init.body);
    assert.deepEqual(Object.keys(body), ["structuredQuery"]);
    assert.deepEqual(body.structuredQuery.from, [{ collectionId: "vocabulary" }]);
    const filters = body.structuredQuery.where.compositeFilter.filters;
    assert.deepEqual(filters[0].fieldFilter, { field: { fieldPath: "series" }, op: "EQUAL", value: { stringValue: "advanced" } });
    const lesson = Number(filters[1].fieldFilter.value.integerValue);
    assert.equal(filters[1].fieldFilter.op, "EQUAL");
    assert.ok(lesson >= 1 && lesson <= 133);
    return Response.json(lesson === 5 ? [{ readTime: "unused" }] : rows.filter((r) => r.lesson === lesson).map(document));
  } });
  const [catalogue, duplicate] = await Promise.all([reader.catalogue(), reader.catalogue()]);
  assert.deepEqual(catalogue, duplicate);
  assert.equal(catalogue.lessons.length, 133);
  assert.equal(catalogue.availableLessons, 132);
  assert.equal(catalogue.totalWords, 660);
  assert.equal(catalogue.lessons[4].wordCount, 0);
  assert.equal(catalogue.lessons[132].title, "最後一課");
  assert.equal(catalogue.lessons[0].title, "第 1 課");
  assert.equal(requests.length, 134, "同時請求應共享唯讀載入");
  const quiz = await reader.quiz([133, 1, 133]);
  assert.equal(quiz.questions.length, 10);
  assert.equal(requests.length, 134, "建立測驗應重用快取");
  assert.deepEqual([...new Set(quiz.questions.map((q) => q.vocabulary.lesson))], [1, 133]);
  await assert.rejects(reader.quiz([5]), /第 5 課沒有單字/);
});

test("拒絕越界、字串課次和空選取，不用本機假資料掩蓋讀取失敗", async () => {
  for (const lessons of [[0], [134], [1.5], ["1"], null, "1"]) assert.throws(() => normalizeVocabularyLessons(lessons), /整數/);
  assert.deepEqual(normalizeVocabularyLessons([133, 1, 1]), [1, 133]);
  let deny = true;
  const reader = createVocabularyReader({ fetchImpl: async (url, init) => {
    if (url.includes("/meta/advanced")) return Response.json({}, { status: 404 });
    if (deny) return Response.json({ error: { status: "PERMISSION_DENIED" } }, { status: 403 });
    const lesson = Number(JSON.parse(init.body).structuredQuery.where.compositeFilter.filters[1].fieldFilter.value.integerValue);
    return Response.json(rows.filter((r) => r.lesson === lesson).map(document));
  } });
  await assert.rejects(reader.quiz([]), /至少一課/);
  await assert.rejects(reader.catalogue(), /讀取權限/);
  deny = false;
  assert.equal((await reader.catalogue()).availableLessons, 133, "失敗可重試，標題讀不到不阻擋單字");
});

test("英中雙向題目保留課次，每題四個不同答案，取樣後仍交錯方向", () => {
  const quiz = buildVocabularyQuiz(rows, [1, 2, 133]);
  assert.equal(quiz.questions.length, 15);
  assert.match(quiz.title, /1～2、133/);
  assert.match(quiz.date, /^\d{4}-\d{2}-\d{2}$/);
  const sampled = alternateVocabularyDirections(quiz.questions.filter((_, i) => i % 2 === 0));
  for (const [index, q] of sampled.entries()) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok([1, 2, 133].includes(q.vocabulary.lesson));
    assert.equal(q.vocabularyDirection, index % 2 ? "zh-en" : "en-zh");
    assert.equal(q.options[q.answerIndex], index % 2 ? q.vocabulary.word : q.vocabulary.chinese);
    assert.match(q.explanation, new RegExp(`第 ${q.vocabulary.lesson} 課`));
  }
});

test("同字異義、同中文、近似標點不得成為同題干擾答案", () => {
  const ambiguityRows = [
    { word: "kind", chinese: "種類", lesson: 1 },
    { word: "kind", chinese: "親切的；善良的", lesson: 2 },
    { word: "nice", chinese: "善良的", lesson: 2 },
    { word: "type", chinese: "種類", lesson: 2 },
    { word: "apple", chinese: "蘋果", lesson: 2 },
    { word: "pear", chinese: "梨子", lesson: 2 },
    { word: "pen", chinese: "筆", lesson: 2 },
    { word: "book", chinese: "書", lesson: 2 }
  ].map((r) => ({ ...r, pos: "n.", id: r.word + r.lesson }));
  const q = buildVocabularyQuiz(ambiguityRows, [1]).questions[0];
  assert.equal(q.options.filter((v) => v === "種類").length, 1);
  assert.ok(!q.options.some((v) => /親切|善良/.test(v)));
  assert.ok(!q.alternateQuestion.options.slice(1).some((v) => ["kind", "nice", "type"].includes(v)));
  assert.throws(() => buildVocabularyQuiz(ambiguityRows.slice(0, 4), [1]), /足夠/);
  const conjunctions = [
    { word: "when", chinese: "當……的時候；何時", lesson: 1 },
    { word: "while", chinese: "當…………時", lesson: 2 },
    ...ambiguityRows.slice(4)
  ].map((r) => ({ ...r, pos: "conj.", id: r.word }));
  const whenQuestion = buildVocabularyQuiz(conjunctions, [1]).questions[0];
  assert.ok(!whenQuestion.alternateQuestion.options.includes("while"));
});
