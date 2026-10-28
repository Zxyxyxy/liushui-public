# backend —— skill 执行层

纯标准库，不装任何包。系统 python 3.9 直接跑。

## 怎么跑

```bash
cd ~/Desktop/liushui/backend

# 1. 不花钱先验一遍（不调模型）
python3 test_validate.py        # 校验器反向测试，13 个 case，秒级
python3 run_eval.py --dry       # 分条器 + 校验器不误报

# 2. 填 key
cp env-示例.txt .env
vim .env                        # 选 LLM_PROVIDER，填对应的 key
source .env

# 3. 先验连通性（只调一次，几乎不花钱）

# 4. 真跑
python3 run_eval.py
python3 run_eval.py --case 1     # 只跑一条，边调 prompt 边看
```

**key 一律进 `.env`，`.env` 已在 `.gitignore` 里。**
不要写成 `LLM_API_KEY=sk-xxx python3 run_eval.py` —— 命令行参数在 `ps`
里对这台机器上任何用户可见，也会进 shell history。用 `source .env`。

## 换供应商

所有供应商都走 OpenAI 兼容格式，换一家只改 `LLM_PROVIDER` 一个值。

| provider | 用途 | 数据出境 | 能上生产 |
|---|---|---|---|
| `bailian` | 阿里云百炼，**产品目标供应商**（D8） | 否 | ✅ |
| `deepseek` | DeepSeek 官方，极便宜 | 否 | ✅ |
| `ollama` | 本地，不花钱不联网，质量差 | 否 | ❌ |

百炼新用户每个模型送 100 万 token，**不用实名、不用绑卡**。
注意国内版免费额度**只在华北2（北京）地域**。

## 文件

| 文件 | 干什么 |
|---|---|
| `jd.py` | JD 原文 → 一条条要求。**确定性，不用模型** |
| `verdict.py` | 逐条状态 → 分数和结论。**规则算，不让模型给分** |
| `llm.py` | 多供应商 OpenAI 兼容客户端，标准库 urllib，无 SDK |
| `validate.py` | 三条机械不变量校验 |
| `test_validate.py` | 校验器的反向测试。**不花钱，改 validate.py 后必跑** |
| `run_eval.py` | eval runner，输出红绿灯 |
| `probe_models.py` | 探针一：哪些模型能调（结论已被 probe_nothink 修正，见该文件说明） |
| `probe_nothink.py` | 探针二：能不能关掉思维链 |
| `pick_jds.py` | 从 jobs.db 取真实 JD 存成 fixtures |

## 三个设计决定

### 1. 条数在调模型之前算出来

`jd.py` 先把 JD 切成 N 条，把 N 作为**外部真值**注入 prompt，再校验输出是否正好 N 项。

如果让模型自己报条数，「覆盖」这条不变量是自证的、等于没有——模型把两条合并、同时报 `count=4`，校验照样通过。

分条规则是按 `jobs.db` 里 44133 条真实 requirement 统计出来的：99.6% 用换行分条，序号前缀有 `1、`/`1.`/`-`/`•` 几种。在 300 条随机真实 JD 上测过：中位数 5 条，异常率 0.7%。

### 2. 分数由规则算，模型只做逐条判定

模型很擅长判「这条满足吗」，很不擅长给跨样本可比的 0-100 分——同一份简历问两次能差 15 分，而且分数常和它自己的逐条判定矛盾（逐条全 matched，总分给 72）。

一个看起来权威、实际不可比的数字比没有数字更糟，用户会拿它做决定。

所以 `verdict.py` 从状态算分：matched 1.0 / unknown 0.5 / gap 0，再按 severity 扣分（blocking -18、major -6）。硬门槛优先于分数——两个以上 blocking 直接 mismatch，分再高也不行。

`run_eval.py` 会同时打印模型自报的 verdict 和规则推导的，**不一致是正常的**，我们用规则那个。实测 6 条里 2 条不一致，这个不一致率本身就是个有用信号。

### 3. 校验层不是加固，是必须有

兼容接口的 `response_format` 只接受 `json_object`，**不支持 `json_schema`**。所以 output schema 只能写在 prompt 里靠模型遵循——没有校验层，模型跑偏你根本不知道。

三条不变量，全部机械可判、不需要人：

1. **覆盖** — 输出条数 == 我们算出的 JD 条数
2. **requirement 逐字** — 每条逐字取自 JD 原文（顺序也校验）
3. **evidence 逐字** — 每条 matched 的 quote 逐字出现在简历里

两个坑已处理：

- pypdf layout 模式会在列间插大段空格，NFKC 也会改写字符。所以逐字比对必须在「NFKC + 压掉空白」之后做，否则合法引用会被误判成幻觉。
- 顺序检查只在逐字通过后才执行。否则一个根因报两条错（逐字挂的那项必然也 != 期望位置），真正的顺序问题会被噪音淹掉。

**校验器有反向测试**（`test_validate.py`，13 个 case）。不会失败的校验器等于没有。改 `validate.py` 一定要重跑。

## 踩过的坑

### prompt 里的编号不能写成行内前缀

原来 `build_user_msg` 把 JD 编号成 `1. xxx` 给模型看，同时要求「requirement 逐字照抄」——没说编号算不算原文的一部分。**6 条里 5 条模型自己剥掉了编号，1 条没剥**，逐字校验直接挂。

契约有歧义就会被随机违反，这比稳定违反更难查。改成 `<req id="1">文本</req>`，编号进属性、跑到要照抄的文本之外，就没东西可抄错了。

修的是歧义本身，不是放松校验器去容忍编号前缀——逐字这条是承重的，一松就没用了。

### 百炼：messages 必须出现 "json" 这个词

用 `json_object` 时 messages 里必须有 `json` 字面词，否则服务端 400 直接拒：
`'messages' must contain the word 'json' in some form`。见 `llm.py` 的 `_ensure_json_hint`。


`GET /v1/models` 列了 41 个模型，实际能调的是子集，没绑渠道的返回 403
「未配置可用路由」。实测能通：`deepseek-v4-pro`、`deepseek-v4-flash`、
`glm-5.3-flash`。实测不通：`claude-*`、`qwen3.7-*`。别照着列表猜，

### 思维链必须显式关掉（已解决，D11）

网关上能调的模型全是**自适应推理**——简单问题几十 token，真实的简历×JD 任务
飙到 4000-7000 out token。同模型 `deepseek-v4-pro`、同 6 条 case 实测：

| | 耗时 | out token | 不变量 |
|---|---|---|---|
| 思维链开 | 63.6-135.9s（中位 100s） | 32701 | 6/6 |
| 思维链关 | **5.8-6.7s** | **2184** | 6/6 |

**14-20 倍加速，token 降 15 倍，判定质量还变好了**（`unknown` 从 15/25 降到
8/25——开思维链时模型越想越犹豫、往 `unknown` 躲）。

`llm.py` 的 `_NO_THINK` 默认开启关闭，要开思维链得显式 `LLM_THINKING=1`。

**⚠️ 两个坑**：

1. 开关名各家不统一，且**不认识的参数会被静默忽略、照样返回 200**。加新供应商
   必须用 `probe_nothink.py` 实测 out token 有没有真降，**不能看有没有报错**。
2. **只看 token 下降会把破输出当成优化。** `glm-5.3-flash` 是反例：没有任何开关
   能干净关掉它的思维链，看起来压低了 token 的那两个（`chat_template_kwargs` /
   `extra_body`）其实是把 JSON 弄坏截断了，条数变 None。所以 `probe_nothink.py`
   必须同时报**解析出的条数**，不能只报 token。

deepseek 系三个等效开关实测都生效：`thinking={"type":"disabled"}`、
`reasoning_effort=none`、`chat_template_kwargs`。代码里用第一个（最标准）。
`thinking.type=none` 会 HTTP 400。

### jd.py 剥序号时吃掉了小数点（已修）

`_BULLET` 原来用 `\d{1,2}[)）.、，,:：]` 匹配数字序号，不区分序号点和小数点：

```
3.5年以上工作经验    →  5年以上工作经验      ← 年限被改小
5,000万日活产品经验  →  000万日活产品经验    ← 量级被改掉
```

**这类损坏三条不变量抓不到**——JD 侧和模型输出侧用的是同一份被改坏的文本，
两边逐字一致、校验通过，错的是源头。这是「校验只能保证两边一致，不能保证
源头正确」的典型。

判据：真序号的分隔符后面跟文字（`1.本科及以上`），小数点和千分位后面跟数字
（`3.5年`、`5,000万`）。所以对 `.` `，` `,` 加 `(?!\d)`。`、` `:` `)` 不会
出现在数字内部，无需设限。

见 `test_jd.py`。**改 `jd.py` 一定要重跑**，它和 `validate.py` 一样是承重的。

## 还没做

- [ ] **`run_eval.py` 根本不读 `eval.jsonl`**（最高优先）。case 在代码里硬编码成
      「一份简历 × `fixtures/jds.json` 全部 6 条」，`eval.jsonl` 里那套 `expect`
      断言（`statusIs` / `severityIs` / `verdictNot` / `orderMatchesJd` …）
      **一条都没执行过**。这不是补充——三条机械不变量对「职责描述当性格证据」
      这类错判是**盲的**（引用逐字没错，推论是编的），只能靠质量断言抓
- [ ] `eval.jsonl` 引用的 4 份 fixture 不存在：`resume-no-degree-field.txt` /
      `resume-fresh-grad-backend.txt` / `resume-backend-3yr.txt` /
      `resume-frontend-solid.txt`。得手写，**别用真实学生简历**
- [ ] 从 `serve.py` 抽 `parser/` 模块（PDF/DOCX → 结构化）。现在 fixtures 是
      `.txt`，绕过了解析层
- [ ] `whatajob-match-v3` 三维打分接进来写 `meta.ruleScore`（D7：不进 prompt）
- [ ] 调用日志落盘（D9：qa_skill 兜底率要能统计）
- [ ] `/route` 端点 + 意图识别
