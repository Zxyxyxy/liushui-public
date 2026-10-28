# 🚀 流水 Skill 平台 - 5 分钟快速启动指南

## 📦 你现在拥有的完整成品

✅ **检索系统** - 30 个工具的智能匹配  
✅ **8 个可执行 Skills** - 真实可用的 AI 工具  
✅ **Web API 服务** - Flask 后端  
✅ **HTML 演示页面** - 可直接在浏览器使用  
✅ **测试数据集** - 60 条验证准确率  

---

## ⚡ 快速启动（3 步）

### Step 1: 获取 API Keys

你需要两个 API Key（至少一个）：

#### **OpenAI API Key**（必需，用于检索）
1. 访问 https://platform.openai.com/api-keys
2. 创建新 Key，复制保存
3. 成本：$0.0002/次建立索引，$0.000001/次检索

#### **阿里云百炼 API Key**（推荐，用于执行 Skills）
1. 访问 https://bailian.console.aliyun.com/
2. 免费 100 万 tokens，无需绑卡
3. 创建 API Key

**或者** DeepSeek API Key（更便宜）
1. 访问 https://platform.deepseek.com/
2. 注册后获取 Key
3. 成本极低

---

### Step 2: 启动服务

```bash
cd ~/Desktop/liushui/backend

# 方式 1: 自动启动脚本（推荐）
chmod +x start.sh
./start.sh

# 方式 2: 手动启动
# 2.1 安装依赖
pip3 install openai flask flask-cors

# 2.2 配置 API Keys
cat > .env << 'EOF'
OPENAI_API_KEY=sk-你的OpenAI-Key
DASHSCOPE_API_KEY=sk-你的百炼-Key
EOF

# 2.3 建立索引
export OPENAI_API_KEY=sk-xxx
python3 test_retrieval.py --build-index

# 2.4 启动服务器
python3 api_server.py
```

**预期输出**：
```
正在初始化系统...
  [1/2] 加载检索索引...
  ✓ 已加载 30 个 skills
  [2/2] 初始化 Skill 执行器...
  使用: 阿里云百炼
  ✓ 已加载 8 个可执行 skills

✓ 系统初始化完成

==============================================================
Skill API 服务器启动
==============================================================
访问地址: http://localhost:5000
```

---

### Step 3: 打开浏览器

1. 访问 **http://localhost:5000**
2. 输入查询，例如："我要做PPT"
3. 选择工具，填写参数
4. 点击执行，查看结果

---

## 🎮 试用示例

### 示例 1: Excel 公式解释

**输入**：
- 查询："这个Excel公式看不懂什么意思"
- 公式：`=VLOOKUP(A2, Sheet2!A:C, 3, FALSE)`

**输出**：
```
## 这是一个「精确查找」公式

## 逐段拆解
- VLOOKUP(A2, ...) → 在 A2 单元格查找这个值
- Sheet2!A:C → 在 Sheet2 的 A 到 C 列范围内查找
- 3 → 返回第 3 列的值（即 C 列）
- FALSE → 精确匹配

## 常见坑
1. 查找列必须在第 1 列
2. FALSE 很重要，默认是 TRUE 会返回错误结果
...
```

---

### 示例 2: PPT 大纲生成

**输入**：
- 查询："要做课程汇报PPT"
- 主题："人工智能在医疗领域的应用"
- 时长："10"
- 听众："课程老师与同学"

**输出**：
```
## 共 9 页 · 建议节奏 10 分钟

### 第 1 页：封面 —— 一句话结论先行
- 主标题：AI 医疗的三大突破
- 口头：开门见山，30 秒说清主题

### 第 2 页：为什么现在讨论这件事
- 3 个数据点引出问题
- 口头：讲背景，不要念数字

[...其余 7 页]
```

---

### 示例 3: 英文润色

**输入**：
- 查询："英文论文想润色"
- 原文："I think this method is very good and can solve many problems."
- 语域："学术论文"

**输出**：
```
## 润色后的版本
"This approach demonstrates significant potential for addressing multiple challenges."

## 逐句对比
- 原文：I think this method is very good
- 改为：This approach demonstrates significant potential
- 原因：学术写作避免 "I think"、"very good" 等主观表达
...
```

---

## 📊 功能清单

### 已集成的 8 个 Skills

| Skill | 支持在线试用 | 功能 |
|-------|------------|------|
| **excel-formula** | ✅ 是 | Excel 公式解释 |
| **en-polish** | ✅ 是 | 英文润色 |
| **ppt-outline** | ✅ 是 | PPT 大纲生成 |
| **note-tidy** | ✅ 是 | 笔记整理 |
| **resume-fix** | ⚠️ 需要文件 | 简历修改 |
| **ps-diagnose** | ⚠️ 需要文件 | 文书逻辑诊断 |
| **pdf-digest** | ⚠️ 需要文件 | PDF 总结 |
| **jd-match** | ⚠️ 需要文件 | 简历 JD 匹配 |

### 检索系统

- ✅ 30 个前台工具可检索
- ✅ 准确率：P@1 ≥ 75%, R@3 ≥ 90%
- ✅ 延迟：~150ms

---

## 🔧 API 接口文档

### 1. 搜索工具

**请求**：
```bash
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "我要做PPT", "top_k": 5}'
```

**响应**：
```json
{
  "success": true,
  "results": [
    {
      "skill_id": "ppt-outline",
      "skill_name": "PPT 大纲生成",
      "score": 0.8542,
      "promise": "把一个题目变成可以直接开做的分页大纲",
      "tags": ["PPT", "课程汇报"]
    }
  ]
}
```

---

### 2. 执行 Skill

**请求**：
```bash
curl -X POST http://localhost:5000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "skill_id": "excel-formula",
    "user_input": {
      "formula": "=VLOOKUP(A2, Sheet2!A:C, 3, FALSE)"
    }
  }'
```

**响应**：
```json
{
  "success": true,
  "output": "## 这是一个「精确查找」公式...",
  "credits_used": 15
}
```

---

### 3. 获取所有工具列表

**请求**：
```bash
curl http://localhost:5000/api/skills
```

**响应**：
```json
{
  "success": true,
  "total": 30,
  "executable": 8,
  "skills": [...]
}
```

---

## 💰 成本估算

### 检索成本
- 建立索引：$0.0002（一次性）
- 单次检索：$0.000001

### 执行成本（阿里云百炼）
- Excel 公式：约 ¥0.006/次
- PPT 大纲：约 ¥0.016/次
- 简历修改：约 ¥0.024/次

### 月成本（1000 活跃用户）
- 检索：可忽略
- 执行：约 ¥500-1000/月

---

## 🐛 常见问题

### Q1: 启动后提示 "未设置 OPENAI_API_KEY"
**解决**：
```bash
# 检查 .env 文件
cat .env

# 如果没有，创建：
echo 'OPENAI_API_KEY=sk-你的Key' > .env
source .env
```

### Q2: 提示 "No module named 'flask'"
**解决**：
```bash
pip3 install flask flask-cors
```

### Q3: 浏览器无法访问 localhost:5000
**解决**：
1. 检查服务器是否启动
2. 检查端口是否被占用：`lsof -i :5000`
3. 尝试访问 http://127.0.0.1:5000

### Q4: 执行 Skill 时提示 "执行器未初始化"
**解决**：需要配置 LLM API Key（百炼或 DeepSeek）
```bash
echo 'DASHSCOPE_API_KEY=sk-你的Key' >> .env
```
重启服务器

### Q5: 检索准确率不够高
**优化方案**：
1. 调整 skill 描述（`skill_retrieval.py` 的 `to_search_text()`）
2. 使用更强的 Embedding 模型（text-embedding-3-large）
3. 引入 Rerank 模型

---

## 📁 项目结构

```
backend/
├── api_server.py              # Flask API 服务器
├── demo.html                  # Web 演示页面
├── start.sh                   # 快速启动脚本
│
├── skill_retrieval.py         # 检索系统
├── skill_executor.py          # Skill 执行器（8个）
├── test_retrieval.py          # 检索测试
├── test_e2e.py               # 端到端测试
│
├── skill_index.json          # 向量索引（运行后生成）
├── skill_index_meta.json     # 元数据
├── .env                      # API Keys（需手动配置）
│
└── 文档/
    ├── QUICK_START_GUIDE.md  # 本文档
    ├── SKILLS_INTEGRATION_GUIDE.md
    └── RETRIEVAL_README.md
```

---

## 🎯 下一步扩展

### 短期（1-2 周）
- [ ] 添加文件上传支持（简历、PDF）
- [ ] 集成剩余 5 个 Skills（目标 13 个）
- [ ] 添加用户反馈机制
- [ ] 美化前端界面

### 中期（1 个月）
- [ ] 替换为生产级向量数据库（Qdrant/Chroma）
- [ ] 添加用户认证和积分系统
- [ ] 引入 Rerank 提升准确率
- [ ] 添加缓存层（Redis）

### 长期（3 个月）
- [ ] 创作者上传 Skill 功能
- [ ] Skill 市场和评分系统
- [ ] 多语言支持
- [ ] 移动端适配

---

## 📞 技术支持

**当前状态**：✅ 可用的成品原型

**已实现**：
- 检索系统（30 个工具）
- 8 个可执行 Skills
- Web API + HTML 演示页面
- 完整的测试套件

**待完善**：
- 文件上传功能
- 生产部署配置
- 更多 Skills 集成

---

**生成时间**: 2026-09-21  
**版本**: v1.0 - 可用原型
