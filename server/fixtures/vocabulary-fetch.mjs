// 僅由整合測試用 --import 載入；所有 Firestore 回覆都來自記憶體。
import assert from "node:assert/strict";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith("https://firestore.googleapis.com/")) return originalFetch(url, init);
  if (String(url).includes("/meta/advanced?")) {
    assert.equal(init.method, "GET");
    return Response.json({ fields: { titles: { mapValue: { fields: {} } } } });
  }
  assert.ok(String(url).includes("/documents:runQuery?"), "測試禁止任何雲端寫入");
  assert.equal(init.method, "POST");
  const query = JSON.parse(init.body).structuredQuery;
  const lesson = Number(query.where.compositeFilter.filters[1].fieldFilter.value.integerValue);
  assert.ok(Number.isInteger(lesson) && lesson >= 1 && lesson <= 133);
  const words = [["baby", "嬰兒"], ["book", "書本"], ["cat", "貓"], ["dog", "狗"], ["apple", "蘋果"], ["chair", "椅子"]];
  return Response.json(words.map(([word, chinese]) => ({ document: {
    name: `vocabulary/${lesson}-${word}`,
    fields: { series: { stringValue: "advanced" }, lesson: { integerValue: String(lesson) }, word: { stringValue: word }, chinese: { stringValue: chinese }, pos: { stringValue: "n." } }
  } })));
};
