"""
Skill 检索系统 - 核心模块

功能：
1. 将上架的前台工具转换为向量并建立索引
2. 接收用户 query，返回最匹配的 Top-K skills
3. 支持多种 Embedding 模型（OpenAI/本地）
4. 评估检索准确率（Precision@K, Recall@K, MRR）

依赖：
- openai（Embedding API）
- numpy（向量计算）
- 可选：chromadb（向量数据库）
"""

import os
import json
import time
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, asdict, field

# 标准库，无需安装
import math


@dataclass
class Skill:
    """Skill 数据结构，对应前台 Tool 接口"""
    id: str
    name: str
    promise: str  # 一句话结果承诺
    scene: str    # 'study' | 'job' | 'abroad' | 'exam'
    tags: List[str]
    good_for: List[str]  # 适用场景
    needs: List[str]     # 需要用户提供什么

    # 可选字段
    credits: int = 20
    users: int = 0
    rating: float = 4.7
    is_official: bool = True
    # 开源来源信息：填了才在前端展示，不填就不显示这个区块
    source_repo: str = ""     # 开源项目名，如 "essay-skills"
    source_stars: int = 0     # GitHub star 数（真实值）
    source_origin: str = ""   # 一句话来源说明
    source_badge: str = ""    # 卡片 badge 文字，如"Harvard 标准""按时长分页"；不依赖 source_repo，没填来源也会显示
    # Agent 推荐 / 对比用。由 skill 筛选整理的同学填写，没填时 Agent 退回 good_for / promise。
    recommend_reason: str = ""                 # 一句话推荐理由
    compare_dims: Dict[str, str] = field(default_factory=dict)  # 对比维度，如 {"输出形式": "分页大纲"}
    # 同类备选：group 相同的 skill 做的是同一件事、但侧重不同，用户可以二次选择。
    # 同组里在列表中排最前的是默认（最推荐）的那个；组内只有一个时不触发选择。
    group: str = ""
    variant_label: str = ""                    # 这一版的侧重一词概括，如"量化成果"

    def to_search_text(self) -> str:
        """转换为用于 embedding 的搜索文本"""
        parts = [
            f"名称：{self.name}",
            f"功能：{self.promise}",
            f"标签：{', '.join(self.tags)}",
            f"适用场景：{', '.join(self.good_for)}" if self.good_for else "",
            f"需要：{', '.join(self.needs)}" if self.needs else "",
        ]
        return "。".join([p for p in parts if p])


@dataclass
class SearchResult:
    """检索结果"""
    skill_id: str
    skill_name: str
    score: float  # 相似度分数 [0, 1]
    rank: int     # 排名 1-based


@dataclass
class EvalMetrics:
    """评估指标"""
    precision_at_1: float
    precision_at_3: float
    recall_at_3: float
    mrr: float  # Mean Reciprocal Rank

    def to_dict(self) -> dict:
        return asdict(self)


class EmbeddingClient:
    """Embedding 客户端，支持多种后端"""

    def __init__(self, provider: str = "openai", model: str = "text-embedding-3-small"):
        """
        初始化 Embedding 客户端

        Args:
            provider: 'openai' | 'local' (可扩展)
            model: 模型名称
        """
        self.provider = provider
        self.model = model

        if provider == "openai":
            try:
                import openai
                api_key = os.getenv("OPENAI_API_KEY")
                base_url = os.getenv("OPENAI_BASE_URL")

                if base_url:
                    print(f"  使用自定义 endpoint: {base_url}")
                    self.client = openai.OpenAI(api_key=api_key, base_url=base_url)
                else:
                    self.client = openai.OpenAI(api_key=api_key)
            except ImportError:
                raise ImportError("需要安装 openai: pip install openai")
        elif provider == "local":
            # 预留本地模型接口
            raise NotImplementedError("本地 embedding 尚未实现")
        else:
            raise ValueError(f"不支持的 provider: {provider}")

    def embed(self, text: str) -> List[float]:
        """
        生成单个文本的 embedding

        Args:
            text: 输入文本

        Returns:
            embedding 向量
        """
        if self.provider == "openai":
            response = self.client.embeddings.create(
                model=self.model,
                input=text
            )
            return response.data[0].embedding
        else:
            raise NotImplementedError()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        批量生成 embeddings

        Args:
            texts: 文本列表

        Returns:
            embedding 向量列表
        """
        if self.provider == "openai":
            response = self.client.embeddings.create(
                model=self.model,
                input=texts
            )
            return [item.embedding for item in response.data]
        else:
            raise NotImplementedError()


class VectorStore:
    """
    简化版向量存储（内存实现）

    生产环境建议替换为 Chroma/Qdrant/Pinecone
    """

    def __init__(self):
        self.vectors: List[List[float]] = []
        self.metadata: List[Dict] = []
        self.ids: List[str] = []

    def add(self, id: str, vector: List[float], metadata: Dict):
        """添加向量"""
        self.ids.append(id)
        self.vectors.append(vector)
        self.metadata.append(metadata)

    def search(self, query_vector: List[float], top_k: int = 10) -> List[Tuple[str, float, Dict]]:
        """
        向量检索

        Args:
            query_vector: 查询向量
            top_k: 返回前 K 个结果

        Returns:
            [(id, score, metadata), ...]，按 score 降序排列
        """
        scores = []
        for i, vec in enumerate(self.vectors):
            score = self._cosine_similarity(query_vector, vec)
            scores.append((self.ids[i], score, self.metadata[i]))

        # 按 score 降序排序
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    @staticmethod
    def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """计算余弦相似度"""
        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot / (norm1 * norm2)

    def save(self, filepath: str):
        """保存到文件"""
        data = {
            "ids": self.ids,
            "vectors": self.vectors,
            "metadata": self.metadata,
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, filepath: str) -> "VectorStore":
        """从文件加载"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        store = cls()
        store.ids = data["ids"]
        store.vectors = data["vectors"]
        store.metadata = data["metadata"]
        return store


class SkillRetrieval:
    """Skill 检索系统主类"""

    def __init__(self, embedding_client: EmbeddingClient):
        self.embedding_client = embedding_client
        self.vector_store = VectorStore()
        self.skills: Dict[str, Skill] = {}

    def index_skills(self, skills: List[Skill], show_progress: bool = True):
        """
        为 skills 建立索引

        Args:
            skills: Skill 列表
            show_progress: 是否显示进度
        """
        if show_progress:
            print(f"正在为 {len(skills)} 个 skills 生成 embeddings...")

        # 批量生成 embeddings
        texts = [skill.to_search_text() for skill in skills]
        embeddings = self.embedding_client.embed_batch(texts)

        # 添加到向量存储
        for skill, embedding in zip(skills, embeddings):
            self.skills[skill.id] = skill
            self.vector_store.add(
                id=skill.id,
                vector=embedding,
                metadata={
                    "name": skill.name,
                    "scene": skill.scene,
                    "tags": skill.tags,
                    "is_official": skill.is_official,
                    "rating": skill.rating,
                }
            )

        if show_progress:
            print(f"✓ 索引完成，共 {len(skills)} 个 skills")

    def search(self, query: str, top_k: int = 10, filters: Optional[Dict] = None) -> List[SearchResult]:
        """
        检索匹配的 skills

        Args:
            query: 用户查询
            top_k: 返回前 K 个结果
            filters: 过滤条件，如 {"scene": "study", "min_rating": 4.5}

        Returns:
            检索结果列表
        """
        # 生成查询向量
        query_embedding = self.embedding_client.embed(query)

        # 向量检索
        raw_results = self.vector_store.search(query_embedding, top_k=top_k * 2)  # 多取一些，过滤后再截断

        # 应用过滤器
        if filters:
            filtered = []
            for skill_id, score, metadata in raw_results:
                # 场景过滤
                if "scene" in filters and metadata["scene"] != filters["scene"]:
                    continue

                # 评分过滤
                if "min_rating" in filters and metadata["rating"] < filters["min_rating"]:
                    continue

                # 仅官方
                if filters.get("only_official") and not metadata["is_official"]:
                    continue

                filtered.append((skill_id, score, metadata))

            raw_results = filtered

        # 转换为 SearchResult
        results = []
        for rank, (skill_id, score, metadata) in enumerate(raw_results[:top_k], start=1):
            results.append(SearchResult(
                skill_id=skill_id,
                skill_name=metadata["name"],
                score=score,
                rank=rank
            ))

        return results

    def evaluate(self, test_cases: List[Dict]) -> EvalMetrics:
        """
        评估检索系统准确率

        Args:
            test_cases: 测试用例列表，格式：
                [
                    {
                        "query": "我要做PPT",
                        "ground_truth": ["ppt-outline"],
                        "difficulty": "easy"
                    },
                    ...
                ]

        Returns:
            评估指标
        """
        p1_sum = 0
        p3_sum = 0
        r3_sum = 0
        mrr_sum = 0

        for case in test_cases:
            query = case["query"]
            ground_truth = set(case["ground_truth"])

            # 检索
            results = self.search(query, top_k=10)
            predictions = [r.skill_id for r in results]

            # Precision@1
            if predictions and predictions[0] in ground_truth:
                p1_sum += 1

            # Precision@3
            top3_hits = sum(1 for p in predictions[:3] if p in ground_truth)
            p3_sum += top3_hits / 3.0

            # Recall@3
            if ground_truth:
                recalled = sum(1 for p in predictions[:3] if p in ground_truth)
                r3_sum += recalled / len(ground_truth)

            # MRR
            reciprocal_rank = 0
            for rank, pred in enumerate(predictions, start=1):
                if pred in ground_truth:
                    reciprocal_rank = 1.0 / rank
                    break
            mrr_sum += reciprocal_rank

        n = len(test_cases)
        return EvalMetrics(
            precision_at_1=p1_sum / n,
            precision_at_3=p3_sum / n,
            recall_at_3=r3_sum / n,
            mrr=mrr_sum / n
        )

    def save_index(self, filepath: str):
        """保存索引到文件"""
        self.vector_store.save(filepath)

        # 保存 skills 元数据
        skills_data = {skill_id: asdict(skill) for skill_id, skill in self.skills.items()}
        meta_path = filepath.replace(".json", "_meta.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(skills_data, f, ensure_ascii=False, indent=2)

        print(f"✓ 索引已保存到 {filepath}")

    @classmethod
    def load_index(cls, filepath: str, embedding_client: EmbeddingClient) -> "SkillRetrieval":
        """从文件加载索引"""
        retrieval = cls(embedding_client)
        retrieval.vector_store = VectorStore.load(filepath)

        # 加载 skills 元数据
        meta_path = filepath.replace(".json", "_meta.json")
        with open(meta_path, "r", encoding="utf-8") as f:
            skills_data = json.load(f)

        retrieval.skills = {
            skill_id: Skill(**data) for skill_id, data in skills_data.items()
        }

        print(f"✓ 索引已从 {filepath} 加载")
        return retrieval


def load_skills_from_frontend_data(data_file: str = "../app/src/data/tools.ts") -> List[Skill]:
    """
    返回平台上架的 skill 列表（前端 /api/skills 的唯一数据源）

    只保留已接入真实 LLM 执行的 skill——每一个都在 skill_executor.py 有 prompt
    模板、在 simple_server.py 的 EXECUTABLE_FIELDS 有输入表单定义。三处 id 必须
    一致，少一处这个 skill 就会在前端变成不可执行。

    多轮对话 / 长期跟进类（模拟面试、进度管理、规划师等）需要各自的子图和会话
    状态，不是「一个模板跑一次」能覆盖的，因此暂不上架，等对应子图做完再加回来。
    """
    # 暂时硬编码，后续从 JSON 读取
    skills = [
        # 学习提效
        Skill(id="ppt-outline", name="PPT 大纲生成",
              promise="把一个题目变成可以直接开做的分页大纲，含每页要点和讲述逻辑",
              scene="study", tags=["PPT", "课程汇报", "结构化"],
              good_for=["课程期末汇报", "社团招新宣讲", "小组作业分工前的框架对齐"],
              needs=["汇报主题", "时长和听众"],
              users=100, rating=4.8,
              source_badge="按时长分页 · 附讲法",
              recommend_reason="要汇报但**还没想好怎么讲**时先用它：按时长定页数，每页给要点和口头讲法",
              compare_dims={
                  "侧重": "叙事主线和**分页节奏**（每分钟 1–1.5 页），不做视觉设计",
                  "适合": "课程汇报、宣讲、小组作业前对齐框架",
                  "输出": "逐页大纲（要点 + 配图建议 + 讲述提示）+ 页间衔接 + 时间分配",
                  "需要": "汇报主题、时长和听众，有参考资料会更贴合",
                  "注意": "给的是大纲，**不直接生成 PPT 文件**，排版需要你自己做",
              }),

        Skill(id="excel-build", name="Excel 表格生成",
              promise="描述你要的表，直接拿到带公式和格式的可用工作表",
              scene="study", tags=["Excel", "模板", "自动化"],
              good_for=["社团经费台账", "实验数据整理", "课程小组进度表"],
              needs=["你要统计什么"],
              users=100, rating=4.7,
              source_badge="公式可直接粘贴",
              recommend_reason="知道要统计什么、但**不会搭表和写公式**时用：直接给出列结构和能粘贴的公式",
              compare_dims={
                  "侧重": "表结构 + **可直接复制的公式**，附格式和数据校验建议",
                  "适合": "经费台账、实验数据、小组进度表这类从零搭表",
                  "输出": "列结构 + 公式清单（位置、写法、是否下拉）+ 示例数据 + 格式与校验建议",
                  "需要": "要统计什么、大概多少行数据",
                  "注意": "给的是**搭表方案**，不直接生成 .xlsx 文件，需要照着在 Excel 里建",
              }),

        Skill(id="excel-formula", name="Excel 公式解释",
              promise="把看不懂的公式逐段拆开讲明白，并指出潜在坑",
              scene="study", tags=["Excel", "公式", "排错"],
              good_for=["接手别人的表格", "公式报错找不到原因"],
              needs=["一条公式"],
              users=100, rating=4.9,
              source_badge="逐段拆解 · 标出坑",
              recommend_reason="接手别人的表、**公式看不懂或报错**时用：从内到外逐段拆开讲",
              compare_dims={
                  "侧重": "逐段拆解嵌套函数、讲清计算过程，并指出**兼容性和性能坑**",
                  "适合": "接手别人的表格、公式报错找不到原因",
                  "输出": "一句话功能 + 逐段拆解 + 执行流程 + 常见坑点 + 更简单的写法",
                  "需要": "一条公式（原样粘贴）",
                  "注意": "只看得到公式本身、**看不到表里的数据**，算出来对不对要你对照表格核",
              }),

        Skill(id="pdf-digest", name="PDF 与课件总结",
              promise="把长文档压成分层摘要，保留论证链条而不是罗列句子",
              scene="study", tags=["总结", "阅读", "课件"],
              good_for=["考前扫课件", "读文献前先判断要不要精读"],
              needs=["PDF 或课件文件"],
              users=100, rating=4.8,
              source_repo="tutor-skills", source_stars=0,
              source_origin="tutor-skills 开源项目，将文档转为结构化学习库，支持 PDF/课件分层摘要",
              source_badge="三档粒度",
              group="pdf-digest", variant_label="分层摘要",
              recommend_reason="面对**一份长文档**、想先抓主干再决定读多细时用：三档粒度可选",
              compare_dims={
                  "侧重": "分层摘要，**保留论证链条**而不是罗列句子",
                  "适合": "考前扫课件、读文献前判断要不要精读",
                  "输出": "文档概况 + 分层摘要（一页速览 / 分章要点 / 精读笔记）+ 核心概念 + 阅读建议",
                  "需要": "PDF 或课件文件，选一档摘要粒度",
                  "注意": "一次处理一份文档；**多份资料要合并去重**请用「资料总结」",
              }),

        Skill(id="cheatsheet", name="考前速查表",
              promise="把课程材料压缩成按考点重组的高密度速查表，定理完整、公式突出、其余能省则省",
              scene="study", tags=["考前", "速查表", "复习", "总结"],
              good_for=["期末考前一两天", "开卷考试准备小抄", "把一学期内容压成几页"],
              needs=["课程材料", "考试重点（选填）"],
              users=100, rating=4.7,
              source_repo="evan715823/cheatsheet-generator-skill", source_stars=0,
              source_origin="改写自开源项目 cheatsheet-generator-skill（MIT）的速查表内容规则",
              source_badge="按考点重组",
              group="pdf-digest", variant_label="考前速查",
              recommend_reason="**考前一两天**、要把一学期内容压成几页时选：按主题重组、考试重点给最多篇幅，定理写全、其余大胆压缩",
              compare_dims={
                  "侧重": "**极限压缩**：按考点重组，定义和定理写全，公式加粗，其余用短语和符号",
                  "适合": "期末考前、开卷考试准备资料、快速过一遍全书",
                  "输出": "按主题分节的速查表（概念、方法、分类、必背四类标记）+ 易混概念 + 材料疑点",
                  "需要": "课程材料，写上考试重点效果更好",
                  "注意": "只用材料里的内容；要**理解论证链条**请用默认版的分层摘要",
              }),

        Skill(id="note-tidy", name="课堂笔记整理",
              promise="把零散笔记重排成有层级、可复习的结构",
              scene="study", tags=["笔记", "整理", "复习"],
              good_for=["一学期笔记的期末合并", "手写笔记拍照后转文字"],
              needs=["笔记文本或图片"],
              users=100, rating=4.6,
              source_repo="tutor-skills", source_stars=0,
              source_origin="tutor-skills 开源项目，自动生成结构化学习库并支持层级笔记重排",
              source_badge="自动分层整理",
              recommend_reason="笔记**记全了但很乱**时用：只调结构、补衔接，不往里加新内容",
              compare_dims={
                  "侧重": "重排成**有层级的结构**，标出核心概念、易错点和记忆技巧",
                  "适合": "一学期笔记的期末合并、手写笔记转成文字后的整理",
                  "输出": "分主题的层级笔记 + 重点/易错/技巧标注 + 3–5 道自测题",
                  "需要": "笔记文本",
                  "注意": "**不补原笔记没有的知识点**，笔记本身的缺漏需要你对照课件补",
              }),

        Skill(id="mind-map", name="思维导图生成",
              promise="把一个主题或一堆笔记整理成层级清楚、分支均衡的思维导图，可以导出成图",
              scene="study", tags=["思维导图", "知识梳理", "复习", "头脑风暴"],
              good_for=["一章内容复习梳理", "写论文前理思路", "把一件大事拆成任务"],
              needs=["中心主题", "原始材料（选填）"],
              users=100, rating=4.7,
              source_repo="mohitagw15856/pm-claude-skills", source_stars=0,
              source_origin="改写自开源项目 pm-claude-skills 的 mind-map（MIT）：主分支互不重叠、各分支均衡、材料一项不丢",
              source_badge="可导出成图",
              recommend_reason="要把**一章内容或一堆想法**理成结构时用：先定划分原则，材料里的每一项都放进导图或列为暂存",
              compare_dims={
                  "侧重": "**结构清楚**：主分支互不重叠、深度均衡，材料一项不丢",
                  "适合": "复习梳理一章内容、写作前理思路、拆解计划",
                  "输出": "划分原则 + 缩进列表导图 + **Mermaid 代码**（可贴进飞书、Obsidian 渲染成图）+ 结构说明",
                  "需要": "中心主题，有笔记或章节内容效果更好",
                  "注意": "平台内显示为缩进列表；要看图需要把 Mermaid 代码贴到支持的工具里",
              }),

        Skill(id="en-polish", name="英文润色",
              promise="在保留原意的前提下改到地道，并解释每处为什么改",
              scene="study", tags=["英文", "润色", "学术写作"],
              good_for=["课程论文", "英文邮件", "申请材料初稿"],
              needs=["英文原文"],
              users=100, rating=4.8,
              source_repo="essay-skills", source_stars=4,
              source_origin="essay-skills 开源写作流水线，6步从初稿到润色，标注每处修改原因",
              source_badge="标注每处改动",
              group="en-polish", variant_label="地道表达",
              recommend_reason="英文**意思都对、就是不地道**时用：改完逐句说明为什么这么改",
              compare_dims={
                  "侧重": "按语域（论文 / 邮件 / 日常 / 文书）改地道，**不改观点和逻辑**",
                  "适合": "课程论文、英文邮件、申请材料初稿",
                  "输出": "润色后全文 + 逐句「原文 → 改为 → 原因」对照 + 整体用词建议",
                  "需要": "英文原文，选一种语域",
                  "注意": "只改语言；**文书论证本身有问题**请先用「文书逻辑诊断」",
              }),

        Skill(id="en-polish-academic", name="学术论文润色",
              promise="先诊断论证问题，再统一术语、润色句子，让论文段落读起来像正式发表的文章",
              scene="study", tags=["英文", "润色", "学术写作", "论文"],
              good_for=["课程论文和毕业论文", "投稿前打磨摘要和引言", "从中文草稿写成英文"],
              needs=["论文段落", "属于论文哪一部分"],
              users=100, rating=4.8,
              source_repo="yuan1z0825/nature-skills", source_stars=0,
              source_origin="改写自开源项目 nature-skills 的 nature-polishing（Apache-2.0）：先诊断论证再润色，统一术语，不编造内容",
              source_badge="先诊断后润色",
              group="en-polish", variant_label="学术规范",
              recommend_reason="写的是**论文**、或者要从**中文草稿**写成英文时选：先查论证结构，再统一术语、润色句子",
              compare_dims={
                  "侧重": "**论证优先**：先找论断缺证据、结论说过头这类结构问题，再统一术语、改句子",
                  "适合": "课程论文、毕业论文、投稿前打磨摘要和引言，中文草稿转英文",
                  "输出": "润色后全文 + 3–5 条修改说明 + 术语表 + **需要作者补内容的地方**",
                  "需要": "论文段落，选它属于哪一部分",
                  "注意": "**不替你写核心论证**：结构问题补不了内容时会指出来，而不是用漂亮句子盖过去",
              }),

        Skill(id="en-grammar", name="英文语法检查",
              promise="只找语法和拼写错误，逐条列出原句和改法，其余一字不动",
              scene="study", tags=["英文", "语法", "校对"],
              good_for=["交稿前最后检查一遍", "已经改过风格、只想确认没有错误"],
              needs=["英文原文"],
              users=100, rating=4.7,
              source_repo="binary-husky/gpt_academic", source_stars=0,
              source_origin="借鉴 GPT Academic「查找语法错误」功能的做法：只纠错、不润色、表格对照（prompt 为本平台重写）",
              source_badge="错误对照表",
              group="en-polish", variant_label="只查语法",
              recommend_reason="只想**查语法拼写**、不想被改写法时选：逐条列出错误，没错就直接说没错",
              compare_dims={
                  "侧重": "**只纠正确定的错误**：语法、拼写、标点、时态、冠词，不动用词和风格",
                  "适合": "交稿前最后检查、已经满意写法只想排错",
                  "输出": "错误对照表（原句 / 改正 / 类型）+ 校对后全文 + 错误类型统计",
                  "需要": "英文原文",
                  "注意": "**不会让表达更地道**；想改得更自然请用「英文润色」",
              }),

        Skill(id="paper-read", name="论文精读",
              promise="用七个问题精读一篇论文：做什么、新在哪、代价多大、证据够不够，原文和评价分开写",
              scene="study", tags=["论文", "精读", "文献", "科研"],
              good_for=["组会汇报前读论文", "判断一篇论文值不值得精读", "准备复现或开题"],
              needs=["论文全文", "专业和阅读目的（选填）"],
              users=100, rating=4.7,
              source_repo="realzyzhang/paper-reader-heilmeier", source_stars=0,
              source_origin="改写自开源项目 paper-reader-heilmeier 的 Heilmeier 七问（MIT），并采用 paper-analyst（MIT）的论文类型判断与来源标注规则",
              source_badge="分清原文和观点",
              recommend_reason="要**精读一篇论文**、组会要讲或者考虑复现时用：七个问题既是摘要也是批判，每条判断都标明是原文还是模型的看法",
              compare_dims={
                  "侧重": "**批判性精读**：贡献、方法、风险、复现成本、证据缺口，论文原意和模型评价严格分开",
                  "适合": "组会汇报、开题前读文献、判断要不要复现",
                  "输出": "论文类型判断 + 七问分析（标注原文声明或模型归纳）+ 读完可以做什么",
                  "需要": "论文正文（上传 PDF 或粘贴），写上专业和阅读目的更贴合",
                  "注意": "**没有联网**，不会说论文发表后被谁引用；原文没有的期刊、年份会标「未明确给出」",
              }),

        Skill(id="lit-review-outline", name="文献综述提纲",
              promise="把读过的文献搭成一个有论点的综述结构：每节一个判断，研究空白从论证里推出来",
              scene="study", tags=["文献综述", "论文", "毕业论文", "写作"],
              good_for=["毕业论文写综述", "课程论文的文献部分", "开题报告的研究现状"],
              needs=["研究问题", "学科", "已读文献和要点"],
              users=100, rating=4.7,
              source_repo="bethww/lit-review", source_stars=0,
              source_origin="改写自开源项目 lit-review（MIT）的架构设计与写作规则：问题驱动而不是文献驱动",
              source_badge="按论证搭结构",
              recommend_reason="要写**文献综述**、手上已经读了一批文献时用：按「学界对这个问题的回答怎么变」来分节，而不是一篇篇罗列",
              compare_dims={
                  "侧重": "**论证型结构**：一个核心问题贯穿，各节代表回答的变化，空白从逻辑里推出",
                  "适合": "毕业论文、课程论文、开题报告的文献综述部分",
                  "输出": "收窄后的研究问题 + 分节架构（论点、证据、过渡）+ 研究空白 + **文献归位表**",
                  "需要": "研究问题、学科、已读文献和要点，可写目标字数",
                  "注意": "**只用你给的文献**，缺的地方标「待补文献」；给的是提纲，不直接写成全文",
              }),

        Skill(id="ref-format", name="参考文献格式化",
              promise="把乱七八糟的文献信息整理成 GB/T 7714 格式和 BibTeX，缺什么字段列出来让你去核对",
              scene="study", tags=["参考文献", "GB/T 7714", "BibTeX", "论文格式"],
              good_for=["毕业论文交稿前统一格式", "从各处复制来的文献格式不一", "要同时给 BibTeX"],
              needs=["文献信息", "学校或期刊的格式要求（选填）"],
              users=100, rating=4.7,
              source_repo="zechang-xiong/chinese-reference-formatter-skill", source_stars=0,
              source_origin="改写自开源项目 chinese-reference-formatter-skill（MIT）的中文参考文献著录规则",
              source_badge="缺啥标啥",
              recommend_reason="论文交稿前要**统一参考文献格式**时用：按 GB/T 7714 顺序编码制排好，同时给 BibTeX，缺的字段单独列出",
              compare_dims={
                  "侧重": "**只整理不补全**：按文献类型套对格式，作者、卷期页缺什么就标什么",
                  "适合": "毕业论文、课程论文、期刊投稿前统一格式",
                  "输出": "编号后的参考文献 + BibTeX + **待核验清单**（缺什么、去哪查）",
                  "需要": "文献信息（可以很乱），有学校或期刊的格式要求更准",
                  "注意": "**没有联网核验**，不会替你补作者和页码；各校细节不同，交稿前对照学校要求",
              }),

        # 求职实习
        Skill(id="campus-plan", name="校招投递规划",
              promise="按你的背景规划这一季的投递组合：主投、冲刺、低优先级，简历做几版，接下来 7 天做什么",
              scene="job", tags=["校招", "投递", "方向选择", "实习"],
              good_for=["秋招春招刚开始不知道投什么", "工科想转技术岗", "方向太多需要排优先级"],
              needs=["你的情况", "想投和不想投的方向"],
              users=100, rating=4.7,
              source_repo="czp0312/xiaozhao-skill", source_stars=0,
              source_origin="改写自开源项目 xiaozhao-skill（MIT）的候选人匹配与投递策略：七维度判断、三档分层",
              source_badge="附 7 天行动",
              recommend_reason="**刚开始校招、方向还没定**时用：按七个维度判断各方向，分成主投、冲刺、低优先级，给出简历版本和一周计划",
              compare_dims={
                  "侧重": "**整体组合**：不是评估一个岗位，而是决定主投、冲刺和先不投的方向",
                  "适合": "秋招春招开始前、工科转技术岗、方向太多需要取舍",
                  "输出": "结论 + 三档方向 + 依据 + 短板与补强 + 投递策略 + **接下来 7 天**",
                  "需要": "年级学历专业、技能和经历（可上传简历）、想投和不想投的方向",
                  "注意": "不给具体公司的招聘链接和截止日期；评估**某一个 JD** 请用「岗位适配评估」",
              }),

        Skill(id="resume-fix", name="简历修改",
              promise="按目标岗位重写每一条经历，把描述改成可量化的结果",
              scene="job", tags=["简历", "STAR", "量化"],
              good_for=["秋招投递前", "实习转正式岗位", "简历一直没有回音"],
              needs=["简历文件", "目标岗位方向"],
              users=100, rating=4.9,
              source_repo="resume-builder-skill", source_stars=72,
              source_origin="采用 Harvard Career Services 标准 + Google XYZ 公式，ATS 兼容优化",
              source_badge="Harvard 标准",
              group="resume-fix", variant_label="量化成果",
              recommend_reason="投**技术岗**、或经历里**有数据可以挖**时首选：把每条经历改成「做了什么 + 多大结果」，并按 ATS 关键词优化",
              compare_dims={
                  "侧重": "**技术深度和量化成果**：用 XYZ 公式把描述改成可衡量的结果，顺带做 ATS 关键词适配",
                  "适合": "投递**技术岗**或大厂、有实习或项目数据、需要过简历系统筛选的岗位",
                  "输出": "问题诊断 + 重写示例 + **完整优化版简历** + 修改建议清单",
                  "需要": "简历文件、目标岗位方向",
                  "注意": "会要求你的经历里**有可以量化的事实**；没有的数据需要你自己补",
              }),

        Skill(id="resume-fix-story", name="简历故事线重写",
              promise="围绕目标岗位重排和取舍经历，写出一条「为什么是你」的主线",
              scene="job", tags=["简历", "叙事", "定位"],
              good_for=["经历偏少或数据不足", "转岗、跨专业投递", "想让简历读起来有主线"],
              needs=["简历文件", "目标岗位方向"],
              users=100, rating=4.7,
              source_badge="",
              group="resume-fix", variant_label="岗位叙事",
              recommend_reason="投**综合、运营类岗位**，或经历偏少、要**转岗投递**时更合适：先定位，再按主线取舍经历，**不硬编数字**",
              compare_dims={
                  "侧重": "**项目广度和个人特色**：先给出一句话定位，再按岗位要求重排、取舍经历，每条用 STAR 写清情境、行动、结果",
                  "适合": "投递**综合、运营类岗位**，经历偏少或缺少量化数据，转岗、跨专业投递",
                  "输出": "一句话定位 + 主线与取舍说明 + 逐条 STAR 重写 + **需要你补充的信息清单**",
                  "需要": "简历文件、目标岗位方向",
                  "注意": "**不会替你编造数字**：没有数据的地方会标出来，告诉你该补什么",
              }),

        Skill(id="resume-fix-campus", name="校招简历证据链",
              promise="先复述事实、对照岗位要求找证据，再按 A-C-R-E 逐条改写，没证据的不写进简历",
              scene="job", tags=["简历", "校招", "应届生", "A-C-R-E"],
              good_for=["第一次写校招简历", "经历以课程项目和社团为主", "怕简历被追问时说不圆"],
              needs=["简历文件", "目标岗位方向"],
              users=100, rating=4.7,
              source_repo="joeseesun/qiaomu-campus-resume", source_stars=0,
              source_origin="改写自开源项目「乔木大学生简历」（MIT）：岗位要求—证据—缺口映射 + A-C-R-E 逐条审校",
              source_badge="每条有证据",
              group="resume-fix", variant_label="校招证据链",
              recommend_reason="**在校生、应届生**，经历以课程项目、社团、短期实习为主时选：每条都要有证据，经得起面试追问",
              compare_dims={
                  "侧重": "**可信优先**：先复述事实，再建「岗位要求 → 证据 → 位置」映射，按动作、情境、结果、证据逐条改",
                  "适合": "第一次写校招简历、经历以课程项目和社团为主、担心被面试官追问",
                  "输出": "事实清单 + 要求与证据对照表 + 改写后简历 + 逐条 A-C-R-E 检查 + **需要你确认的问题**",
                  "需要": "简历文件、目标岗位方向",
                  "注意": "缺证据的岗位要求**只标为缺口**，不写进简历；成果写不出数字时写范围和交付",
              }),

        Skill(id="jd-match", name="简历与 JD 匹配",
              promise="算出匹配度，并明确列出你缺的关键词和补法",
              scene="job", tags=["JD", "匹配度", "关键词"],
              good_for=["投递前判断值不值得投", "同一岗位批量筛选"],
              needs=["简历", "岗位 JD"],
              users=100, rating=4.8,
              source_repo="resume-tailoring-skill", source_stars=766,
              source_origin="resume-tailoring-skill 开源项目，766 star，针对 JD 关键词做 ATS 优化匹配分析",
              source_badge="算匹配度",
              group="jd-match", variant_label="关键词补缺",
              recommend_reason="手上**有具体 JD**、想知道差在哪时用：算匹配度，指出缺哪些关键词、怎么补",
              compare_dims={
                  "侧重": "逐条对照 JD 要求算**匹配度**，给出缺失关键词的补法",
                  "适合": "投递前看差距、同一岗位批量筛选",
                  "输出": "综合与分项匹配度 + 已覆盖 / 缺失要求 + 改写建议 + 投递建议",
                  "需要": "简历、岗位 JD 原文",
                  "注意": "**不重写整份简历**；要按岗位改简历请用「简历修改」",
              }),

        Skill(id="jd-fit", name="岗位适配评估",
              promise="先查硬性门槛，再按技能、经历、方向加权打分，给出这个岗位投不投的结论",
              scene="job", tags=["JD", "岗位评估", "投递决策"],
              good_for=["犹豫要不要投某个岗位", "多个岗位里挑优先级", "想知道岗位和自己方向合不合"],
              needs=["简历", "岗位 JD", "求职方向（选填）"],
              users=100, rating=4.7,
              source_repo="MadsLorentzen/ai-job-search", source_stars=0,
              source_origin="改写自开源项目 ai-job-search 的岗位评估框架（MIT）：硬性门槛 + 加权打分 + 投递结论",
              source_badge="四维评分",
              group="jd-match", variant_label="投不投",
              recommend_reason="**还在犹豫要不要投**时选：先查学历、专业、毕业年份等硬门槛，再看岗位和你的方向合不合",
              compare_dims={
                  "侧重": "**投递决策**：硬性门槛逐条对照 JD 原文，技能、经历、工作方式、方向四项加权打分",
                  "适合": "犹豫要不要投、多个岗位排优先级、想确认岗位符不符合自己的方向",
                  "输出": "硬性门槛对照 + 分项评分和理由 + 投不投的结论 + 优势与差距 + 可以问 HR 的问题",
                  "需要": "简历、岗位 JD，填了**求职方向**评得更全",
                  "注意": "看不出来的项会标「信息不足」而**不硬打分**；不给关键词补法，要补关键词用默认版",
              }),

        Skill(id="jd-tailor", name="按 JD 定制简历",
              promise="把简历换成这份 JD 的说法重写一遍，只改表达不加事实，缺的如实列出",
              scene="job", tags=["JD", "简历", "定制", "ATS"],
              good_for=["已经决定投某个岗位", "同一份简历要投不同岗位"],
              needs=["简历", "岗位 JD"],
              users=100, rating=4.7,
              source_repo="srbhr/Resume-Matcher", source_stars=0,
              source_origin="采用开源项目 Resume Matcher 的简历定制规则（Apache-2.0）：只改表达不改事实，缺口如实列出",
              source_badge="不加没有的",
              group="jd-match", variant_label="按 JD 改写",
              recommend_reason="**已经决定投**、想让简历贴着这份 JD 写时选：换成 JD 的说法，但不添加任何你没有的经历和技能",
              compare_dims={
                  "侧重": "**针对一份具体 JD 改写**：时间、单位、条数原样保留，只换说法、调顺序、重写简介",
                  "适合": "已经决定投递、同一份简历要按不同岗位各改一版",
                  "输出": "JD 关键词拆解 + **改写后的完整简历** + 改动说明 + 简历里缺的 + 需要你确认的改写",
                  "需要": "简历、岗位 JD 原文",
                  "注意": "和「简历修改」不同：那个按**岗位方向**改，这个按**一份具体 JD** 改；缺的能力不会替你写进去",
              }),

        Skill(id="referral-msg", name="内推请求消息",
              promise="按你们的关系写一条内推或学长学姐咨询消息，附可直接转发的推荐语和一条跟进",
              scene="job", tags=["内推", "校友", "微信", "人脉"],
              good_for=["找师兄师姐内推", "想约学长学姐聊聊岗位", "第一次联系不熟的人"],
              needs=["对方是谁和关系", "目标岗位", "一句话匹配点"],
              users=100, rating=4.7,
              source_repo="mohitagw15856/pm-claude-skills", source_stars=0,
              source_origin="改写自开源项目 pm-claude-skills 的 referral-request 与 informational-interview-prep（MIT）",
              source_badge="按关系定请求",
              recommend_reason="要找**师兄师姐内推**或约人聊聊时用：请求大小跟关系匹配，熟人直接要内推、不熟先约聊、陌生人只问一个问题",
              compare_dims={
                  "侧重": "**分寸感**：请求和关系匹配，每条都有关系、岗位、匹配点、请求和退路",
                  "适合": "找熟人或校友内推、约学长学姐咨询、陌生人第一次联系",
                  "输出": "消息正文 + **可直接转发的推荐语** + 一周后跟进 + 咨询提问清单（约聊时）",
                  "需要": "对方是谁和关系、目标岗位、一句话匹配点、渠道",
                  "注意": "陌生人第一条**不会直接要内推**；只跟进一次",
              }),

        Skill(id="cover-letter", name="求职信生成",
              promise="围绕岗位要做的事写一封求职信，不讲套话，不编造公司信息",
              scene="job", tags=["求职信", "投递", "邮件"],
              good_for=["投递要求附求职信", "邮件投递写正文", "外企和英文岗位申请"],
              needs=["简历或经历描述", "岗位 JD", "公司信息（选填）"],
              users=100, rating=4.7,
              source_repo="MadsLorentzen/ai-job-search", source_stars=0,
              source_origin="采用开源项目 ai-job-search 的求职信写作规范（MIT）：面向岗位任务、禁用套话、不编造公司信息",
              source_badge="不写套话",
              recommend_reason="投递要附**求职信**或写邮件正文时用：讲你能帮岗位做什么，牵强的说法会单独标出来让你决定",
              compare_dims={
                  "侧重": "**面向岗位要做的事**，每个说法都有具体例子，不写「充满热情」这类套话",
                  "适合": "要求附求职信的投递、邮件投递正文、外企和英文岗位",
                  "输出": "邮件标题 + 求职信正文（中文或英文）+ **需要你确认的说法** + 需要你补充的信息",
                  "需要": "简历或经历、岗位 JD，选中文或英文；有公司信息会写得更具体",
                  "注意": "**不编造公司的业务和新闻**：没给公司信息时只围绕岗位职责写",
              }),

        Skill(id="self-intro", name="自我介绍生成",
              promise="生成 1 分钟和 3 分钟两个版本，都能顺着说出口",
              scene="job", tags=["面试", "自我介绍"],
              good_for=["面试开场", "群面破冰"],
              needs=["简历或经历描述", "目标岗位"],
              users=100, rating=4.7,
              source_repo="resume-builder-skill", source_stars=72,
              source_origin="采用 Harvard Career Services 标准，双版本输出（1 min / 3 min）",
              source_badge="口语化",
              group="self-intro", variant_label="长短两版",
              recommend_reason="**快要面试、开场还没准备**时用：给 1 分钟和 3 分钟两版，都能直接说出口",
              compare_dims={
                  "侧重": "**口语化**，每段经历都扣回目标岗位",
                  "适合": "面试开场、群面破冰",
                  "输出": "1 分钟版 + 3 分钟版 + 口头表达提示 + 需要你补的数字",
                  "需要": "简历或经历描述、目标岗位",
                  "注意": "**不编数字**：没给数据的地方会留空，让你自己填",
              }),

        Skill(id="self-intro-pitch", name="30 秒电梯演讲",
              promise="一两个亮点加一句「为什么是我」，30 秒讲完，并逐句说明每句在起什么作用",
              scene="job", tags=["面试", "自我介绍", "电梯演讲"],
              good_for=["招聘会和宣讲会上快速介绍自己", "面试官只给半分钟", "想知道自我介绍为什么要这么讲"],
              needs=["简历或经历描述", "目标岗位", "目标公司（选填）"],
              users=100, rating=4.7,
              source_repo="yangshun/tech-interview-handbook", source_stars=0,
              source_origin="改写自 Tech Interview Handbook 的自我介绍指南（MIT），该指南与前 Meta 招聘委员会主席合作撰写",
              source_badge="电梯演讲",
              group="self-intro", variant_label="30 秒",
              recommend_reason="**时间很短**、或在招聘会上要快速介绍自己时选：只讲一两个亮点和「为什么是我」，不讲成长史",
              compare_dims={
                  "侧重": "**短而直接**：基本信息 → 一两个亮点的一句话摘要 → 和这个岗位、这家公司的关联",
                  "适合": "招聘会、宣讲会、面试官只给半分钟的场合",
                  "输出": "30 秒版 + **逐句拆解**（每句起什么作用）+ 流水账反例和改法 + 练习提示",
                  "需要": "简历或经历描述、目标岗位，填了目标公司会扣得更紧",
                  "注意": "只有一个短版；正式面试开场要 1 分钟或 3 分钟版请用默认版",
              }),

        Skill(id="interview-q", name="面试问题生成",
              promise="基于你的简历和 JD 预测真会被问到的问题，含追问",
              scene="job", tags=["面试", "预测", "追问"],
              good_for=["面试前一天准备", "找出简历里的雷"],
              needs=["简历", "目标岗位或 JD"],
              users=100, rating=4.8,
              source_repo="resume-tailoring-skill", source_stars=766,
              source_origin="resume-tailoring-skill 开源项目，766 star，从 JD 逆推高频面试问题含追问链路",
              source_badge="先找简历里的雷",
              recommend_reason="面试前想**知道会被问什么**时用：先找简历里的雷，再预测问题和追问",
              compare_dims={
                  "侧重": "**贴着岗位预测问题**，每题都带面试官可能的追问",
                  "适合": "面试前一天准备、找出简历里的薄弱点",
                  "输出": "简历里的雷 + 10 道高概率题（含追问和答题要点）+ 5 道专业题 + 反问建议",
                  "需要": "简历、目标岗位或 JD",
                  "注意": "给的是答题要点，**不给完整答案**，需要你自己组织成话",
              }),

        Skill(id="story-bank", name="行为面试故事库",
              promise="把你的经历整理成能力 × 故事矩阵：每项能力一个主故事一个备用故事，附 60 秒口语版和追问准备",
              scene="job", tags=["行为面试", "STAR", "HR 面", "故事"],
              good_for=["HR 面和行为面试前", "面了几轮总被问住", "想系统准备而不是临时编"],
              needs=["你的经历", "目标岗位"],
              users=100, rating=4.7,
              source_repo="chen3tu/interview-master-skill", source_stars=0,
              source_origin="改写自开源项目 interview-master-skill（MIT）的回答三层结构、行为题库与校招调整规则",
              source_badge="主备双故事",
              recommend_reason="**HR 面、行为面试**前用：把经历整理成故事库，每个故事都准备好「怎么证明是你做的」这类追问",
              compare_dims={
                  "侧重": "**故事资产**：事实、方法、决策三层，每项能力有主故事和备用故事",
                  "适合": "HR 面、行为面试、总被追问住的时候",
                  "输出": "能力 × 故事总览表 + 每个故事的 STAR 要点和 **60 秒口语版** + 五类追问准备 + 缺失证据",
                  "需要": "3-6 段经历、目标岗位",
                  "注意": "**不编造冲突和结果**；预测这场面试会问什么请用「面试问题生成」",
              }),

        Skill(id="interview-review", name="面试复盘",
              promise="把面试回忆变成结构化复盘，指出下次该改的三件事",
              scene="job", tags=["复盘", "面试"],
              good_for=["刚面完趁记忆新鲜时"],
              needs=["面试过程回忆"],
              users=100, rating=4.7,
              source_repo="resume-builder-skill", source_stars=72,
              source_origin="STAR 方法结构化提炼复盘，精准定位三项改进点",
              source_badge="定位3项改进",
              recommend_reason="**刚面完、趁还记得**时用：逐题诊断，只挑下次最该改的三件事",
              compare_dims={
                  "侧重": "**复盘沉淀**：逐题诊断答法，也指出做对的地方，免得下次改过头",
                  "适合": "刚面完、记忆还新鲜的时候",
                  "输出": "问答时间线 + 逐题诊断和更好的答法 + 必改三件事（含怎么练）+ 结果预判",
                  "需要": "面试过程回忆、岗位",
                  "注意": "诊断质量取决于你**回忆得多细**；记不清的题不会替你补",
              }),

        Skill(id="thank-you-letter", name="面试感谢信",
              promise="面试后写一封简短、具体的感谢信，提到你们真实聊过的内容",
              scene="job", tags=["感谢信", "面试", "邮件"],
              good_for=["面试结束当天", "外企和英文面试", "想补充面试里没答好的点"],
              needs=["公司和岗位", "面试中聊到的内容"],
              users=100, rating=4.7,
              source_repo="eliornl/rolemule", source_stars=0,
              source_origin="改写自开源项目 RoleMule 的感谢信模块（MIT）：引用具体面试内容，正文简短，不写套话",
              source_badge="引用面试细节",
              recommend_reason="**刚面完**、想给面试官留个好印象时用：引用你们聊过的内容，短而具体，中英文都可以",
              compare_dims={
                  "侧重": "**具体而简短**：至少引用一处面试里聊到的内容，正文中文 200 字、英文 150 词以内",
                  "适合": "面试结束当天、外企和英文面试、想补充没答完整的点",
                  "输出": "邮件标题 + 正文 + 引用了哪些面试内容（方便核对）+ 发送建议",
                  "需要": "公司和岗位、面试中聊到的内容，有面试官称呼更好",
                  "注意": "**不编造面试细节**，只用你写的内容；落款留给你自己签",
              }),

        Skill(id="followup-msg", name="求职跟进消息",
              promise="按投递所处阶段写跟进消息；被拒时顺带解读拒信、给出改进方向和得体的回复",
              scene="job", tags=["跟进", "催进度", "拒信", "邮件"],
              good_for=["面试后一直没消息", "泡池子不知道怎么问", "收到拒信想体面回复"],
              needs=["当前阶段", "公司和岗位"],
              users=100, rating=4.7,
              source_repo="eliornl/rolemule", source_stars=0,
              source_origin="改写自开源项目 RoleMule 的跟进邮件与拒信分析模块（MIT）：分阶段写法、零占位符",
              source_badge="含拒信解读",
              recommend_reason="**面完没消息、泡池子或被拒**时用：按阶段决定什么时候发、写什么、不写什么，被拒时还会解读拒信",
              compare_dims={
                  "侧重": "**分阶段**：投递后、迟迟没消息、泡池子、终面后、等书面 offer、被拒后，各有写法和时机",
                  "适合": "催进度、确认流程、被拒后保持关系",
                  "输出": "消息正文 + 什么时候发 + 对方不回怎么办 + **拒信解读**（被拒时）",
                  "需要": "当前阶段、公司和岗位；被拒的话贴上拒信原文",
                  "注意": "**面试刚结束的感谢**请用「面试感谢信」；等书面 offer 时不在消息里谈薪",
              }),

        Skill(id="offer-compare", name="Offer 对比决策",
              promise="把几个 offer 拆成可比的条目，按你的优先级给出有条件的推荐，并写出什么情况下结论会反过来",
              scene="job", tags=["offer", "选 offer", "签约", "决策"],
              good_for=["手上有两三个 offer 拿不定", "要在截止日期前签三方", "钱和成长不知道怎么取舍"],
              needs=["各个 offer 的信息", "你看重什么、硬性条件"],
              users=100, rating=4.7,
              source_repo="chen3tu/interview-master-skill", source_stars=0,
              source_origin="改写自开源项目 interview-master-skill（MIT）的 offer 评估流程，并采用 RoleMule 与 pm-claude-skills（均 MIT）的比较维度和翻转分析",
              source_badge="写出翻转条件",
              recommend_reason="**手上有几个 offer 拿不定**时用：保底现金和浮动部分分开算，按你的优先级取舍，写清结论取决于哪个假设",
              compare_dims={
                  "侧重": "**按你的优先级决策**：事实、偏好和未知分开，致命约束不藏在平均分里",
                  "适合": "两三个 offer 二选一、签三方前、钱和成长难取舍",
                  "输出": "结论 + 对比表 + 六维度谁更好 + **结论取决于哪个假设** + 签约前要问的问题",
                  "需要": "每个 offer 的条件、你看重什么和硬性条件",
                  "注意": "只用你给的数字；违约金等法律问题以合同原文为准；**谈薪**请用「谈薪准备」",
              }),

        Skill(id="salary-talk", name="谈薪准备",
              promise="定好目标价、底线和开价，给出能直接说的话术、HR 压价时的应对，以及月薪之外能谈的条件",
              scene="job", tags=["谈薪", "offer", "HR", "薪资"],
              good_for=["拿到口头 offer 准备谈", "觉得 offer 偏低", "想争取定级或签字费"],
              needs=["offer 情况", "期望和底线"],
              users=100, rating=4.7,
              source_repo="eliornl/rolemule", source_stars=0,
              source_origin="改写自开源项目 RoleMule 的谈薪模块（MIT），并采用 interview-master-skill 与 pm-claude-skills（均 MIT）的薪酬拆分和底线方法",
              source_badge="话术可直接说",
              recommend_reason="拿到 offer **想谈条件**时用：先算清楚这份 offer，再定三个数，话术一字一句能直接说，校招谈薪空间小也写明了",
              compare_dims={
                  "侧重": "**谈之前定底线**：目标价、底线、开价都有依据，话术可以直接说出口",
                  "适合": "拿到口头 offer 后、签三方前、觉得条件偏低",
                  "输出": "offer 拆解 + 三个数 + 主话术 + **HR 压价应对** + 月薪之外的筹码 + 要做和不要做",
                  "需要": "offer 情况、期望和底线，有其他 offer 写上",
                  "注意": "**不编造竞争 offer**；校招统一定价时更该谈定级、签字费和城市",
              }),

        # 留学申请
        Skill(id="bg-assess", name="背景评估",
              promise="对照目标国家和专业，给出你现在的真实竞争力位置",
              scene="abroad", tags=["背景", "定位", "评估"],
              good_for=["大二大三开始规划时", "判断要不要先补短板"],
              needs=["GPA、语言成绩、经历", "目标国家与专业"],
              users=100, rating=4.7,
              source_repo="academic-research-skills", source_stars=50821,
              source_origin="academic-research-skills 开源项目，50.8k star，DOI 学术认证，CC BY-NC 4.0",
              source_badge="分清能补和补不了",
              recommend_reason="**还没定学校**、想先知道自己在什么位置时用：分项评估，分清能补和补不了的短板",
              compare_dims={
                  "侧重": "分项评估竞争力，区分**还能补的**和**补不了的**短板",
                  "适合": "大二大三开始规划、判断要不要先补短板",
                  "输出": "分项评估和理由 + 综合定位 + 短板补救方案（含时间窗口）+ 最优先的一件事",
                  "需要": "GPA、语言成绩、经历，目标国家与专业",
                  "注意": "依据历年情况估计，**各校要求逐年在变**，以官网为准",
              }),

        Skill(id="school-pick", name="选校定位",
              promise="给出冲刺、匹配、保底三档学校名单，每一档说明理由",
              scene="abroad", tags=["选校", "定位", "名单"],
              good_for=["确定申请清单", "判断自己是否够得着"],
              needs=["背景信息", "目标国家、专业与预算"],
              users=100, rating=4.8,
              source_repo="academic-research-skills", source_stars=50821,
              source_origin="academic-research-skills 开源项目，50.8k star，覆盖申请全流程多维度评估",
              source_badge="按预算核对",
              group="school-pick", variant_label="授课型三档",
              recommend_reason="背景清楚、要**定申请清单**时用：分冲刺、匹配、保底三档，并按预算核对",
              compare_dims={
                  "侧重": "**院校与专业匹配**：三档定位，每所学校说明为什么放这一档",
                  "适合": "确定申请清单、判断自己够不够得着",
                  "输出": "定位判断 + 冲刺 / 匹配 / 保底名单（到具体项目）+ 预算核对 + 补短板建议",
                  "需要": "背景信息、目标国家、专业与预算",
                  "注意": "录取信息来自历年资料、**可能过时**，不给精确分数线，申请前务必到官网核对",
              }),

        Skill(id="school-pick-research", name="研究型项目选校",
              promise="针对研究型硕士和博士，按成绩、研究经历和资助需求分三档推荐项目，附对比表",
              scene="abroad", tags=["选校", "博士", "研究型硕士", "全奖"],
              good_for=["申请 PhD 或 MRes / MPhil", "需要奖学金或全奖", "看重研究方向是否对口"],
              needs=["背景信息", "目标国家与研究方向", "学位类型与资金情况"],
              users=100, rating=4.7,
              source_repo="xujingchen1996/research-app-toolkit", source_stars=0,
              source_origin="改写自开源项目 research-app-toolkit 的 school-select（MIT）；原版靠实时搜索，本平台为单次版",
              source_badge="看资助与方向",
              group="school-pick", variant_label="研究型 / 博士",
              recommend_reason="申请**博士或研究型硕士**、看重**资助和研究方向对口**时选：按学术、研究、技能、经历四方面对照",
              compare_dims={
                  "侧重": "**研究契合和资助**：成绩、研究经历、技能、其他经历四项对照，每个项目打契合度分",
                  "适合": "申请 PhD、MRes / MPhil，需要奖学金或全奖的人",
                  "输出": "画像对照 + 三档项目（含要求对照、资助类型、研究契合）+ 对比总表 + 下一步 + 核对清单",
                  "需要": "背景、目标国家、研究方向、学位类型、资金情况",
                  "注意": "**没有联网**，不给具体分数线、截止日期和导师姓名；授课型硕士请用默认版",
              }),

        Skill(id="research-proposal", name="研究计划书",
              promise="为博士申请或开题写一份面向未来的研究计划书：问题、文献、方法、时间安排，引用只用你给的",
              scene="abroad", tags=["研究计划书", "RP", "博士申请", "开题报告"],
              good_for=["申请博士或研究型硕士要交 RP", "写开题报告", "套磁前准备研究方向"],
              needs=["研究主题和问题", "学科", "用途"],
              users=100, rating=4.7,
              source_repo="luwill/research-skills", source_stars=0,
              source_origin="改写自开源项目 research-skills 的 research-proposal（MIT）：引用宁可少不可假，删除 AI 腔",
              source_badge="宁缺不编文献",
              recommend_reason="申请**博士、研究型项目**要交研究计划书，或者写**开题报告**时用：按默认六节结构成稿，需要文献但你没给的地方会标出来",
              compare_dims={
                  "侧重": "**引用真实**：只引用你提供的文献，缺的标「待补文献」，语气和证据强度匹配",
                  "适合": "博士和研究型硕士申请、开题报告、人文学科论文计划",
                  "输出": "锁定的假设 + **完整计划书**（摘要到研究意义）+ 图表建议 + 交付前核对清单",
                  "需要": "研究主题和问题、学科、用途、语言；有文献的话一起给",
                  "注意": "**不会编参考文献**；写的是研究计划，个人动机请用「文书初稿生成」",
              }),

        Skill(id="prof-email", name="套磁信生成",
              promise="先联网读导师的主页和论文，再写一封把导师研究和你的经历对上的套磁邮件",
              scene="abroad", tags=["套磁", "导师", "博士", "邮件", "科研"],
              good_for=["申请博士或研究型硕士前联系导师", "找毕业论文或科研导师", "想确认导师今年是否招生"],
              needs=["你的背景", "导师姓名和学校", "申请身份"],
              users=100, rating=4.7,
              source_repo="voidful/academic-skills", source_stars=0,
              source_origin="改写自开源项目 academic-skills 的 professor-fit-analyser（MIT）：先读导师公开信息，再按研究主线和申请身份写信",
              source_badge="先查导师主页",
              recommend_reason="申请**博士、研究型项目**或找**科研导师**时用：先联网整理导师的研究主线和近期论文，再写出具体的「对得上」",
              compare_dims={
                  "侧重": "**证明对得上**：导师的一到两条研究主线，对上你能贡献的一个具体方面，结尾是分寸得当的请求",
                  "适合": "博士申请、硕士论文找导师、本科科研和毕业设计、研究合作",
                  "输出": "邮件标题 + 正文 + **引用了导师哪些信息（附来源）** + 发信前建议先读的论文 + 发送建议",
                  "需要": "你的背景、导师姓名和学校（有主页链接更准）、申请身份；写上读过的论文更好",
                  "注意": "论文标题会**逐字核对网页原文**；你没写读过的论文，信里不会说「我读过」",
              }),

        Skill(id="academic-cv", name="学术 CV",
              promise="把你的经历重组成针对一个具体项目的英文学术 CV，区分授课型和研究型，附中文经历译法",
              scene="abroad", tags=["CV", "简历", "留学申请", "英文简历"],
              good_for=["申请材料里要交 CV", "中文简历要改成英文学术版", "博士申请突出研究经历"],
              needs=["目标项目", "学位类型", "你的经历"],
              users=100, rating=4.7,
              source_repo="Harry-Sun0529/euro-grad-apply", source_stars=0,
              source_origin="改写自开源项目 euro-grad-apply 的学术 CV 标准（MIT）：三层部分清单、量化三档退让、中国学生专项",
              source_badge="授课研究分写",
              recommend_reason="申请材料要交**英文学术 CV**时用：按授课型或研究型调整重心和页数，数字答不上来就按三档退让，成品里不留占位符",
              compare_dims={
                  "侧重": "**针对一个项目**：必备、条件必备、通常删掉三层清单，研究型突出方法和产出",
                  "适合": "留学申请的 CV、中文简历转英文学术版、博士申请",
                  "输出": "**完整英文 CV** + 取舍说明 + 需要你补充的信息 + 提交提醒",
                  "需要": "目标项目、学位类型、目标国家、你的经历（可上传旧 CV）",
                  "注意": "求职用的中文简历请用「简历修改」；Referees 放之前要先征得老师同意",
              }),

        Skill(id="ps-draft", name="文书初稿生成",
              promise="基于你的真实经历生成结构完整的初稿，不编造事实",
              scene="abroad", tags=["文书", "初稿"],
              good_for=["完全不知道从哪下笔时"],
              needs=["经历素材", "目标项目"],
              users=100, rating=4.6,
              source_repo="essay-skills", source_stars=4,
              source_origin="essay-skills 开源 6 步写作流水线，从素材 brief 到初稿全程结构化引导",
              source_badge="素材→初稿",
              recommend_reason="有经历素材但**不知道从哪下笔**时用：先选材再成稿，缺的信息标出来让你补",
              compare_dims={
                  "侧重": "**真实性**优先：只用你给的素材，按项目偏好选材成稿",
                  "适合": "完全不知道从哪下笔的时候",
                  "输出": "选材说明（用什么、不用什么）+ 完整初稿 + 逐段说明 + 需你补充的清单",
                  "需要": "经历素材、目标项目",
                  "注意": "**绝不编造经历**；素材越具体，初稿越像你",
              }),

        Skill(id="ps-diagnose", name="文书逻辑诊断",
              promise="不改文笔，只查逻辑：动机是否成立、证据是否支撑",
              scene="abroad", tags=["文书", "逻辑", "诊断"],
              good_for=["文书写完但总觉得哪里不对", "中介改完后自己再验一遍"],
              needs=["文书初稿", "目标项目"],
              users=100, rating=4.9,
              source_repo="essay-skills", source_stars=4,
              source_origin="essay-skills 开源 6 步写作流水线，论证链路检验独立于润色步骤",
              source_badge="不改文笔",
              group="ps-diagnose", variant_label="查逻辑",
              recommend_reason="文书**写完了总觉得哪里不对**时用：只查论证，不碰文笔",
              compare_dims={
                  "侧重": "**逻辑性**：动机是否成立、证据能否支撑、结论有没有拔高",
                  "适合": "初稿写完后自查、中介改完后自己再验一遍",
                  "输出": "论证结构 + 按优先级排的问题清单（含改法）+ 修改路线图",
                  "需要": "文书初稿、目标项目",
                  "注意": "**不改语言表达**；要改得地道请再用「英文润色」",
              }),

        Skill(id="ps-humanize", name="文书去 AI 腔",
              promise="找出英文里的 AI 腔，逐段改成自然的学术表达，并说明每段改了什么",
              scene="abroad", tags=["文书", "英文", "AI 腔", "学术写作"],
              good_for=["用 AI 起草后读着很机械", "非英语母语写的论文或文书", "连接词和空话太多"],
              needs=["英文文本", "学科领域"],
              users=100, rating=4.7,
              source_repo="momo2young/humanize-academic-writing", source_stars=0,
              source_origin="改写自开源项目 humanize-academic-writing（MIT）：识别 AI 腔模式，逐段改写并说明理由",
              source_badge="逐段说明",
              group="ps-diagnose", variant_label="去 AI 腔",
              recommend_reason="文书或论文**用 AI 起草过、读着很机械**时选：逐段指出 AI 腔，改成自然的学术表达",
              compare_dims={
                  "侧重": "**表达自然度**：句长节奏、机械连接词、空泛说法、语气限定，逐段指出并改写",
                  "适合": "用 AI 起草的文书或论文、非英语母语作者、连接词和空话偏多的文本",
                  "输出": "AI 腔诊断（引用原句）+ 逐段原文 / 改后 / 改了什么 + 需要你补的具体内容 + 自查清单",
                  "需要": "英文文本、学科领域",
                  "注意": "**不查论证逻辑**，也不保证通过 AI 检测；原文没有的文献和例子不会替你加",
              }),

        Skill(id="ps-adapt", name="文书多校适配",
              promise="把已有文书改成适合另一个项目的版本，或在提交前做六轮终审：事实、答题、结构、匹配、语言、格式",
              scene="abroad", tags=["文书", "PS", "SOP", "终审", "多校"],
              good_for=["一篇母稿要改投多所学校", "提交前最后检查一遍", "题目和母稿对不上"],
              needs=["已有的文书", "目标项目和题目原文", "字数限制"],
              users=100, rating=4.7,
              source_repo="asdfghklddd/personal-statement-skill-by-andy", source_stars=0,
              source_origin="改写自开源项目 personal-statement-skill-by-andy（MIT）的文书分流、多校适配与六轮审稿",
              source_badge="六轮终审",
              recommend_reason="一篇文书要**改投多个项目**，或者**提交前最后检查**时用：先认清题目要哪类文书，再逐段适配，不是只换校名",
              compare_dims={
                  "侧重": "**事实守恒和答题合规**：多校版本互不矛盾，逐项回应题目，资源只用官网有的",
                  "适合": "母稿改投多校、提交前终审、PS 和 SOP 题目对不上的时候",
                  "输出": "题目分析 + 改写后全文 + 改动说明 + **六轮审稿结果** + 五个测试 + 交付状态",
                  "需要": "已有文书、目标项目和题目原文、字数限制，可贴项目资源",
                  "注意": "**从零写初稿**请用「文书初稿生成」；论证逻辑问题可以先用「文书逻辑诊断」",
              }),

        Skill(id="reference-request", name="推荐信请求邮件",
              promise="写一封请老师或前上级做推荐人的邮件，附上对方写推荐信时能用的要点",
              scene="abroad", tags=["推荐信", "邮件", "申请"],
              good_for=["请老师写留学推荐信", "求职需要背景调查联系人", "很久没联系的老师"],
              needs=["推荐人和关系", "申请目标", "希望对方提到的经历"],
              users=100, rating=4.7,
              source_repo="eliornl/rolemule", source_stars=0,
              source_origin="改写自开源项目 RoleMule 的推荐人请求模块（MIT）：让对方容易答应，也能体面拒绝",
              source_badge="附要点清单",
              recommend_reason="要**请老师写推荐信**、尤其是很久没联系时用：邮件附带要点清单和跟进安排",
              compare_dims={
                  "侧重": "**尊重对方时间**：写清申请目标和截止时间，留出拒绝余地，久未联系先问候",
                  "适合": "请老师写留学推荐信、求职背调联系人、很久没联系的推荐人",
                  "输出": "邮件标题 + 正文 + **附给推荐人的要点清单** + 跟进安排 + 需要你补充的",
                  "需要": "推荐人和关系、多久没联系、申请目标、希望对方提到的经历",
                  "注意": "**不替你写推荐信本身**；截止时间没给时不会编日期",
              }),

        Skill(id="europe-offer", name="欧洲 offer 后清单",
              promise="拿到欧洲 offer 之后到落地：决策、签证、资金证明、行前、落地顺序，按你所在的阶段给清单",
              scene="abroad", tags=["签证", "offer", "欧洲留学", "行前准备"],
              good_for=["拿到欧洲 offer 不知道下一步", "准备签证和资金证明", "落地后办手续"],
              needs=["目标国家", "所在阶段", "读硕还是读博"],
              users=100, rating=4.7,
              source_repo="Harry-Sun0529/euro-grad-apply", source_stars=0,
              source_origin="改写自开源项目 euro-grad-apply 的 euro-visa 与 offer 后清单（MIT）",
              source_badge="分阶段清单",
              recommend_reason="拿到**欧洲 offer** 之后用：按你所在的阶段给出要做的事，提醒资金来源合规、学位归属核对、落地手续的先后顺序",
              compare_dims={
                  "侧重": "**按阶段执行**：决策、签证、行前、落地，每项写做什么、什么时候、去哪查",
                  "适合": "德、法、荷、北欧、意、西等欧洲国家的硕士和博士",
                  "输出": "最该做的 3 件事 + **当前阶段清单** + 后续阶段一览 + 该国注意事项 + 官方信息渠道",
                  "需要": "目标国家、所在阶段、读硕还是读博、是否带家属",
                  "注意": "**只覆盖欧洲**；不给具体金额，签证和资金要求以移民局官网为准",
              }),

        # 学习考试
        Skill(id="study-plan", name="学习计划",
              promise="按剩余天数和你的真实可用时间排计划，不排做不到的量",
              scene="exam", tags=["计划", "考研", "排期"],
              good_for=["考研倒计时", "期末周多科并行"],
              needs=["考试时间", "科目与每天可用时间"],
              users=100, rating=4.7,
              source_repo="course-builder", source_stars=17,
              source_origin="course-builder MIT 开源，研究驱动的课程生成器，按真实可用时间拆解学习任务",
              source_badge="按剩余天数排",
              recommend_reason="考试**日期定了、时间有限**时用：先判断来不来得及，再排能执行的计划",
              compare_dims={
                  "侧重": "**可执行**：先做可行性判断，按真实可用时间排量，并留出缓冲",
                  "适合": "考研倒计时、期末周多科并行",
                  "输出": "可行性判断 + 三阶段计划（含截止节点）+ 典型周安排 + 缓冲 + 进度检查点",
                  "需要": "考试时间、剩余天数、各科进度、每天可用时间",
                  "注意": "时间不够时会**直接建议取舍科目**，不会硬塞满计划",
              }),

        Skill(id="exam-forecast", name="真题规律分析",
              promise="把多份往年卷放在一起，找出考点权重、出题偏好和反复出现的陷阱，给出复习时间怎么分",
              scene="exam", tags=["真题", "往年卷", "考点", "复习规划"],
              good_for=["期末拿到同一老师的往年卷", "考研专业课分析真题", "考公、教资找题型规律"],
              needs=["往年试卷", "考试名称和形式"],
              users=100, rating=4.7,
              source_repo="anthropics/claude-for-legal", source_stars=0,
              source_origin="改写自 Anthropic 开源的 exam-forecast skill（Apache-2.0）：逐卷拆解、跨卷汇总、标注样本量",
              source_badge="分重点中等兜底",
              recommend_reason="手上有**几份往年卷**时用：找出稳定考点和老师偏爱的陷阱，按重点、中等、兜底分配复习时间，明说不是押题",
              compare_dims={
                  "侧重": "**出题方的规律**：稳定、可变和缺席三类规律，结合本学期考纲预估权重",
                  "适合": "期末同一老师的往年卷、考研专业课真题、考公考编找题型规律",
                  "输出": "样本说明 + 考点权重表 + 题型预判 + 老师偏爱和陷阱 + **复习时间分配**",
                  "需要": "往年试卷（至少 3 份更可靠）、考试名称和形式，有考纲更准",
                  "注意": "**不是押题**；只有 1-2 份时会明说规律可能是偶然",
              }),

        Skill(id="material-digest", name="资料总结",
              promise="把多份资料合并成一份不重复的要点集",
              scene="exam", tags=["总结", "合并"],
              good_for=["多本参考书交叉复习"],
              needs=["多个文件"],
              users=100, rating=4.6,
              source_repo="academic-research-skills", source_stars=50821,
              source_origin="academic-research-skills 学术研究全流程技能库，多文档去重合并，50.8k star",
              source_badge="标出矛盾",
              group="material-digest", variant_label="合并去重",
              recommend_reason="手上有**多份内容重叠的资料**时用：按主题合并去重，并标出资料之间的矛盾",
              compare_dims={
                  "侧重": "**多份合并去重**，交叉验证一致和矛盾的地方",
                  "适合": "多本参考书交叉复习、多份讲义合并",
                  "输出": "各份资料定位 + 按主题合并的要点（标来源）+ 交叉验证 + 按用途排重点 + 覆盖盲区",
                  "需要": "多份资料、用途",
                  "注意": "只有一份长文档时，用「PDF 与课件总结」更合适",
              }),

        Skill(id="material-frameworks", name="资料提炼框架",
              promise="不写摘要，把资料提炼成框架、原则、方法、误区和一张决策速查表",
              scene="exam", tags=["总结", "框架", "方法论", "读书"],
              good_for=["读方法论的书或讲义", "想把一本书的方法用起来", "准备要用到某套理论的面试或论文"],
              needs=["资料内容", "用途"],
              users=100, rating=4.7,
              source_repo="virgiliojr94/book-to-skill", source_stars=0,
              source_origin="改写自开源项目 book-to-skill（MIT）：提炼结构而不是写摘要，保留作者原有命名",
              source_badge="决策速查表",
              group="material-digest", variant_label="提炼框架",
              recommend_reason="读的是**方法论的书或讲义**、想以后直接拿来用时选：提炼成框架和「遇到 X 就做 Y」的速查表",
              compare_dims={
                  "侧重": "**可以直接用的知识**：框架、原则、方法、误区，保留作者原有命名，重点做决策速查表",
                  "适合": "方法论书籍、讲义、课程里的理论框架，想学以致用的时候",
                  "输出": "一句话核心 + 核心框架（何时用、怎么用）+ 原则 + 方法 + 误区 + **决策速查表** + 术语表",
                  "需要": "资料内容、用途",
                  "注意": "不按考点合并去重；**多份复习资料要合并成要点集**请用默认版",
              }),

        Skill(id="feynman-check", name="费曼自检",
              promise="你先用自己的话讲一遍，AI 指出哪里含糊、哪里循环定义、漏了哪一步，再出 5 道检验题",
              scene="exam", tags=["费曼学习法", "理解", "自测", "概念"],
              good_for=["背了定义但不确定懂没懂", "考前检验核心概念", "准备给同学讲题"],
              needs=["概念", "你自己的解释"],
              users=100, rating=4.7,
              source_repo="neurofoo/agent-skills", source_stars=0,
              source_origin="改写自开源项目 neurofoo/agent-skills 的 feynman（MIT），并采用 feynman-skill（MIT）的找漏洞和关键一问方法",
              source_badge="找出没懂的地方",
              recommend_reason="**背过但不确定真懂**时用：你先讲一遍，AI 逐句指出含糊、循环定义和漏掉的推理，再给检验题和参考讲解",
              compare_dims={
                  "侧重": "**检验理解**：逐句诊断你的解释，找出靠术语撑着和推理跳步的地方",
                  "适合": "核心概念考前自检、准备给别人讲、学完一章确认有没有懂",
                  "输出": "讲清楚的部分 + 问题对照表 + 缺失推理 + **5 道检验题** + 关键一问 + 参考讲解",
                  "需要": "概念名、你自己的解释（不翻书写）",
                  "注意": "检验题**不附答案**，先自己答；课程特有的定义以教材为准",
              }),

        Skill(id="mock-exam", name="模拟卷生成",
              promise="按科目和范围出一套分难度档的模拟卷，答案解析放在后面，附提分策略表",
              scene="exam", tags=["模拟卷", "自测", "期末", "出题"],
              good_for=["期末考前做一套模拟", "复习完一章想自测", "教资、考公基础题练习"],
              needs=["科目和考试", "考试范围", "难度"],
              users=100, rating=4.7,
              source_repo="yueheng-li/xixi-tutor", source_stars=0,
              source_origin="改写自开源项目「溪溪老师」xixi-tutor（README 声明 MIT）的梯度模拟卷与提分策略表",
              source_badge="答案后置",
              recommend_reason="**复习到一个阶段想自测**时用：按基础、提升、冲刺三档出一套 100 分的卷子，题目不编造出处，答案解析放在分隔线之后",
              compare_dims={
                  "侧重": "**分难度自测**：覆盖主要知识点，每题标分值，答案写清考点、步骤和常见错误",
                  "适合": "期末考前、章节复习后、教资考公的基础题练习",
                  "输出": "一套模拟卷 + 答案与解析（放在后面）+ **提分策略表**",
                  "需要": "科目和考试、考试范围、难度档，可写题型和时长",
                  "注意": "**不编造「某年某地原题」**，不确定的内容会标「待核实」",
              }),

        Skill(id="essay-grade", name="论述题批改",
              promise="对照题目批改你的论述题或材料分析题：要点漏了哪些、原理对不对、有没有结合材料",
              scene="exam", tags=["论述题", "材料分析", "主观题", "批改"],
              good_for=["考研政治分析题", "法硕、专业课论述题", "申论和教资简答"],
              needs=["题目", "你的答案", "科目"],
              users=100, rating=4.7,
              source_repo="anthropics/claude-for-legal", source_stars=0,
              source_origin="改写自 Anthropic 开源的 irac-practice skill（Apache-2.0）：只批改不代写，示范句换题演示",
              source_badge="只批不代写",
              recommend_reason="写完**主观题想知道丢分在哪**时用：逐项看要点覆盖、原理表述和材料结合，只给等级和最该改的三处，不给范文",
              compare_dims={
                  "侧重": "**结构化批改**：要点覆盖、原理准确度、是否把原理对应到材料、结构",
                  "适合": "考研政治、法硕、专业课论述题、申论、教资简答",
                  "输出": "要点覆盖 + 原理表述判断 + 材料结合检查 + 等级 + **最该改的 3 处** + 换题示范",
                  "需要": "题目、你的答案、科目，有参考答案批得更准",
                  "注意": "**不重写你的答案**；英语作文请用「英语作文批改」",
              }),

        Skill(id="english-essay-grade", name="英语作文批改",
              promise="按雅思、托福、四六级或考研英语的标准分项打分，逐句标注问题，再改写成高一档的版本对照",
              scene="exam", tags=["英语作文", "雅思", "托福", "四六级", "考研英语"],
              good_for=["雅思托福写作练习", "四六级和考研英语作文", "想知道离目标分差在哪"],
              needs=["考试类型", "题目", "你的作文", "目标分数"],
              users=100, rating=4.7,
              source_repo="liqianiiii/Awesome-ielts-claude-skills", source_stars=0,
              source_origin="改写自开源项目 Awesome-ielts-claude-skills 的 ielts-writing（MIT），并采用 ielts-writing-review-skills（MIT）的批改风格",
              source_badge="改写高一档",
              recommend_reason="写完**英语作文想提分**时用：先审题，再分项打分、逐句标注，最后改写成比当前高一档的版本，修改处都注明原因",
              compare_dims={
                  "侧重": "**看见差距**：保留你的论点和结构，只升级表达，每处修改都加粗并说明原因",
                  "适合": "雅思、托福、四六级、考研英语一和二的作文练习",
                  "输出": "审题和字数检查 + 分项评分 + 逐句标注 + **高一档改写对照** + 提分优先级",
                  "需要": "考试类型、题目、你的作文、目标分数",
                  "注意": "AI 评分通常**偏高约半分**，建议用官方样题或老师校准",
              }),

        Skill(id="speaking-stories", name="口语万能故事",
              promise="把题库话题分成 5 组，每组准备一个能套用的故事，附 Part 2 回答和 Part 3 追问",
              scene="exam", tags=["雅思口语", "口语素材", "托福口语", "Part 2"],
              good_for=["新一季口语题库出来后", "考前集中准备 Part 2", "自己的回答不够地道"],
              needs=["考试", "要准备的话题"],
              users=100, rating=4.7,
              source_repo="liqianiiii/Awesome-ielts-claude-skills", source_stars=0,
              source_origin="改写自开源项目 Awesome-ielts-claude-skills 的 ielts-speaking（MIT）：话题分组、万能故事、追问预测",
              source_badge="5 个故事覆盖题库",
              recommend_reason="**新一季题库出来**、要准备一堆口语话题时用：分成 5 组，每组一个能套用的故事，算出覆盖率，再给追问的回答框架",
              compare_dims={
                  "侧重": "**用最少准备覆盖最多话题**：一个故事套多个话题，素材口语化、能直接说",
                  "适合": "雅思口语换季、托福和四六级口语话题准备、升级自己的回答",
                  "输出": "话题分组和**覆盖映射表** + Part 2 回答（含时间分配和关键表达）+ Part 3 追问框架",
                  "需要": "考试类型、话题列表或单个话题，写上自己的真实经历更好",
                  "注意": "只生成素材，**不练发音**；没给经历时的示例故事要换成你自己的",
              }),

        Skill(id="mistake-book", name="错题整理",
              promise="把错题按知识点归类，标出你反复错的同一类问题",
              scene="exam", tags=["错题", "归因"],
              good_for=["刷完一套题后归档", "找出真正的薄弱点"],
              needs=["错题照片或文本"],
              users=100, rating=4.8,
              source_repo="tutor-skills", source_stars=0,
              source_origin="tutor-skills 开源，文档转 Obsidian 学习库，支持知识点聚类与错误归因",
              source_badge="错因统计",
              group="mistake-book", variant_label="找薄弱点",
              recommend_reason="**刷完题想知道薄弱点**时用：找出形式不同、本质相同的反复错误",
              compare_dims={
                  "侧重": "按知识点归类，揪出**反复错的同一类问题**",
                  "适合": "刷完一套题后归档、找出真正的薄弱点",
                  "输出": "知识点归类 + 反复错误类型 + 错因统计 + 前三优先的补法 + 做题习惯建议",
                  "需要": "错题文本、科目",
                  "注意": "错题最好**附上你当时的答案**，只有题目和正确答案时很难判断错因",
              }),

        Skill(id="mistake-cards", name="错题记忆卡片",
              promise="把错题和笔记拆成一卡一概念的问答卡，附分档复习节奏",
              scene="exam", tags=["错题", "记忆卡片", "复习", "背诵"],
              good_for=["考前要背的公式和概念", "错过的题想反复刷", "把笔记变成自测题"],
              needs=["错题或笔记", "科目"],
              users=100, rating=4.7,
              source_repo="anthropics/claude-for-legal", source_stars=0,
              source_origin="改写自 Anthropic 开源的 flashcards skill（Apache-2.0）：一卡一概念、不凑数，附分档复习节奏",
              source_badge="附复习节奏",
              group="mistake-book", variant_label="记忆卡片",
              recommend_reason="**知识点要背下来**时选：一卡一概念，正面是问题、背面是结论，考前反复刷",
              compare_dims={
                  "侧重": "**记忆和自测**：一张卡只考一个概念，易混点单独写，按答题情况分档复习",
                  "适合": "考前背公式和概念、错题反复刷、把笔记变成自测题",
                  "输出": "问答卡片（问 / 答 / 出处 / 易混点）+ 分档复习节奏表",
                  "需要": "错题或笔记、科目",
                  "注意": "**不分析错因**；要找出反复错的根源请用默认版。复习进度需要你自己记",
              }),
    ]

    return skills


if __name__ == "__main__":
    # 简单测试
    print("Skill 检索系统模块已加载")
    print("请使用 test_retrieval.py 进行完整测试")
