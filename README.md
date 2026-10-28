# 流水 · 学生 AI 求职与留学助手

> 流水不争先，争的是滔滔不绝。

流水是给学生用的 AI 助手。在对话里说出你要做什么，比如「帮我看看简历和这个 JD 匹不匹配」「我下周三字节二面，怎么准备」，它会挑出合适的工具，把需要的信息预填成表单，你确认后再运行。结果和求职、留学进度一起存进你的工作台：投了哪些公司、申了哪些学校、走到了哪一步、下一步要做什么，都在一个地方。

## 能做什么

**对话 + 工具**
- 54 个 AI 工具，覆盖求职（18）、留学申请（12）、学习提效（13）、考试备考（11）
- 模型按需求推荐工具，并把对话里已经问到的信息预填进表单；有同类工具时可以对比着挑
- 可以上传 PDF / Word，支持联网搜索（可选）
- 结果可以导出 Word / PDF；简历类工具能只导出修改后的简历，面试题能导出带作答框的练习版
- 生成在后台进行，中途切到别的页面也不会中断，回来能接着看

**求职工作台**
- 投递看板：想投 → 已投递 → 笔试 → 一面 / 二面 / 三面 → HR 面 → offer，可以拖动改阶段
- 记录每条投递的 JD 和投递用的简历版本；用求职工具时自动带进表单
- 求职数据：各阶段转化率、在哪一轮结束、每一步平均用时、每周投递量

**留学申请工作台**
- 申请看板：选校中 → 准备材料 → 已提交 → 面试 → 录取 → 已确认入读，可标冲刺 / 主申 / 保底
- 新建申请时自动生成材料清单（PS、CV、推荐信、成绩单、语言成绩）
- 记录每所学校的项目要求和用的文书；用文书工具时自动带进表单
- 申请数据：提交数、面试数、录取率

**进度自动识别**
- 在对话里随口说「今天投了美团」「字节一面过了」「递了 UCL」「NUS 录了」，回答下方会弹出确认条，确认后写入工作台
- 只记用户自己说的、已经发生的事；每条都核对原话，「想投」「同学被录了」这类不会记
- 工作台进度会带进之后的对话，模型回答时知道你现在走到哪了

**其他**
- 邀请码注册，账号数据都存在服务端，换设备也能看到
- 积分制：运行工具扣积分，失败或中途取消自动退回
- 每日 AI 日报 + 当日日程开屏卡片，可以在卡片里取消订阅
- 社区经验帖、工具评价、收藏

## 技术栈

| 部分 | 技术 |
|---|---|
| 前端 `app/` | React 19 · TypeScript · Vite · Tailwind CSS 4 |
| 后端 `backend/` | Python 3.9 · Flask · LangGraph（Agent 对话流程）· SQLite |
| 模型 | 任意 OpenAI 兼容接口：阿里云百炼 / DeepSeek / OpenAI / 中转网关 |
| 导出 | python-docx（Word）· reportlab（PDF，内嵌中文字体） |
| 后台 demo `admin/` | Vue 3 · TypeScript · Vite（只是形态演示，没有接入线上） |

## 目录结构

```
liushui/
├── app/                     前端
│   └── src/
│       ├── pages/           首页、对话、找工具、工作台、社区、创作中心
│       ├── components/      结果卡片、表单、进度确认条、下载菜单……
│       └── lib/api.ts       所有后端接口
├── backend/                 后端
│   ├── simple_server.py     入口，所有 /api 接口
│   ├── graph/agent.py       Agent 对话流程：推荐工具、预填表单、流式输出
│   ├── skill_retrieval.py   工具目录（名称、场景、说明）
│   ├── skill_executor.py    每个工具的提示词和执行
│   ├── workspace_db.py      工作台数据：投递 / 申请、日程、待办、工具结果
│   ├── workspace_context.py 注入对话的进度快照、表单预填
│   ├── workspace_stats.py   漏斗统计
│   ├── progress.py          从对话里识别求职 / 留学进度
│   ├── turn_jobs.py         后台生成任务（离开页面不中断）
│   ├── docx_export.py       导出 Word
│   ├── pdf_export.py        导出 PDF
│   ├── auth.py  db.py       登录、邀请码、积分、对话存储
│   └── .env.example         配置模板
├── skills/                  参考和集成的开源 skill（见 skills/README.md）
├── admin/                   后台管理形态 demo
└── docs/                    决策记录、规划
```

## 本地运行

需要 Python 3.9+ 和 Node.js 20+。

**1. 后端**

```bash
cd backend
pip3 install -r requirements.txt
cp .env.example .env
```

打开 `backend/.env`，至少填好一组模型配置（百炼、DeepSeek、OpenAI 兼容接口三选一）和 `AUTH_SECRET`，每一项的说明都写在文件里。然后启动：

```bash
python3 simple_server.py
```

看到 `Running on http://127.0.0.1:5000` 就说明启动好了。这个终端窗口不要关。

**2. 前端**（另开一个终端窗口）

```bash
cd app
npm install
npm run dev
```

浏览器打开 http://127.0.0.1:5173 。前端会把 `/api` 请求转发给本机 5000 端口的后端，不用另外配置。

**3. 生成邀请码**

注册需要邀请码，在 `backend` 目录运行：

```bash
python3 manage_invites.py create --count 1 --max-uses 1 --note "自己用"
```

终端会打印出邀请码。查看已有邀请码和使用情况：

```bash
python3 manage_invites.py list
```

## 常见问题

**运行工具时报「没有支持模型 xxx 的启用渠道」**
网关上这个模型暂时不可用，换一个能用的模型。在 `backend` 目录运行 `python3 probe_models.py`，它会测出网关上哪些模型能调、速度如何；把推荐的模型名填进 `.env` 的 `OPENAI_MODEL`，然后重启后端。

**浏览器打不开 127.0.0.1:5173**
看一下 `npm run dev` 的输出：如果提示端口被占用，说明之前的前端还没关，关掉旧的再启动。后端没启动时，页面能打开，但登录和对话都用不了。

**每次重启后端都要重新登录**
`.env` 里没设 `AUTH_SECRET`，按 `.env.example` 里的说明生成一个填进去。

**想分享给别人试用**
前端和后端都启动后，再开一个终端：

```bash
cloudflared tunnel --url http://127.0.0.1:5173
```

把输出的 `https://xxx.trycloudflare.com` 地址和邀请码发给对方。这是临时地址，每次重开都会变；电脑休眠或断网时，对方就打不开了。

## 数据与隐私

以下内容只保存在本机，已被 `.gitignore` 排除，不会上传到仓库：
- `backend/.env`：模型和服务的密钥
- `backend/*.db`：用户账号、对话记录、工作台数据
- `backend/uploads_data/`：用户上传的简历等文件，默认 7 天后自动删除

发给模型之前，会先把简历里的手机号、邮箱等个人信息替换成占位符（`backend/pii.py`）。

## 致谢

`skills/` 目录收录了以下开源项目，用于参考和改写平台上的工具，版权归原作者所有。本项目不用于商业用途。

| 项目 | 来源 |
|---|---|
| ClaudeSkills | https://github.com/StefanoZaghi1987/ClaudeSkills |
| academic-research-skills | https://github.com/Imbad0202/academic-research-skills |
| agent-skills | https://github.com/maaarcooo/agent-skills |
| claude-code-skills | https://github.com/jasonbhorne/claude-code-skills |
| claude-office-skills | https://github.com/tfriedel/claude-office-skills |
| claude-skill-pdf | https://github.com/wangmhao/claude-skill-pdf |
| claude-writing-skills | https://github.com/nadiem99/claude-writing-skills |
| course-builder | https://github.com/klausners/course-builder |
| essay-skills | https://github.com/clyderankin/essay-skills |
| resume-best-practices | https://github.com/StephanieKoehl/resume-best-practices |
| resume-builder-skill | https://github.com/dabydat/resume-builder-skill |
| resume-tailoring-skill | https://github.com/varunr89/resume-tailoring-skill |
| tutor-skills | https://github.com/bevibing/tutor-skills |

另有一批工具来自黎恬整理的 skill 合集。`skills/resume-jd-match/` 是本项目自己写的 skill。
