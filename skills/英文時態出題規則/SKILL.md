---
name: 英文時態出題規則
description: 當使用者要產生、修改、審查或匯入英文時態選擇題、國小或國中英文文法題庫、課堂即時問答 JSON 題目時，一定要使用此 skill。此 skill 會檢查題目難度、時態選項是否同一動詞變化、問句/助動詞/否定句題型是否完整，並要求所有題組以中文命名、標注國小版或國中版與日期。
---

# 英文時態出題規則

建立日期：2026-06-10  
適用等級：國小版、國中版

## 使用時機

使用者要求新增、修改、清理、匯入或檢查英文時態題目時，先套用這份規則。特別是題目會放進課堂即時問答系統的 `quizzes/*.json` 時，要同時檢查 JSON 格式與教學品質。

## 先決定版本

每一份題組都要明確標注版本，不要讓學生或老師猜測難度。版本包含兩層：學習階段（國小版或國中版）與句型難度（簡單版或困難版）。

- 國小版：使用短句、常見主詞、生活化單字，聚焦簡單現在式、簡單過去式、現在進行式、be 動詞與基礎助動詞。
- 國中版：可增加較長句子、時間副詞、否定句、疑問句、助動詞後接原形、簡單未來式與基本完成式，但仍避免冷僻單字。

題組標題、檔名與 `title` 欄位都用中文命名，並包含學習階段、句型難度與日期。

範例：

```json
{
  "id": "國小版-簡單版-現在簡單式與過去簡單式-2026-06-10",
  "title": "國小版｜簡單版｜現在簡單式與過去簡單式｜2026-06-10",
  "date": "2026-06-10"
}
```

## 標題規則

預設使用特定時態命名，因為題組目標清楚，學生比較不會把閱讀理解、字義猜測和文法判斷混在一起。

- 優先：`國小版｜簡單版｜現在簡單式｜2026-06-10`
- 優先：`國中版｜困難版｜助動詞與動詞原形｜2026-06-10`
- 只有在使用者明確要求總複習、混合練習或考前複習時，才使用混合命名，例如：`國中版｜困難版｜時態混合複習｜2026-06-10`

如果題組同時考多個觀念，要在標題中具體列出，不要只寫「英文練習」或「文法題」。

## 句型版本

一般題目分成兩種句型版本。建立題組前要先決定版本，並在標題與檔名標明。

- 簡單版：只出直述句。適合剛建立概念時使用，避免學生同時處理問句、否定句與時態變化。
- 困難版：可以混合直述句、否定句與問句。適合複習、檢測或學生已熟悉基本規則後使用。

簡單版範例：

```json
{
  "prompt": "Tom ____ to school every day.",
  "options": ["walk", "walks", "walked", "walking"],
  "answerIndex": 1,
  "explanation": "every day 表示現在簡單式；Tom 是第三人稱單數，所以動詞用 walks。"
}
```

困難版範例：

```json
{
  "prompt": "____ Tom walk to school every day?",
  "options": ["Do", "Does", "Did", "Is"],
  "answerIndex": 1,
  "explanation": "Tom 是第三人稱單數，現在簡單式問句用 Does，後面的主要動詞 walk 用原形。"
}
```

## 題目格式

除非使用者明確指定題數，完整題庫預設產生 50 題。若使用者要求多個題組，例如時間介系詞與地點介系詞各一份，則每一份題組都要各 50 題。

每題維持系統需要的欄位：

```json
{
  "prompt": "Tom ____ to school every day.",
  "options": ["walk", "walks", "walked", "walking"],
  "answerIndex": 1,
  "explanation": "every day 表示現在簡單式；Tom 是第三人稱單數，所以動詞用 walks。"
}
```

規則：

- `prompt` 可用英文句子，但題組名稱、檔名、說明與分類用中文。
- `options` 建議 4 個選項，除非使用者指定其他數量。
- `answerIndex` 從 0 開始計算。
- `explanation` 用中文說明關鍵線索，例如時間副詞、主詞單複數、助動詞後接原形。

## 時態選項規則

如果題目是在考動詞時態或動詞形式，選項必須來自同一個動詞，不要混入不同中文意義的動詞。

正確做法：

```json
{
  "prompt": "Anna ____ her room yesterday.",
  "options": ["clean", "cleans", "cleaned", "cleaning"],
  "answerIndex": 2,
  "explanation": "yesterday 表示過去時間，所以用 cleaned。"
}
```

避免：

```json
{
  "prompt": "Anna ____ her room yesterday.",
  "options": ["cleaned", "played", "opened", "visited"],
  "answerIndex": 0,
  "explanation": "這種選項同時考字義與時態，容易變成模稜兩可的題目。"
}
```

常見選項組合：

- 規則動詞：原形、第三人稱單數、過去式、現在分詞，例如 `play / plays / played / playing`
- 加 es 動詞：`watch / watches / watched / watching`
- y 結尾動詞：`study / studies / studied / studying`
- be 動詞題：用同一類助詞選項，例如 `am / is / are / was / were`，不要混入一般動詞。
- 助動詞題：選項可用 `Do / Does / Did / Is / Are`，但題幹必須讓答案唯一。

國小版優先使用規則動詞；國中版可以少量加入常見不規則動詞，但要避免偏難字。

## 單字難度

國小版優先單字：

- 動詞：go, play, walk, run, jump, read, write, eat, drink, like, help, clean, open, close, cook, wash, watch, study
- 名詞：school, home, book, ball, room, desk, door, lunch, dinner, teacher, friend, sister, brother, dog, cat
- 時間詞：every day, today, now, yesterday, last night, this morning

國中版可加入：

- 動詞：finish, practice, borrow, invite, visit, answer, decide, prepare, arrive, believe, remember, forget
- 名詞：homework, question, lesson, computer, library, museum, weekend, vacation, exercise
- 時間詞：last weekend, two days ago, tomorrow, next week, since, for, already, yet

避免冷僻字、抽象字或文化背景太重的句子。若題目目標是時態，不要讓字彙難度變成主要障礙。

## 必備題型

每份完整題組至少涵蓋下列類型；如果使用者只要單一題型，則依使用者指定。

### 問句題

考句首助動詞或 be 動詞，例如 Do、Does、Did、Is、Are、Was、Were。

範例：

```json
{
  "prompt": "____ your brother play soccer every Sunday?",
  "options": ["Do", "Does", "Did", "Are"],
  "answerIndex": 1,
  "explanation": "your brother 是第三人稱單數，every Sunday 表示現在簡單式，所以問句用 Does。"
}
```

```json
{
  "prompt": "____ the students reading now?",
  "options": ["Is", "Are", "Was", "Do"],
  "answerIndex": 1,
  "explanation": "the students 是複數，reading now 是現在進行式，所以用 Are。"
}
```

### 助動詞後接原形

考 do、does、did、will、can、must、should 後面的動詞要用原形。

範例：

```json
{
  "prompt": "Mia did not ____ TV last night.",
  "options": ["watch", "watches", "watched", "watching"],
  "answerIndex": 0,
  "explanation": "did not 後面的主要動詞要用原形，所以選 watch。"
}
```

```json
{
  "prompt": "He can ____ fast.",
  "options": ["run", "runs", "ran", "running"],
  "answerIndex": 0,
  "explanation": "can 後面的動詞要用原形，所以選 run。"
}
```

### 否定句

考 do not、does not、did not、be not、will not 等否定結構。

範例：

```json
{
  "prompt": "They ____ like carrots.",
  "options": ["do not", "does not", "did not", "is not"],
  "answerIndex": 0,
  "explanation": "They 是複數主詞，現在簡單式否定句用 do not。"
}
```

```json
{
  "prompt": "Lisa ____ at school yesterday.",
  "options": ["is not", "are not", "was not", "were not"],
  "answerIndex": 2,
  "explanation": "Lisa 是單數主詞，yesterday 表示過去，所以用 was not。"
}
```

## 出題檢查清單

產生題目前先檢查：

- 題組是否標注國小版或國中版。
- 題數是否符合需求；若使用者沒有指定，完整題庫預設 50 題。
- 題組是否標注日期，並使用實際出題日期。
- 題組標題是否用中文，且說明具體時態或題型。
- 如果是時態題，選項是否都來自同一個動詞或同一類助詞。
- 題幹是否有足夠線索，例如時間副詞、主詞單複數、now、yesterday、every day。
- 是否只有一個明確正解。
- 是否沒有模稜兩可的答案，尤其要檢查是否有兩個選項都能成立。
- 是否避免同時考太多能力，例如同時考冷僻單字、翻譯、閱讀推論與時態。
- 國小版是否避開過難單字與過長句子。
- 國中版是否仍保留清楚線索，不因句子變長而造成答案模糊。
- 簡單版是否只包含直述句。
- 困難版是否合理混合直述句、否定句與問句。
- 題型是否包含問句、助動詞後接原形、否定句。
- `answerIndex` 是否對應正確選項。
- 選項順序是否打散，但不要打散到造成學生靠位置猜答案。
- 出題完成後要回頭逐題審查一次，確認沒有多重正解或答案模糊。

## 需要特別注意

- 不要用不同意思的動詞當時態選項，否則學生可能是在猜字義，不是在判斷文法。
- 不要出模稜兩可的題目。若一題有兩個選項在文法上都可以成立，就要改題幹、改選項或刪題。
- 不要讓時間線索與答案衝突，例如 `yesterday` 搭配現在式答案。
- 不要讓主詞與動詞形式衝突，例如 `They plays`。
- 問句題要注意主詞和助動詞一致：`Does he ...?`、`Do they ...?`、`Did she ...?`
- `Do / Does / Did` 後面的主要動詞一律回到原形。
- `be + V-ing` 題目要確認 be 動詞和主詞一致。
- 否定句要分清楚一般動詞否定和 be 動詞否定：`does not play`，但 `is not happy`。
- 不規則動詞只在國中版少量使用，並優先選常見字，例如 go/went、eat/ate、see/saw。
- 若題組是混合時態，題目順序要分散，但每題仍要有明確線索。
- 檔案新增或修改後，要用程式或 JSON parser 檢查格式，避免手動 JSON 錯誤。

## 建議產出流程

1. 先問清楚或自行判斷版本：國小版或國中版。
2. 先決定標題：特定時態優先，混合題只用於總複習。
3. 決定題數；若使用者沒有指定，完整題庫預設 50 題，多個題組則每組各 50 題。
4. 建立題型比例：一般時態選擇題、問句題、助動詞後接原形、否定句。
5. 先列出可用動詞清單，再為每題生成同一動詞的變化選項。
6. 產生 JSON 後，逐題檢查 `prompt`、`options`、`answerIndex`、`explanation`。
7. 回頭做第二輪審查，確認沒有兩個正解、沒有模稜兩可題目、沒有句型版本混用錯誤。
8. 最後檢查中文命名、版本標注、日期標注與 JSON 格式。
