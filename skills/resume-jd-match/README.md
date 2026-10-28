# 简历 × JD 匹配诊断（第一个真 skill）

平台的第一个可执行 skill。它的任务不只是能跑，更是**验证 skill 契约和 artifact schema 是否立得住**——所以刻意选了入参两端都已有现成实现、产出可机械校验的一件事。

决策理由见 [`../../docs/决策记录.md`](../../docs/决策记录.md) 的 D5 / D6 / D7。

## 架构：确定性层扛重活，模型只做判定

```
简历文件 ──[确定性] pypdf layout 解析 ──→ resume.parsed  ┐
                                                          ├──[LLM] 逐条判定 ──→ match.report
JD（岗位库 / 粘贴）──[确定性] 取原文 ─────→ jd.raw        ┘

           whatajob-match-v3 三维打分 ──→ meta.ruleScore（不进 prompt）
```

- **解析不用模型。** 复用 WhatAJob 的规则解析器，确定性、可复现、零推理成本。模型看不到 PDF，只看到已结构化的章节文本。
- **模型只做一件事**：对着给定的 JD 原文逐条判定 matched / gap / unknown，为每条 matched 引出简历原文。这是分类 + 抽取，不是生成——所以便宜的模型够用，幻觉面被压到最小。
- **规则分不进 prompt**，只写 `meta.ruleScore`。两个判官保持双盲，**分歧即人工复核队列**。完整理由见 D7。

## 产出为什么叫 `match.report` 而不是 `resume`

artifact schema 的第一次落地。下游模拟面试 skill 声明消费 `resume`，这份诊断报告就**不可能**被当成简历本身喂进去。上下文失真靠类型挡掉，不靠 prompt 叮嘱。见 D6。

## 从 WhatAJob 复用什么

来源：`~/Desktop/zxy/CodingProgram/WhatAJob/serve.py`（单文件零依赖设计，解析与 Web 服务混在一起）

| 复用 | 位置 | 说明 |
|---|---|---|
| 文件 → 文本 | `_extract_text_from_resume` | pypdf `extraction_mode="layout"` 按坐标重建阅读顺序，双栏能还原；NFKC 规范化 |
| 章节切分 | `_split_resume_sections` / `_find_section_positions` | 不依赖换行，兼容中英混排 PDF |
| 字段抽取 | `_parse_edu_entries` / `_extract_section_skills` 等 | 学历、院校、专业、时间区间、技能标签 |
| 三维打分 | `_MATCH_W` / `classify_family` / `_SKILL_TO_DIR` | role 0.35 / skill 0.4 / direction 0.25，含跨族错配惩罚 |

⚠️ **两件事必须先确认**：

1. WhatAJob 是从 `github.com/LLLLLrf/WhatAJob.git` clone 的，**不是自有代码**。商用前须确认 license 与作者授权。
2. `data/jobs.db` 走 Git LFS。若当时未装 LFS，本地只是一百多字节的指针文件，取不出 JD。先 `ls -lh data/jobs.db` 确认是否 ~138MB。

## eval

`eval.jsonl` 六条，全部针对具体失效模式：

| 用例 | 测什么 |
|---|---|
| `pm-resume-vs-algo-jd` | 领域词 ≠ 能力。规则层已用 family penalty 修过，LLM 层不能退化回词频 |
| `missing-degree-must-be-unknown` | 没写≠没有。最容易被猜成 gap 的一类 |
| `fresh-grad-vs-3yr-blocking` | 真 blocking 要判出来，别和 unknown 混 |
| `strong-match-needs-real-quotes` | evidence 逐字校验（可机械断言） |
| `minor-gap-must-not-tank-verdict` | 过度惩罚倾向 |
| `coverage-invariant-long-jd` | 覆盖不变量：8 条要求必须回 8 项，不许合并同类项 |

**三条断言是纯机械的，不需要人判**：

1. `requirements.length == meta.jdRequirementCount`
2. 每个 `evidence.quote` 是简历正文的子串
3. 每个 `requirement` 是 JD 原文的子串

先把这三条跑成红绿灯当 CI 用，主观质量再说。

## 还没做

- [ ] 把解析 + 打分从 `serve.py` 抽成可导入模块 `parser/`。serve.py 是单文件 monolith，函数都是 `_` 私有前缀且与 HTTP handler 交织，需要抽取 + 跑通 import
- [ ] `fixtures/` 六份简历样本。**别用真实学生简历**，手造或彻底脱敏
- [ ] 从 `jobs.db` 取真实 JD 替换 eval 里手写的 `requirements_raw`（现在这批是按真实 JD 语感手写的占位）
- [ ] eval runner：跑一遍、校验三条机械不变量、输出红绿灯
- [ ] 接百炼 Qwen-Plus（OpenAI 兼容接口），成本实测
