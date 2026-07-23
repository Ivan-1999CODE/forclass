---
name: 英文時態出題規則
description: 當使用者要產生、修改、審查或匯入英文時態選擇題、國小或國中英文文法題庫、課堂即時問答 JSON 題目時，一定要使用此 skill。此 skill 規範以「動詞循環題組」出時態題（同一動詞涵蓋三單、過去式、否定句、問句、句首助動詞、回答句），核心考點為助動詞後接原形、三單與過去式變化；並檢查時態選項是否同一動詞變化、輸出為現行 628 JSON 格式（不含 explanation），要求題組以中文命名、標注國小版或國中版與日期。
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

### 混合時態的處理方式

使用者要出混合題時，會直接指定要混哪些時態（例如「現在簡單式跟過去簡單式」，或「多種時態」），並同時指定這份檔案的版本（國小或國中、簡單或困難）。

- **整份檔案套用同一組版本規範**：一旦決定是「國小版｜困難版」，全檔所有題目都照這個學習階段與句型難度出，不在同一份裡混難度。
- **混合只發生在「時態」層次**，不是另一種版本模式。所以不需要額外定義「混合版」；標題用「時態混合複習」之類具體寫出混了哪些時態即可。
- 標題要列出實際混到的時態，例如 `國中版｜困難版｜現在簡單式＋過去簡單式｜日期`。
- 各時態的題目仍各自遵守其動詞循環題組與考點；只是把不同時態的題組放進同一份檔案，並打散排列。

## 版本分類（兩個平行維度）

每份題組由**兩個各自獨立的維度**決定，兩者交叉組合，命名時「學習階段」寫在前、「句型難度」寫在後。

**維度一：學習階段**（決定單字與句長難度）

- 國小版：短句、常見主詞、生活化單字。
- 國中版：句子較長、可加時間副詞，少量常見不規則動詞。

**維度二：句型難度**（決定題型組成，只有兩種）

- 簡單版：只出直述句。適合剛建立概念時使用，避免學生同時處理問句、否定句與時態變化。
- 困難版：混合直述句、否定句與問句。適合複習、檢測或學生已熟悉基本規則後使用。

交叉後共 4 種組合：國小版｜簡單版、國小版｜困難版、國中版｜簡單版、國中版｜困難版。

> 「混合」不是第三種難度。標題出現「混合」時，只代表這份題組同時考多個時態或規則/不規則動詞（總複習用途），句型難度仍然只分簡單版與困難版。

簡單版範例（只有直述句）：

```json
{ "prompt": "Tom ________ to school every day.", "options": ["walk", "walks", "walked", "walking"], "answerIndex": 1 }
```

困難版範例（混合問句、否定句）：

```json
{ "prompt": "________ Tom walk to school every day?", "options": ["Do", "Does", "Did", "Is"], "answerIndex": 1 }
```

## 題目格式

除非使用者明確指定題數，完整題庫預設產生 50 題。若使用者要求多個題組，例如時間介系詞與地點介系詞各一份，則每一份題組都要各 50 題。

放進課堂即時問答系統的檔案是 `quizzes/*.json`，採用現行格式（以 `(628)` 系列題庫為準）。**輸出 JSON 不含 `explanation` 欄位**，整份檔案的外層結構如下：

```json
{
  "id": "國小版-簡單版-現在簡單式-2026-06-10",
  "title": "國小版｜簡單版｜現在簡單式｜2026-06-10",
  "date": "2026-06-10",
  "defaultTimeLimitSec": 20,
  "questions": [
    { "prompt": "Tom ________ to school every day.", "options": ["walk", "walks", "walked", "walking"], "answerIndex": 1 },
    { "prompt": "Tom ________ to school yesterday.", "options": ["walk", "walks", "walked", "walking"], "answerIndex": 2 }
  ]
}
```

欄位規則：

- `id`、`title` 用中文命名，含學習階段、句型難度與日期（見「先決定版本」）。
- `date` 用實際出題日期。
- `defaultTimeLimitSec` 預設 20；使用者另有指定才調整。
- `prompt` 可用英文句子，空格統一用 `________`（八個底線）；題組名稱、檔名、分類用中文。
- `options` 預設 4 個選項，除非使用者指定其他數量。
- `answerIndex` 從 0 開始計算，務必逐題核對對應到正解。
- **不要寫 `explanation` 欄位**。本 skill 內範例出現的中文說明只是給出題者判斷用的推理，不寫進 JSON。

## 時態選項規則

如果題目是在考動詞時態或動詞形式，選項必須來自同一個動詞，不要混入不同中文意義的動詞。

正確做法（選項都是同一動詞 clean 的變化，yesterday 表過去，答 cleaned）：

```json
{ "prompt": "Anna ________ her room yesterday.", "options": ["clean", "cleans", "cleaned", "cleaning"], "answerIndex": 2 }
```

避免（選項混入不同動詞，變成同時考字義與時態，容易模稜兩可）：

```json
{ "prompt": "Anna ________ her room yesterday.", "options": ["cleaned", "played", "opened", "visited"], "answerIndex": 0 }
```

常見選項組合：

- 規則動詞：原形、第三人稱單數、過去式、現在分詞，例如 `play / plays / played / playing`
- 加 es 動詞：`watch / watches / watched / watching`
- y 結尾動詞：`study / studies / studied / studying`
- be 動詞題：用同一類助詞選項，例如 `am / is / are / was / were`，不要混入一般動詞。
- 助動詞題：選項可用 `Do / Does / Did / Is / Are`，但題幹必須讓答案唯一。

國小版優先使用規則動詞；國中版可以少量加入常見不規則動詞，但要避免偏難字。

## 誘答選項同類原則（通用）

這條原則適用於所有文法題，不只時態題：**誘答選項必須和正解屬於同一個考點類別**，這樣學生是在判斷文法規則，而不是靠字義猜答案。

- 時態題：選項是同一個動詞的各種變化（`go / goes / went / going`），不要混入別的動詞。
- 介系詞題：選項**全部都是介系詞**（例如 `in / on / at / under`），用其他合理但錯誤的介系詞當誘答，逼學生分辨用法。

介系詞題範例：

```json
{ "prompt": "The cat is ________ the table.", "options": ["in", "on", "at", "under"], "answerIndex": 1 },
{ "prompt": "I get up ________ seven o'clock.", "options": ["in", "on", "at", "for"], "answerIndex": 2 },
{ "prompt": "My birthday is ________ May.", "options": ["in", "on", "at", "of"], "answerIndex": 0 }
```

同樣道理可推廣到其他題型：主格題選項全是主格代名詞、所有格題選項全是所有格代名詞、be 動詞題選項全是 be 動詞。只要選項同類，題目才是在測那一個考點。

## 時態題：動詞循環題組（核心設計）

時態題不是零散地出，而是以「動詞循環題組」為單位。**選定一個動詞＋一個生活場景（例如 Tom go to school by bus），再用同一個動詞、同一組場景，衍生出一整串對照題**。這樣學生會反覆在同一句型上判斷時態與動詞形式，陷阱才會清楚，也才貼近學生真正會踩的坑。

每個動詞循環題組盡量涵蓋下列題型。時間線索（every day / yesterday / last week / ago…）是判斷時態的唯一依據，每題都要有清楚線索。

| 題型 | 例句 | 時間線索 | 考點 | 常見誘答陷阱 |
|------|------|---------|------|------------|
| 現在簡單式直述 | `Tom ________ to school every day.` | every day / on Sundays / now | **三單**（goes） | 誤選原形 go |
| 過去簡單式直述 | `Tom ________ to school yesterday.` | yesterday / ago / last~ | **過去式**（went） | 誤選三單或原形 |
| 否定句 | `Tom didn't ________ to school yesterday.` | didn't / doesn't 已出現 | **助動詞後接原形**（go） | 被 yesterday 騙去選 went |
| 問句（助動詞已給） | `Did Tom ________ to school yesterday?` | Did / Does 已出現 | **助動詞後接原形**（go） | 被 yesterday 騙去選 went |
| 句首助動詞 | `________ Tom go to school yesterday?` | 由主詞＋時間決定 | **選對 Do/Does/Did** | 三單現在→Does、過去→Did、be 動詞誘答 Is |
| 回答句（簡答） | `"Did Tom go...?" "Yes, he ________."` | 對應問句的助動詞 | **回答句助動詞一致**（did/does） | 被 is 或錯時態助動詞騙 |

### 混合題型與空格位置交錯

同一份時態題庫不要只出一種句型。**同一個動詞循環組裡就要混合直述句、否定句與問句**，讓學生反覆切換判斷，而不是連續好幾題都是同一種型態。

更關鍵的是**空格位置要交錯**——同一個句意，可以把空格挖在不同位置，考不同的東西：

- 空格考**助動詞**：`________ Tom go to school yesterday?` → 考選 `Did`（動詞已是原形 go，線索在時間）。
- 空格考**後面的動詞**：`Did Tom ________ to school yesterday?` → 考選原形 `go`（助動詞已給，陷阱是 went）。
- 空格考**回答句的助動詞**：`"Did Tom go...?" "Yes, he ________."` → 考選 `did`。

出題時要刻意在這三種挖空位置之間輪替，學生才無法靠固定位置猜答案，也才能同時檢測「選對助動詞」與「助動詞後接原形」兩個考點。

### 三大考點的操作重點

1. **助動詞後接原形（最重要的陷阱）**：只要句子裡已經出現 `do / does / did / doesn't / didn't / don't`，空格的主要動詞一律回原形。誘答一定要放句中時間線索所暗示的形式（例如句子有 yesterday，就把 `went` 放進選項當陷阱），逼學生分辨「時態已由助動詞承擔，動詞不再變化」。
   - `Did Tom ________ to school yesterday?` → 答 `go`，陷阱 `went`
   - `Tom didn't ________ to school yesterday.` → 答 `go`，陷阱 `went`
2. **三單**：現在簡單式且主詞為第三人稱單數時，動詞加 -s/-es/-ies。用同一動詞的四態當選項（`go / goes / went / going`），並在 -es、子音+y 的動詞上特別出題（watches、studies）。
3. **過去式（規則與不規則）**：時間線索為過去時，直述句考過去式。**誘答要放「假的規則化錯誤變化」**——學生實際會犯的錯，例如 `studyed / stoped / buyed / goed / teached / maked / breaked / swimmed`。正解與這些偽變化並列，正是這類題的鑑別度來源。

### 選項組合對照

- 四態直述／助動詞後接原形題：`go / goes / went / going`（同一動詞）。
- 句首助動詞題：`Do / Does / Did / Is`（或 `Are / Was / Were`），用 be 動詞當誘答。
- 否定句題：`don't / doesn't / didn't / isn't`。
- 回答句題：`do / does / did / is`。
- 過去式規則動詞題：務必混入偽規則化誘答（stoped、studyed 之類）。

### 一個完整動詞循環題組範例

```json
{ "prompt": "Tom ________ to school by bus every day.", "options": ["go", "goes", "went", "going"], "answerIndex": 1 },
{ "prompt": "Tom ________ to school by bus yesterday.", "options": ["go", "goes", "went", "going"], "answerIndex": 2 },
{ "prompt": "Tom doesn't ________ to school by bus on Sundays.", "options": ["go", "goes", "went", "going"], "answerIndex": 0 },
{ "prompt": "Tom didn't ________ to school by bus yesterday.", "options": ["go", "goes", "went", "going"], "answerIndex": 0 },
{ "prompt": "Does Tom ________ to school by bus every day?", "options": ["go", "goes", "went", "going"], "answerIndex": 0 },
{ "prompt": "Did Tom ________ to school by bus yesterday?", "options": ["go", "goes", "went", "going"], "answerIndex": 0 },
{ "prompt": "\"Does Tom go to school by bus every day?\" \"Yes, he ________.\"", "options": ["do", "does", "did", "is"], "answerIndex": 1 },
{ "prompt": "\"Did Tom go to school by bus yesterday?\" \"No, he ________.\"", "options": ["don't", "doesn't", "didn't", "isn't"], "answerIndex": 2 }
```

50 題的完整過去式題庫，就是用 8～12 個不同動詞、各出一組上面的循環題，再打散排列而成。

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

範例（your brother 第三人稱單數＋every Sunday 現在式，答 Does；Are 為 be 動詞誘答）：

```json
{ "prompt": "________ your brother play soccer every Sunday?", "options": ["Do", "Does", "Did", "Are"], "answerIndex": 1 }
```

範例（the students 複數＋reading now 現在進行式，答 Are）：

```json
{ "prompt": "________ the students reading now?", "options": ["Is", "Are", "Was", "Do"], "answerIndex": 1 }
```

### 助動詞後接原形

考 do、does、did、will、can、must、should 後面的動詞要用原形。

範例（did not 後接原形，答 watch；watched 為時態誘答）：

```json
{ "prompt": "Mia did not ________ TV last night.", "options": ["watch", "watches", "watched", "watching"], "answerIndex": 0 }
```

範例（can 後接原形，答 run）：

```json
{ "prompt": "He can ________ fast.", "options": ["run", "runs", "ran", "running"], "answerIndex": 0 }
```

### 否定句

考 do not、does not、did not、be not、will not 等否定結構。

範例（They 複數＋現在式否定，答 do not）：

```json
{ "prompt": "They ________ like carrots.", "options": ["do not", "does not", "did not", "is not"], "answerIndex": 0 }
```

範例（Lisa 單數＋yesterday 過去，答 was not）：

```json
{ "prompt": "Lisa ________ at school yesterday.", "options": ["is not", "are not", "was not", "were not"], "answerIndex": 2 }
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
- 時態題是否以動詞循環題組出題：同一動詞、同一場景，涵蓋現在式三單、過去式、否定句、問句、句首助動詞、回答句。
- 同一份題庫是否混合直述句、否定句與問句，而不是連續同一種句型。
- 空格位置是否交錯：有時挖在助動詞（考選 Do/Does/Did），有時挖在後面的動詞（考原形），有時挖在回答句助動詞。
- 誘答選項是否與正解同類：時態題全用同一動詞變化、介系詞題全用介系詞、主受格題全用同類代名詞，不靠字義取巧。
- 助動詞後接原形的題目，誘答是否放了句中時間線索所暗示的形式（例如 yesterday 句放 `went` 當陷阱）。
- 過去式規則動詞題是否放了假規則化誘答（如 stoped、studyed），逼學生分辨正確變化。
- JSON 是否為現行 628 格式：有外層 `id / title / date / defaultTimeLimitSec / questions`，且**每題不含 `explanation` 欄位**。
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
4. 先列出 8～12 個可用動詞清單。時態題以「動詞循環題組」為組織單位：每個動詞出一組，涵蓋現在式三單、過去式、否定句、問句、句首助動詞、回答句，再打散排列成整份題庫。
5. 為每組生成同一動詞的四態選項；過去式規則動詞記得放偽規則化誘答（stoped、studyed 之類）。
6. 產生 JSON 後，逐題檢查 `prompt`、`options`、`answerIndex`，並確認為現行 628 格式（不含 `explanation`）。
7. 回頭做第二輪審查，確認沒有兩個正解、沒有模稜兩可題目、沒有句型版本混用錯誤，特別檢查助動詞後是否一律原形。
8. 最後檢查中文命名、版本標注、日期標注與 JSON 格式。
9. 做完之後自動上傳 GitHub。
