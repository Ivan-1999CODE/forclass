---
name: 英文時態出題規則
description: 當使用者要依照課本、照片、舊題或指定文法考點，重新產生、修改、審查英文動詞與時態選擇題時，一定要使用此 skill。適用於國小或國中英文、簡單版或困難版、課堂即時問答 JSON 題庫。核心是判斷句首該用 be 動詞或助動詞、現在簡單式第三人稱單數、過去簡單式、助動詞後接原形、be + V-ing，以及現在完成式的 have / has + PP；選項可為一個字或完整動詞片語，但必須聚焦同一個動詞與文法考點，避免靠大小寫、冷僻單字或無關字義作答。
---

# 英文時態出題規則

更新日期：2026-09-09

## 目標

依照使用者提供的課本照片、舊題或指定考點，重新設計真正測量文法觀念的英文選擇題。

把學生的判斷集中在「這個句子的時態由誰承擔、主要動詞該用什麼形式」，不要讓大小寫、冷僻單字、無關字義或故意拼錯的假字搶走考點。

教學上可以沿用「一個句子就是一個動詞」的入門口訣，但出題時要理解得更精確：

- 一個簡單句通常只有一個承擔時態與主詞一致的動詞核心。
- 如果已有 `do / does / did` 等助動詞，後面的主要動詞使用原形。
- 如果以 `be` 構成進行式，使用 `be + V-ing`，時態與主詞一致由 `be` 承擔。
- `be` 也可以自己作主要動詞，後接名詞、形容詞或地點。
- 現在完成式使用 `have / has + PP`；題目可以只挖 `have / has`、只挖 PP，或挖掉整個動詞片語。

## 收到參考題時先分析

先辨認參考題真正想考的文法，不要直接照抄參考書的所有選項設計。

1. 找出每題的主詞、時間線索、句型和空格位置。
2. 判斷空格是在考：
   - `be` 動詞；
   - 句首助動詞；
   - 一般動詞的形式；
   - 助動詞後的原形；
   - 現在完成式的 `have / has`、PP 或完整動詞片語；
   - 或完整動詞片語。
3. 保留有效的文法陷阱，排除只考大小寫、冷僻字義、排版或明顯錯字的題目。
4. 重新寫出自然、短而清楚的句子，不必沿用原題的人名或情境。
5. 確認每題只有一個文法上與語意上都成立的答案。

## 版本設定

每份題組由兩個獨立維度組成。

### 學習階段

- 國小版：使用短句、常見主詞與生活單字。
- 國中版：句子可以稍長，加入較多時間線索與常見不規則動詞，但仍避免冷僻單字。

學習階段只控制單字與句長，不決定是否出問句或否定句。

### 句型難度

- 簡單版：只出一般肯定句（回答句），不出否定句或問句。
- 困難版：在一般肯定句（回答句）的基礎上增加否定句與問句，三種句型混合出題。若使用者沒有指定比例，預設約為肯定句 40%、問句 30%、否定句 30%。

簡單版仍可考不同時態，也可讓空格包含完整動詞片語；「簡單」只表示句型限於一般肯定句。困難版不能只出否定句或問句，必須保留一定比例的肯定句，讓三種句型交錯出現。

## 核心考點

### 1. 句首選擇：be 動詞或助動詞

問句句首的答案要由空格後面的結構決定。

| 空格後的結構 | 應考慮的句首 | 範例 |
|---|---|---|
| 名詞、形容詞、地點 | `Am / Is / Are / Was / Were` | `________ Amy busy yesterday?` |
| `V-ing` | `Am / Is / Are / Was / Were` | `________ Amy studying now?` |
| 一般動詞原形 | `Do / Does / Did` | `________ Amy study every day?` |
| 過去時間＋一般動詞原形 | `Did` | `________ Amy study yesterday?` |

範例：

```json
{ "prompt": "________ Leo playing basketball now?", "options": ["Is", "Does", "Did", "Are"], "answerIndex": 0 }
```

```json
{ "prompt": "________ Leo play basketball every day?", "options": ["Is", "Does", "Did", "Are"], "answerIndex": 1 }
```

這類題允許 `be` 與助動詞同時出現在選項中，因為考點正是辨認句子需要哪一種動詞結構。

### 2. 現在簡單式與第三人稱單數

- `I / you / we / they` 與複數主詞使用原形。
- `he / she / it`、單數人名與單數名詞使用第三人稱單數形式。
- 適量涵蓋 `-s`、`-es`、`子音 + y → -ies`，但不要讓拼字規則壓過句型判斷。

```json
{ "prompt": "Mia ________ English every day.", "options": ["study", "studies", "studied", "is studying"], "answerIndex": 1 }
```

### 3. 過去簡單式

- 直述句以清楚的過去時間線索考過去式。
- 規則動詞與不規則動詞預設分開出題。
- 只有使用者明確要求混合複習時，才把兩類動詞放進同一份題組。

規則動詞題：

```json
{ "prompt": "Mia ________ TV last night.", "options": ["watch", "watches", "watched", "is watching"], "answerIndex": 2 }
```

不規則動詞題：

```json
{ "prompt": "Mia ________ home yesterday.", "options": ["go", "goes", "went", "is going"], "answerIndex": 2 }
```

預設不要使用 `goed`、`buyed`、`haved`、`teachs`、`studyed` 等假字。只有使用者明確要求考拼字或動詞變化規則時，才可把這類形式當誘答。

### 4. 助動詞後接原形

只要題幹已出現 `do / does / did / don't / doesn't / didn't`，後面的主要動詞就使用原形。

```json
{ "prompt": "Did Mia ________ TV last night?", "options": ["watch", "watches", "watched", "watching"], "answerIndex": 0 }
```

```json
{ "prompt": "Mia didn't ________ TV last night.", "options": ["watch", "watches", "watched", "watching"], "answerIndex": 0 }
```

選項可以包含學生常犯的結構錯誤，例如 `didn't went`，因為它直接檢測「助動詞後接原形」；但不要使用與考點無關的拼字假字。

### 5. be + V-ing

現在進行式使用 `am / is / are + V-ing`。若範圍包含過去進行式，才使用 `was / were + V-ing`。

空格可以只挖一部分：

```json
{ "prompt": "Leo is ________ basketball now.", "options": ["play", "plays", "played", "playing"], "answerIndex": 3 }
```

也可以把完整的 `be + V-ing` 一起挖掉：

```json
{ "prompt": "Leo ________ basketball now.", "options": ["play", "plays", "played", "is playing"], "answerIndex": 3 }
```

第二種更能檢查學生是否理解完整時態結構，不必把所有選項限制成單一字。

### 6. 現在完成式：have / has + PP

現在完成式使用 `have / has + PP`。`I / you / we / they` 與複數主詞使用 `have`；`he / she / it`、單數人名與單數名詞使用 `has`。

現在完成式題組有三個明確考點：

1. 判斷主詞應搭配 `have` 還是 `has`。
2. 判斷正確的 PP（過去分詞），尤其是避免把不規則動詞的過去式誤當成 PP。
3. 判斷完整的 `have / has + PP` 結構。

同一份題組應混合這三個考點，不必每題都把 `have / has + PP` 整組挖掉。使用者未指定比例時，三類題數應盡量平均。

只考 `have / has`：

```json
{ "prompt": "Amy ________ visited the zoo twice.", "options": ["have", "has", "is", "did"], "answerIndex": 1 }
```

只考 PP：

```json
{ "prompt": "We have ________ that movie before.", "options": ["see", "saw", "seen", "seeing"], "answerIndex": 2 }
```

考完整的 `have / has + PP`：

```json
{ "prompt": "Leo ________ his homework already.", "options": ["has finished", "have finished", "finished", "is finishing"], "answerIndex": 0 }
```

設計這類題目時：

- 只挖 `have / has` 時，題幹必須保留正確的 PP，讓學生專心判斷主詞一致。
- 只挖 PP 時，題幹必須保留 `have / has`，選項用同一個動詞的原形、過去式、PP、V-ing 等合理形式。
- 挖完整片語時，所有選項保留同一個主要動詞，並搭配能排除其他時態的時間線索或結果語境。
- 優先使用 `already, before, so far, since, for`，或「已完成且影響現在」的清楚語境。
- 過去式與 PP 同形的規則動詞仍可使用，但第二類考點應以 `seen/saw, eaten/ate, done/did, written/wrote, gone/went, taken/took, broken/broke` 等常見不規則動詞為主，直接檢查學生能否區分過去式與 PP。

## 各時態共同的三層出題標準

現在簡單式、過去簡單式、未來式、進行式與完成式都應盡量讓學生看到「結構零件、動詞形式、完整結構」三層考法，而不是每一題都用同一種挖空方式。

| 時態 | 結構零件 | 動詞形式 | 完整結構 |
|---|---|---|---|
| 現在簡單式 | `do / does` 或主詞一致 | 原形或第三人稱單數 | `plays / doesn't play / is playing` 等完整判斷 |
| 過去簡單式 | `did` | 原形、過去式，尤其常見不規則變化 | `played / didn't play / was playing` 等完整判斷 |
| 未來式 | `will` | `will` 後接原形 | 完整的 `will + 原形` |
| 現在進行式 | `am / is / are` | 正確的 `V-ing` | 完整的 `be + V-ing` |
| 現在完成式 | `have / has` | 正確的 PP | 完整的 `have / has + PP` |

若三層考法都適用於指定題組，50 題預設分配為 17 題、17 題、16 題；正確答案位置仍須另外平均打散。若題組受句型限制，則依實際可考結構調整，不可為了湊比例寫出不自然或超出範圍的題目。

簡單版只出一般肯定句（回答句）的規則維持不變。未來式、進行式與完成式在肯定句中仍可完整採用三層考法；現在簡單式與過去簡單式的 `do / does / did` 通常需要問句或否定句，因此這類考點放在困難版。不得為了讓簡單版也出現助動詞而破壞版本定義。

### 有效誘答的共同原則

- 同一題原則上使用同一個主要動詞，讓學生判斷形式或結構，不靠字義猜答案。
- 每個錯誤選項都要對應可預期的文法錯誤，例如原形、第三人稱單數、過去式、PP、`V-ing` 或錯誤的助動詞搭配。
- 題幹已有 `do / does / did / will` 時，誘答可包含錯誤的變化動詞，用來檢查「助動詞後接原形」。
- 過去式題可用常見動詞的 PP 當誘答，例如 `went / gone`；完成式的 PP 題則可反向用過去式當誘答，例如 `saw / seen`。
- 不使用與考點無關的動詞、明顯荒謬選項、大小寫差異或未經要求的假字湊選項。
- 完整結構題必須提供足以排除其他時態的時間線索或語境；如果兩個選項在自然英語中都可能成立，就必須重寫題幹或更換誘答。

## 空格與選項可以包含完整動詞片語

一個空格可以對應一個字，也可以對應兩個以上的字。選項長度不必完全相同，重點是每個選項都要檢測同一個文法判斷。

### 主要動詞或時態題

所有選項保留同一個主要動詞，可以加上 `be` 或助動詞形成完整片語。

合適：

```text
play / plays / played / is playing
```

```text
go / goes / went / is going
```

```text
doesn't play / didn't play / isn't playing / doesn't plays
```

最後一組中的 `doesn't plays` 是直接針對「助動詞後接原形」的結構誘答，不是無關拼字陷阱。

不合適：

```text
played / ate / opened / studied
```

這會把時態題變成字義選擇題。

### 使用時間線索時避免多重答案

時間詞必須能排除其他選項。

例如：

```json
{ "prompt": "Leo ________ basketball yesterday.", "options": ["play", "plays", "played", "is playing"], "answerIndex": 2 }
```

`is playing` 可以作為現在進行式誘答，因為它和 `yesterday` 衝突。

不要在這題隨意加入 `was playing`，因為：

- `Leo played basketball yesterday.`
- `Leo was playing basketball yesterday.`

兩句都可能成立，會產生多重答案。

若要考過去進行式，題幹必須增加正在進行中的情境，例如：

```json
{ "prompt": "Leo ________ basketball when I saw him yesterday.", "options": ["plays", "played", "is playing", "was playing"], "answerIndex": 3 }
```

即使有時間詞，也要逐題檢查其他時態是否仍能成立；不能只看關鍵字機械配對。

### 未來式與現在進行式的重疊

現在進行式可以表示已安排好的未來，因此未來時間詞不一定能排除 `be + V-ing`。

例如下題不合適：

```json
{ "prompt": "Amy ________ Grandma tomorrow.", "options": ["will visit", "visits", "visited", "is visiting"], "answerIndex": 0 }
```

`Amy will visit Grandma tomorrow.` 與 `Amy is visiting Grandma tomorrow.` 都可能自然成立，所以這題有多重答案。

修改時可採下列方式：

- 如果只考 `will`，保留後面的原形，例如 `Amy ________ visit Grandma tomorrow.`，選項使用 `will / is / did / has`。
- 如果考完整未來式，改用較不容易表達個人安排的語境，例如預測、承諾、臨時決定或未來狀態，並逐一代入所有選項檢查。
- 若 `be + V-ing` 放入選項後仍能自然表達已安排的未來，就移除該誘答或重寫題幹，不可只因目標單元是未來式就把 `will` 當成唯一答案。

合適範例：

```json
{ "prompt": "Amy ________ be ten years old next month.", "options": ["will", "is", "did", "has"], "answerIndex": 0 }
```

多重答案檢查不限於這一組時態。現在完成式與過去式、過去簡單式與過去進行式、現在簡單式與現在進行式，也都必須依完整語境判斷，不可只靠 `tomorrow, yesterday, now, already` 等單一關鍵字機械配對。

## 選項設計

### 基本原則

1. 主要動詞形式題使用同一個主要動詞。
2. 句首動詞題可混合 `be` 與 `Do / Does / Did`，因為這正是考點。
3. 完整動詞片語可以當作一個選項，例如 `is playing`、`didn't play`。
4. 現在完成式題可只考 `have / has`、只考 PP，或考完整的 `have / has + PP`，並在同一份題組中合理混合。
5. 誘答要對應學生可預期的文法誤解。
6. 選項順序要打散，正解位置不可形成固定模式。
7. 每題只能有一個完整成立的答案。

### 禁止把這些當主要考點

- 只差句首大小寫，例如 `Does / does`。
- 人名、專有名詞或選項開頭的大寫陷阱。
- 冷僻單字或文化背景。
- 不同意思的動詞混在時態選項中。
- 明顯荒謬、完全不同詞性的陪襯選項。
- 未經要求使用 `goed`、`haved`、`teachs` 等假字。

大小寫與標點仍需正確，但它們只是基本校對，不是學生作答的線索。

## 微型對照題組

不要強迫每個動詞重複六到八次。每個動詞或生活場景通常延伸 2～3 題即可，用來對照最相關的結構。

例如：

```json
[
  { "prompt": "Leo ________ basketball every day.", "options": ["play", "plays", "played", "is playing"], "answerIndex": 1 },
  { "prompt": "________ Leo play basketball every day?", "options": ["Do", "Does", "Did", "Is"], "answerIndex": 1 },
  { "prompt": "Leo doesn't ________ basketball on Mondays.", "options": ["play", "plays", "played", "playing"], "answerIndex": 0 }
]
```

換一個動詞和情境後再做下一組，最後把題目合理打散。這樣仍有對照學習效果，又不會因重複同一句而讓學生靠記憶作答。

## 單字難度

優先使用學生熟悉、容易從句意理解的字。

- 動詞：`be, go, come, play, walk, run, read, write, eat, drink, like, help, clean, open, close, cook, wash, watch, study, live, work, have`
- 名詞：`school, home, book, ball, room, desk, door, lunch, dinner, teacher, friend, family, dog, cat`
- 時間詞：`every day, on Sundays, now, today, yesterday, last night, last week, two days ago`

若目標是規則動詞過去式，優先使用 `play, walk, clean, open, close, watch, cook, wash`。

若目標是不規則動詞過去式，優先使用常見動詞，例如 `go/went, come/came, eat/ate, see/saw, buy/bought, teach/taught, run/ran, sing/sang`。

## 題組範圍

- 規則動詞與不規則動詞預設分開。
- 簡單現在式、簡單過去式、現在進行式等不同時態，預設依使用者指定出題。
- 現在完成式只有在使用者指定時才加入；出題時混合 `have / has`、PP 與完整片語三種挖空方式。
- 使用者沒有要求混合時，不要自行擴張成綜合時態測驗。
- 使用者明確說「混合複習」時，才混合時態或規則／不規則動詞，並在標題寫清楚實際範圍。
- 不要因為是國中版就自行加入完成式、被動語態或冷僻動詞。

## 題目格式

若使用者指定一般文字、表格或其他格式，依其要求輸出。若題目要放進課堂即時問答系統的 `quizzes/*.json`，使用下列格式：

```json
{
  "id": "國小版-簡單版-現在簡單式-2026-07-29",
  "title": "國小版｜簡單版｜現在簡單式｜2026-07-29",
  "date": "2026-07-29",
  "defaultTimeLimitSec": 20,
  "questions": [
    {
      "prompt": "Mia ________ English every day.",
      "options": ["study", "studies", "studied", "is studying"],
      "answerIndex": 1
    }
  ]
}
```

格式規則：

- 題名與檔名使用中文，標出學習階段、句型難度、考點與實際日期。
- 空格統一使用 `________`。
- 預設每題 4 個選項。
- 一個選項可以包含空格，例如 JSON 字串 `"is playing"`。
- `answerIndex` 從 0 開始。
- 每題不加入 `explanation` 欄位。
- 若使用者未指定題數，完整題庫預設 50 題。

## 產出流程

1. 確認學習階段、簡單版或困難版、考點、規則／不規則動詞、題數與輸出格式。
2. 若資訊不完整但不會明顯改變教學方向，採用保守預設並在回覆中說明。
3. 列出這份題組實際要考的文法模組，不自行增加範圍。
4. 選擇簡單動詞與生活情境，每個動詞建立 2～3 題微型對照。
5. 依空格位置決定使用單字選項或完整動詞片語。
6. 產生題目後逐題代入四個選項，以自然英語的實際用法檢查是否只有一個答案成立，不能只用單元名稱或時間關鍵字判定。
7. 檢查規則與不規則動詞是否依要求分開。
8. 檢查簡單版是否全為一般肯定句（回答句）；困難版是否混合肯定句、否定句與問句，且沒有漏掉其中一類。
9. 檢查沒有大小寫題、冷僻字義、無關動詞或未經要求的假字。
10. 若輸出 JSON，使用 JSON parser 驗證格式，再核對題數與 `answerIndex`。

## 最終檢查清單

- 題目是否真的在考文法，而不是大小寫或單字難度？
- 主詞、時間線索與動詞形式是否一致？
- 問句句首是否能由後方結構判斷 `be` 或助動詞？
- `Do / Does / Did` 後面是否使用原形？
- `be + V-ing` 的 `be` 是否符合主詞與時態？
- 現在完成式是否正確使用 `have / has + PP`？
- 現在完成式題是否依考點混合只挖 `have / has`、只挖 PP、挖完整片語三種方式？
- 空格是否可在需要時涵蓋完整動詞片語？
- 片語選項是否保留同一個主要動詞？
- 是否意外同時出現兩個合理時態答案？
- 未來式題若含 `be + V-ing` 選項，是否也能合理表示已安排的未來？若可以，是否已重寫題幹或更換誘答？
- 是否已把每個選項完整代入題幹，依自然語意而非關鍵字確認唯一答案？
- 簡單版是否只有一般肯定句（回答句），完全沒有否定句或問句？
- 困難版是否將肯定句、否定句與問句混合出題，而不是只集中在其中一兩類？
- 規則與不規則動詞是否依要求分開？
- 是否排除只差大小寫的選項？
- 是否排除冷僻字、無關動詞與不必要的假字？
- 選項順序與正解位置是否有變化？
- JSON 的題數、欄位與 `answerIndex` 是否正確？

不要自動上傳 GitHub、部署或改動題庫以外的檔案；只有使用者明確要求時才執行這些動作。
