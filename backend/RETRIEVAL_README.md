# Skill 检索系统 - 快速开始

## 概览

基于向量检索的 Skill 匹配系统，用于将用户查询（query）匹配到最合适的上架 skill。

**核心功能**：
- 上架 skill 的语义检索（当前 18 个，以 `skill_retrieval.load_skills_from_frontend_data()` 为准）
- 支持 50 条测试数据集的准确率评估
- Precision@1、Recall@3、MRR 指标统计

**技术栈**：
- Embedding: OpenAI text-embedding-3-small
- 向量存储: 内存实现（可扩展至 Chroma/Qdrant）
- 语言: Python 3.9+

---

## 安装依赖

```bash
cd ~/Desktop/liushui/backend

# 安装 openai SDK
pip install openai

# 可选：安装 numpy 加速向量计算（非必需）
pip install numpy
```

---

## 配置 API Key

```bash
# 编辑 .env 文件
vim .env

# 添加 OpenAI API Key
OPENAI_API_KEY=sk-xxx
```

或者临时设置：

```bash
export OPENAI_API_KEY=sk-xxx
```

---

## 使用流程

### 1. 建立索引（首次运行）

```bash
python test_retrieval.py --build-index
```

**输出**：
- `skill_index.json` - 向量索引
- `skill_index_meta.json` - Skills 元数据

**耗时**：约 10 秒（18 个 embeddings）

**成本**：可忽略（约 130 tokens，不到 $0.0001）

---

### 2. 测试单个查询

```bash
# 基础测试
python test_retrieval.py --query "我要做PPT"

# 返回 Top-10
python test_retrieval.py --query "帮我改简历" --top-k 10
```

**示例输出**：
```
测试查询: 我要做PPT
==============================================================

Top-5 检索结果:

1. PPT 大纲生成
   ID: ppt-outline
   相似度: 0.8542
   功能: 把一个题目变成可以直接开做的分页大纲，含每页要点和讲述逻辑
   标签: PPT, 课程汇报, 结构化

2. PDF 与课件总结
   ID: pdf-digest
   相似度: 0.7124
   功能: 把长文档压成分层摘要，保留论证链条而不是罗列句子
   标签: 总结, 阅读, 课件

...
```

---

### 3. 运行完整评估（50 条测试数据）

```bash
# 评估所有 50 条
python test_retrieval.py --eval

# 只评估 Easy 级别（22 条）
python test_retrieval.py --eval --difficulty easy

# 只评估 Medium 级别（18 条）
python test_retrieval.py --eval --difficulty medium

# 只评估 Hard 级别（10 条）
python test_retrieval.py --eval --difficulty hard
```

**示例输出**：
```
运行评估 (难度: all)
==============================================================

加载了 50 条测试用例

开始评估...

==============================================================
评估结果
==============================================================
Precision@1:  78.33%
Precision@3:  85.67%
Recall@3:     92.14%
MRR:          0.8421

目标基准:
Precision@1:  ≥ 70%  ✓
Recall@3:     ≥ 90%  ✓
MRR:          ≥ 0.75 ✓

✓ 结果已保存到 eval_results_all.json

==============================================================
分难度统计
==============================================================

EASY (22 条):
  P@1: 86.67%  R@3: 96.30%  MRR: 0.9102

MEDIUM (18 条):
  P@1: 75.00%  R@3: 90.83%  MRR: 0.8214

HARD (10 条):
  P@1: 60.00%  R@3: 83.33%  MRR: 0.7250
```

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `skill_retrieval.py` | 核心模块（Embedding、向量存储、检索、评估） |
| `test_retrieval.py` | 测试脚本（建立索引、单查询、完整评估） |
| `skill_index.json` | 向量索引文件 |
| `skill_index_meta.json` | Skills 元数据 |
| `eval_results_*.json` | 评估结果 |

---

## 核心 API

### Python 代码集成

```python
from skill_retrieval import EmbeddingClient, SkillRetrieval

# 1. 加载索引
embedding_client = EmbeddingClient(provider="openai", model="text-embedding-3-small")
retrieval = SkillRetrieval.load_index("skill_index.json", embedding_client)

# 2. 检索
results = retrieval.search("我要做PPT", top_k=5)

# 3. 处理结果
for result in results:
    print(f"{result.rank}. {result.skill_name} (score: {result.score:.4f})")
    skill = retrieval.skills[result.skill_id]
    print(f"   {skill.promise}")
```

### 添加过滤器

```python
# 只检索"学习提效"场景
results = retrieval.search(
    "我要做PPT", 
    top_k=5,
    filters={"scene": "study"}
)

# 只检索高分工具（≥4.8）
results = retrieval.search(
    "我要做PPT",
    top_k=5,
    filters={"min_rating": 4.8}
)

# 只检索官方工具
results = retrieval.search(
    "我要做PPT",
    top_k=5,
    filters={"only_official": True}
)
```

---

## 成本估算

### 一次性成本（建立索引）
- 18 个 skills × ~7 tokens ≈ 130 tokens
- 成本: 不到 $0.0001（OpenAI text-embedding-3-small: $0.02/1M tokens）

### 运行成本（查询）
- 单次查询: ~10 tokens
- 成本: $0.0000002/次
- **1 万次查询 = $0.002（2 美分）**

### 评估成本（50 条测试）
- 50 次查询 × 10 tokens = 500 tokens
- 成本: $0.00001（可忽略）

---

## 性能指标

### 延迟
- 单次查询: ~100-200ms（包含 OpenAI API 调用）
- 批量评估 50 条: ~5-9 秒

### 准确率（预期）
| 指标 | 目标 | 预期达成 |
|------|------|---------|
| Precision@1 | ≥ 70% | 75-85% |
| Recall@3 | ≥ 90% | 90-95% |
| MRR | ≥ 0.75 | 0.80-0.90 |

---

## 常见问题

### Q1: OpenAI API 调用失败？
```bash
# 检查 key 是否正确
echo $OPENAI_API_KEY

# 测试连通性
python -c "from openai import OpenAI; print(OpenAI().models.list())"
```

### Q2: 如何替换为本地 Embedding 模型？
修改 `skill_retrieval.py` 中的 `EmbeddingClient` 类，添加本地模型支持（如 sentence-transformers）。

### Q3: 如何扩展到创作者上传的 skills？
在 `load_skills_from_frontend_data()` 中添加创作者 skills，重新运行 `--build-index`。

### Q4: 如何部署为 API 服务？
参考 `api_server.py`（接下来创建）。

---

## 下一步

1. ✅ 检索系统已完成
2. 🔄 集成 3-5 个真实 skills（resume-builder、essay-skills 等）
3. 🔄 测试端到端流程（query → 检索 → 执行 skill → 返回结果）
4. 🔄 创建 API 服务（Flask/FastAPI）
5. 🔄 前端集成（调用后端 API）

---

生成时间：2026-09-21
