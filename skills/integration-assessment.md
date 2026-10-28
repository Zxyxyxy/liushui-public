# Skill 集成难度评估与检索准确度测试方案

## 一、集成难度评估

### 评估维度

| 维度 | 权重 | 说明 |
|------|------|------|
| **依赖复杂度** | 30% | 外部依赖数量、安装难度 |
| **代码结构** | 25% | 是否有标准 SKILL.md、文档完整性 |
| **功能匹配度** | 25% | 与前台工具的契合程度 |
| **维护成本** | 20% | 代码质量、是否持续更新 |

### 详细评估结果

#### P0 优先级（立即集成）

##### 1. claude-office-skills ⭐⭐⭐⭐☆（8/10）

**功能匹配度**: ⭐⭐⭐⭐⭐
- 直接对应 3 个高频工具：`ppt-outline` (48k用户)、`excel-formula` (41k用户)、`excel-build` (27k用户)

**依赖复杂度**: ⭐⭐⭐☆☆
```bash
# Python 依赖
python-pptx, openpyxl, python-docx, pypdf2

# Node.js 依赖  
puppeteer, html2pptx

# 系统工具
LibreOffice (soffice)
Poppler (pdftoppm)
Pandoc
```

**代码结构**: ⭐⭐⭐⭐☆
- ✓ 完整的 README.md
- ✗ 无 SKILL.md（需要自己封装）
- ✓ 脚本化 API，易于集成

**集成建议**:
```javascript
// 推荐集成方式：独立微服务
// POST /api/tools/ppt-outline
{
  "topic": "数字人民币对零售支付的影响",
  "minutes": 10,
  "material": "base64_encoded_file"
}
```

**预估工时**: 3-5 人天
- 环境配置: 1 天
- API 封装: 2 天
- 测试验证: 1-2 天

---

##### 2. resume-builder-skill ⭐⭐⭐⭐⭐（9/10）

**功能匹配度**: ⭐⭐⭐⭐⭐
- 对应 `resume-fix` (76k用户)、`jd-match` (58k用户)

**依赖复杂度**: ⭐⭐⭐⭐⭐
```bash
# 纯 LLM 驱动，无外部依赖
仅需 Claude API
```

**代码结构**: ⭐⭐⭐⭐☆
- ✓ 有详细的 README
- ✗ 无标准 SKILL.md
- ✓ 清晰的 prompt 模板

**集成建议**:
```javascript
// 最简单集成方式：提取 prompt 模板
const resumeFixPrompt = `
按照哈佛 Career Services 标准和 r/EngineeringResumes 最佳实践...
[从 skill 中提取的完整 prompt]
`;

// 直接调用 Claude API
const result = await claude.messages.create({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: resumeFixPrompt }]
});
```

**预估工时**: 2-3 人天
- Prompt 提取与优化: 1 天
- API 集成: 1 天
- 测试调优: 1 天

---

##### 3. tutor-skills ⭐⭐⭐☆☆（7/10）

**功能匹配度**: ⭐⭐⭐⭐☆
- 对应 `pdf-digest` (52k用户)、`note-tidy` (23k用户)

**依赖复杂度**: ⭐⭐⭐☆☆
```bash
# 需要 Obsidian 生态
- 输出格式为 Obsidian vault
- 需要文件系统操作
- PDF 解析依赖
```

**代码结构**: ⭐⭐⭐⭐☆
- ✓ 完整文档
- ✗ 无 SKILL.md
- ✓ 清晰的分阶段流程

**集成建议**:
```javascript
// 改造方向：提取核心逻辑，输出 JSON 而非 Obsidian vault
// 1. 保留 PDF 解析逻辑
// 2. 保留知识点提取逻辑
// 3. 改变输出格式为前端友好的 JSON
{
  "summary": "...",
  "keyPoints": [...],
  "concepts": [...],
  "questions": [...]
}
```

**预估工时**: 4-6 人天
- 核心逻辑提取: 2 天
- 格式转换: 1 天
- PDF 解析调试: 1-2 天
- 测试: 1 天

---

#### P1 优先级（近期集成）

##### 4. claude-skill-pdf ⭐⭐⭐⭐☆（8/10）

**功能匹配度**: ⭐⭐⭐⭐☆
- 对应文档导出功能、`pdf-digest` 增强

**依赖复杂度**: ⭐⭐⭐☆☆
```bash
# 依赖
pandoc
weasyprint (Python)
# 可选：LaTeX（for 高级排版）
```

**代码结构**: ⭐⭐⭐⭐⭐
- ✓ 有标准 SKILL.md
- ✓ 多模板支持
- ✓ CJK 中文支持

**集成建议**: 用于生成最终交付物（PDF 简历、文书、报告）

**预估工时**: 3-4 人天

---

##### 5. essay-skills ⭐⭐⭐⭐☆（8/10）

**功能匹配度**: ⭐⭐⭐⭐⭐
- 对应 `ps-draft`、`ps-diagnose`、`en-polish`

**依赖复杂度**: ⭐⭐⭐⭐⭐
```bash
# 纯 LLM，无外部依赖
```

**代码结构**: ⭐⭐⭐☆☆
- ✓ 完整 README
- ✗ 无 SKILL.md
- ✓ 结构化写作流程

**集成建议**: 提取 prompt 模板，类似 resume-builder-skill

**预估工时**: 2-3 人天

---

#### P2 优先级（按需集成）

其他 skill 评分：
- **claude-writing-skills**: 7/10（需要 Obsidian + Readwise 集成）
- **course-builder**: 6/10（需要网页爬取能力）
- **academic-research-skills**: 7/10（需要文献数据库）
- **agent-skills**: 6/10（功能分散）
- **ClaudeSkills**: 7/10（文档生成器，通用性强）

---

### 集成难度总结

| 难度等级 | Skill | 预估工时 | 主要障碍 |
|---------|-------|---------|---------|
| **低** ⭐⭐⭐⭐⭐ | resume-builder-skill | 2-3天 | 无 |
| **低** ⭐⭐⭐⭐⭐ | essay-skills | 2-3天 | 无 |
| **中** ⭐⭐⭐☆☆ | claude-office-skills | 3-5天 | 系统依赖多 |
| **中** ⭐⭐⭐☆☆ | claude-skill-pdf | 3-4天 | pandoc/weasyprint |
| **中** ⭐⭐⭐☆☆ | tutor-skills | 4-6天 | 格式转换 |
| **高** ⭐⭐☆☆☆ | course-builder | 5-7天 | 需要爬虫 |
| **高** ⭐⭐☆☆☆ | claude-writing-skills | 5-7天 | Obsidian 集成 |

**快速交付路径**（2周内）：
1. Week 1: resume-builder-skill + essay-skills（4-6天）
2. Week 2: claude-office-skills（3-5天）+ 测试联调（2天）

---

## 二、检索准确度测试方案

### 目标
验证用户 query → skill 匹配的准确率，评估不同模型的成本与性价比。

### 测试方法：RAG + Embedding + Rerank

#### 方案架构

```
用户查询 (query)
    ↓
[1] Embedding 模型
    ↓
向量检索 Top-K (k=10)
    ↓
[2] Rerank 模型（可选）
    ↓
最终推荐 Top-3
    ↓
评估准确率
```

---

### 第一步：构建测试数据集

#### 数据集结构

```json
{
  "test_cases": [
    {
      "query": "我要做一个关于人工智能的课程汇报PPT",
      "intent": "学习提效",
      "ground_truth": ["ppt-outline", "ppt-review", "report-script"],
      "difficulty": "easy"
    },
    {
      "query": "帮我把简历改得更适合这个产品经理岗位",
      "intent": "求职实习",
      "ground_truth": ["resume-fix", "jd-match"],
      "difficulty": "easy"
    },
    {
      "query": "这个Excel公式我看不懂是什么意思",
      "intent": "学习提效",
      "ground_truth": ["excel-formula"],
      "difficulty": "easy"
    },
    {
      "query": "需要准备申请英国研究生的文书材料",
      "intent": "留学申请",
      "ground_truth": ["ps-draft", "ps-diagnose", "doc-checklist"],
      "difficulty": "medium"
    },
    {
      "query": "马上要面试了有点紧张想练练",
      "intent": "求职实习",
      "ground_truth": ["mock-interview", "interview-q", "self-intro"],
      "difficulty": "hard"
    }
  ]
}
```

**测试集规模建议**：
- Easy（明确意图）: 30 条
- Medium（多工具候选）: 20 条
- Hard（模糊意图）: 10 条
- **总计**: 60 条

---

### 第二步：Embedding 模型选型

#### 候选模型对比

| 模型 | 中文能力 | 维度 | 价格（1M tokens） | API |
|------|---------|------|------------------|-----|
| **OpenAI text-embedding-3-large** | ⭐⭐⭐⭐☆ | 3072 | $0.13 | 官方 |
| **OpenAI text-embedding-3-small** | ⭐⭐⭐⭐☆ | 1536 | $0.02 | 官方 |
| **Cohere embed-multilingual-v3.0** | ⭐⭐⭐⭐⭐ | 1024 | $0.10 | 官方 |
| **bge-large-zh-v1.5** | ⭐⭐⭐⭐⭐ | 1024 | 免费（自托管） | HuggingFace |
| **bge-m3** | ⭐⭐⭐⭐⭐ | 1024 | 免费（自托管） | HuggingFace |
| **jina-embeddings-v3** | ⭐⭐⭐⭐☆ | 1024 | $0.02 | 官方 |

**推荐组合**：
- **生产环境**: OpenAI text-embedding-3-small（性价比高）
- **预算充足**: Cohere embed-multilingual-v3.0（中文最强）
- **无预算**: bge-large-zh-v1.5 本地部署

---

### 第三步：Rerank 模型选型（可选）

用于二次排序，提升 Top-3 准确率。

| 模型 | 中文能力 | 价格（1M tokens） | API |
|------|---------|------------------|-----|
| **Cohere rerank-multilingual-v3.0** | ⭐⭐⭐⭐⭐ | $2.00 | 官方 |
| **jina-reranker-v2-base-multilingual** | ⭐⭐⭐⭐☆ | $0.08 | 官方 |
| **bge-reranker-v2-m3** | ⭐⭐⭐⭐⭐ | 免费（自托管） | HuggingFace |

**建议**：
- 先用纯 Embedding 测试基线准确率
- 如果 Top-3 准确率 < 85%，再引入 Rerank

---

### 第四步：实现检索系统

#### 技术栈

```javascript
// 向量数据库选型
const vectorDBOptions = [
  "Pinecone",        // 托管，开箱即用，$70/月
  "Qdrant",          // 开源，自托管，免费
  "Chroma",          // 轻量，本地开发，免费
  "Milvus",          // 企业级，性能强，自托管
];

// 推荐：开发用 Chroma，生产用 Qdrant
```

#### 代码实现示例

```javascript
// 1. 建立索引
import { ChromaClient } from 'chromadb';
import { OpenAI } from 'openai';

const chroma = new ChromaClient();
const openai = new OpenAI();

// 创建 collection
const collection = await chroma.createCollection({
  name: "liushui_skills",
  metadata: { "hnsw:space": "cosine" }
});

// 添加所有 skill 的描述
const skills = [
  {
    id: "ppt-outline",
    name: "PPT 大纲生成",
    description: "把一个题目变成可以直接开做的分页大纲，含每页要点和讲述逻辑",
    tags: ["PPT", "课程汇报", "结构化"],
    scene: "study"
  },
  // ... 其他 30 个工具
];

for (const skill of skills) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: `${skill.name}：${skill.description}。标签：${skill.tags.join(', ')}`
  });
  
  await collection.add({
    ids: [skill.id],
    embeddings: [embedding.data[0].embedding],
    metadatas: [skill]
  });
}

// 2. 检索
async function searchSkills(query, topK = 10) {
  const queryEmbedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query
  });
  
  const results = await collection.query({
    queryEmbeddings: [queryEmbedding.data[0].embedding],
    nResults: topK
  });
  
  return results;
}

// 3. 评估
function evaluate(query, groundTruth, predictions) {
  const top1Hit = predictions[0] === groundTruth[0] ? 1 : 0;
  const top3Hit = predictions.slice(0, 3).some(p => groundTruth.includes(p)) ? 1 : 0;
  const mrr = groundTruth.map(gt => {
    const rank = predictions.indexOf(gt) + 1;
    return rank > 0 ? 1 / rank : 0;
  }).reduce((a, b) => a + b, 0) / groundTruth.length;
  
  return { top1Hit, top3Hit, mrr };
}
```

---

### 第五步：评估指标

#### 核心指标

| 指标 | 定义 | 目标值 |
|------|------|--------|
| **Precision@1** | Top-1 命中率 | ≥ 70% |
| **Recall@3** | Top-3 召回率 | ≥ 90% |
| **MRR** | Mean Reciprocal Rank | ≥ 0.75 |
| **平均延迟** | 单次检索耗时 | ≤ 200ms |

#### 成本估算

基于 1 万次日均查询：

| 模型方案 | 月成本 | Precision@1 预估 | 性价比 |
|---------|--------|-----------------|--------|
| **OpenAI 3-small** | $6 | 75-80% | ⭐⭐⭐⭐⭐ |
| **OpenAI 3-large** | $39 | 78-82% | ⭐⭐⭐☆☆ |
| **Cohere embed + rerank** | $30 + $60 = $90 | 82-88% | ⭐⭐⭐⭐☆ |
| **bge-large-zh-v1.5 本地** | 服务器 $50/月 | 76-81% | ⭐⭐⭐⭐⭐ |

**推荐方案**：
- **MVP 阶段**: OpenAI text-embedding-3-small（成本低，效果好）
- **规模化后**: bge-large-zh-v1.5 本地部署（成本可控）
- **追求极致**: Cohere + Rerank（准确率最高）

---

### 第六步：实施计划

#### Week 1: 数据准备
- [ ] 构建 60 条测试数据集
- [ ] 标注 ground truth
- [ ] 准备 skill 描述库（30个工具）

#### Week 2: 基线测试
- [ ] 集成 OpenAI text-embedding-3-small
- [ ] 实现检索逻辑
- [ ] 跑通 60 条测试
- [ ] 计算 Precision@1、Recall@3、MRR

#### Week 3: 优化迭代
- [ ] 如果 P@1 < 70%，尝试：
  - 调整 skill 描述（增加关键词）
  - 增加用户 query 改写
  - 引入 Rerank 模型
- [ ] 如果 R@3 < 90%，扩展检索范围到 Top-20

#### Week 4: 上线与监控
- [ ] 部署到测试环境
- [ ] A/B 测试（真实用户）
- [ ] 收集 bad case 持续优化

---

### 第七步：持续优化策略

#### 用户反馈闭环

```javascript
// 记录用户行为
{
  "query": "我要做PPT",
  "recommendations": ["ppt-outline", "report-script", "ppt-review"],
  "userClicked": "ppt-outline",  // 正样本
  "userIgnored": ["report-script", "ppt-review"]  // 负样本
}

// 定期用真实点击数据微调 embedding
```

#### Bad Case 分析

| 类型 | 示例 | 解决方案 |
|------|------|---------|
| **多义词** | "润色"（英文/中文） | Query 改写 + 上下文检测 |
| **俚语** | "攒简历"、"整PPT" | 同义词扩展 |
| **长尾 query** | "明天面试腾讯产品..." | 提取关键意图 |

---

## 三、最终建议

### 集成优先级

**Phase 1（1个月）**：
1. resume-builder-skill（2-3天）
2. essay-skills（2-3天）
3. claude-office-skills（3-5天）
4. 检索系统 MVP（2周）

**Phase 2（2个月）**：
5. tutor-skills（4-6天）
6. claude-skill-pdf（3-4天）
7. 检索系统优化（持续）

### 技术选型建议

| 模块 | 推荐方案 | 理由 |
|------|---------|------|
| **Embedding** | OpenAI text-embedding-3-small | 性价比最高 |
| **向量DB** | Qdrant（自托管）或 Pinecone（托管） | 开源 or 省心 |
| **Rerank** | 初期不用，P@1 < 70% 再加 | 成本优先 |
| **后端** | Node.js + Python（混合） | 已有技术栈 |

### 成本预估（月均）

- Embedding API: $6-10
- 向量数据库: $0-70（自托管 vs 托管）
- Claude API（skill 执行）: $200-500（取决于用量）
- **总计**: $206-580/月（1万日活）

---

生成时间：2026-09-21
