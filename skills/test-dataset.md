# 流水平台 Skill 检索测试数据集

## 数据集说明

- **总计**: 60 条测试用例
- **分类**: Easy (30条) / Medium (20条) / Hard (10条)
- **覆盖**: 4 个场景（学习提效、求职实习、留学申请、学习考试）
- **用途**: 评估 query → skill 匹配准确率

---

## Easy 级别（明确意图，30条）

### 学习提效场景（10条）

```json
[
  {
    "id": "easy_001",
    "query": "我要做一个关于人工智能的课程汇报PPT",
    "intent": "学习提效",
    "ground_truth": ["ppt-outline"],
    "difficulty": "easy",
    "tags": ["PPT", "课程汇报"]
  },
  {
    "id": "easy_002",
    "query": "这个Excel公式看不懂什么意思",
    "intent": "学习提效",
    "ground_truth": ["excel-formula"],
    "difficulty": "easy",
    "tags": ["Excel", "公式"]
  },
  {
    "id": "easy_003",
    "query": "帮我把这个PDF课件总结一下",
    "intent": "学习提效",
    "ground_truth": ["pdf-digest"],
    "difficulty": "easy",
    "tags": ["PDF", "总结"]
  },
  {
    "id": "easy_004",
    "query": "需要生成一个Excel表格记录社团经费",
    "intent": "学习提效",
    "ground_truth": ["excel-build"],
    "difficulty": "easy",
    "tags": ["Excel", "表格生成"]
  },
  {
    "id": "easy_005",
    "query": "课堂笔记太乱了想整理一下",
    "intent": "学习提效",
    "ground_truth": ["note-tidy"],
    "difficulty": "easy",
    "tags": ["笔记", "整理"]
  },
  {
    "id": "easy_006",
    "query": "英文论文写完了想润色一下",
    "intent": "学习提效",
    "ground_truth": ["en-polish"],
    "difficulty": "easy",
    "tags": ["英文", "润色"]
  },
  {
    "id": "easy_007",
    "query": "要做10分钟汇报，需要写讲稿",
    "intent": "学习提效",
    "ground_truth": ["report-script"],
    "difficulty": "easy",
    "tags": ["讲稿", "汇报"]
  },
  {
    "id": "easy_008",
    "query": "PPT做完了看看有没有问题",
    "intent": "学习提效",
    "ground_truth": ["ppt-review"],
    "difficulty": "easy",
    "tags": ["PPT", "审阅"]
  },
  {
    "id": "easy_009",
    "query": "这个Excel表格公式报错了找不到原因",
    "intent": "学习提效",
    "ground_truth": ["excel-formula"],
    "difficulty": "easy",
    "tags": ["Excel", "排错"]
  },
  {
    "id": "easy_010",
    "query": "老师的课件有50页想快速看懂重点",
    "intent": "学习提效",
    "ground_truth": ["pdf-digest"],
    "difficulty": "easy",
    "tags": ["PDF", "课件", "总结"]
  }
]
```

### 求职实习场景（10条）

```json
[
  {
    "id": "easy_011",
    "query": "帮我改简历",
    "intent": "求职实习",
    "ground_truth": ["resume-fix"],
    "difficulty": "easy",
    "tags": ["简历"]
  },
  {
    "id": "easy_012",
    "query": "看看我的简历和这个JD匹配度怎么样",
    "intent": "求职实习",
    "ground_truth": ["jd-match"],
    "difficulty": "easy",
    "tags": ["简历", "JD", "匹配"]
  },
  {
    "id": "easy_013",
    "query": "明天面试需要准备自我介绍",
    "intent": "求职实习",
    "ground_truth": ["self-intro"],
    "difficulty": "easy",
    "tags": ["面试", "自我介绍"]
  },
  {
    "id": "easy_014",
    "query": "预测一下面试可能会问什么问题",
    "intent": "求职实习",
    "ground_truth": ["interview-q"],
    "difficulty": "easy",
    "tags": ["面试", "问题预测"]
  },
  {
    "id": "easy_015",
    "query": "想练习一下模拟面试",
    "intent": "求职实习",
    "ground_truth": ["mock-interview"],
    "difficulty": "easy",
    "tags": ["模拟面试"]
  },
  {
    "id": "easy_016",
    "query": "刚面试完想复盘一下",
    "intent": "求职实习",
    "ground_truth": ["interview-review"],
    "difficulty": "easy",
    "tags": ["面试", "复盘"]
  },
  {
    "id": "easy_017",
    "query": "秋招投了很多公司想记录进度",
    "intent": "求职实习",
    "ground_truth": ["job-tracker"],
    "difficulty": "easy",
    "tags": ["秋招", "进度管理"]
  },
  {
    "id": "easy_018",
    "query": "简历需要针对产品经理岗位优化",
    "intent": "求职实习",
    "ground_truth": ["resume-fix", "jd-match"],
    "difficulty": "easy",
    "tags": ["简历", "优化", "岗位匹配"]
  },
  {
    "id": "easy_019",
    "query": "从简历里提取我的能力标签",
    "intent": "求职实习",
    "ground_truth": ["resume-extract"],
    "difficulty": "easy",
    "tags": ["简历", "标签提取"]
  },
  {
    "id": "easy_020",
    "query": "准备字节跳动的产品经理面试",
    "intent": "求职实习",
    "ground_truth": ["interview-q", "mock-interview", "self-intro"],
    "difficulty": "easy",
    "tags": ["面试", "准备"]
  }
]
```

### 留学申请场景（5条）

```json
[
  {
    "id": "easy_021",
    "query": "评估一下我的背景能申请什么学校",
    "intent": "留学申请",
    "ground_truth": ["bg-assess"],
    "difficulty": "easy",
    "tags": ["背景评估"]
  },
  {
    "id": "easy_022",
    "query": "帮我选校定位",
    "intent": "留学申请",
    "ground_truth": ["school-pick"],
    "difficulty": "easy",
    "tags": ["选校"]
  },
  {
    "id": "easy_023",
    "query": "文书初稿写完了想检查逻辑",
    "intent": "留学申请",
    "ground_truth": ["ps-diagnose"],
    "difficulty": "easy",
    "tags": ["文书", "诊断"]
  },
  {
    "id": "easy_024",
    "query": "完全不知道文书怎么写",
    "intent": "留学申请",
    "ground_truth": ["ps-draft"],
    "difficulty": "easy",
    "tags": ["文书", "初稿"]
  },
  {
    "id": "easy_025",
    "query": "对比一下UCL和Warwick的商业分析项目",
    "intent": "留学申请",
    "ground_truth": ["school-compare"],
    "difficulty": "easy",
    "tags": ["学校对比"]
  }
]
```

### 学习考试场景（5条）

```json
[
  {
    "id": "easy_026",
    "query": "距离考研还有3个月帮我排个学习计划",
    "intent": "学习考试",
    "ground_truth": ["study-plan"],
    "difficulty": "easy",
    "tags": ["学习计划", "考研"]
  },
  {
    "id": "easy_027",
    "query": "把这些错题整理归类一下",
    "intent": "学习考试",
    "ground_truth": ["mistake-book"],
    "difficulty": "easy",
    "tags": ["错题", "整理"]
  },
  {
    "id": "easy_028",
    "query": "三本参考书内容重复想合并总结",
    "intent": "学习考试",
    "ground_truth": ["material-digest"],
    "difficulty": "easy",
    "tags": ["资料", "总结"]
  },
  {
    "id": "easy_029",
    "query": "检查一下我的复习进度能不能按时刷完",
    "intent": "学习考试",
    "ground_truth": ["review-tracker"],
    "difficulty": "easy",
    "tags": ["进度", "复习"]
  },
  {
    "id": "easy_030",
    "query": "需要长期的学习规划和监督",
    "intent": "学习考试",
    "ground_truth": ["expert-planner"],
    "difficulty": "easy",
    "tags": ["规划师", "长期"]
  }
]
```

---

## Medium 级别（多工具候选，20条）

### 跨工具混合场景（20条）

```json
[
  {
    "id": "medium_001",
    "query": "明天要做课程汇报，从准备到讲稿都需要",
    "intent": "学习提效",
    "ground_truth": ["ppt-outline", "report-script", "ppt-review"],
    "difficulty": "medium",
    "tags": ["汇报", "工作流"],
    "notes": "可能匹配工作流 wf-course-report"
  },
  {
    "id": "medium_002",
    "query": "投递秋招需要完整准备",
    "intent": "求职实习",
    "ground_truth": ["resume-fix", "jd-match", "self-intro", "interview-q"],
    "difficulty": "medium",
    "tags": ["秋招", "完整准备"],
    "notes": "可能匹配工作流 wf-autumn"
  },
  {
    "id": "medium_003",
    "query": "英国商业分析专业申请材料准备",
    "intent": "留学申请",
    "ground_truth": ["school-pick", "ps-draft", "doc-checklist"],
    "difficulty": "medium",
    "tags": ["留学", "材料准备"]
  },
  {
    "id": "medium_004",
    "query": "帮我把这段英文改得更学术",
    "intent": "学习提效",
    "ground_truth": ["en-polish"],
    "difficulty": "medium",
    "tags": ["英文", "润色", "学术"],
    "notes": "可能与 ps-draft 混淆"
  },
  {
    "id": "medium_005",
    "query": "我的简历总是投了没回音",
    "intent": "求职实习",
    "ground_truth": ["resume-fix", "jd-match"],
    "difficulty": "medium",
    "tags": ["简历", "优化"],
    "notes": "隐含问题诊断需求"
  },
  {
    "id": "medium_006",
    "query": "不知道该申请什么专业",
    "intent": "留学申请",
    "ground_truth": ["major-match", "bg-assess"],
    "difficulty": "medium",
    "tags": ["专业", "定位"]
  },
  {
    "id": "medium_007",
    "query": "期末周要复习5门课",
    "intent": "学习考试",
    "ground_truth": ["study-plan", "material-digest"],
    "difficulty": "medium",
    "tags": ["期末", "多科目"]
  },
  {
    "id": "medium_008",
    "query": "社团招新需要做个宣讲PPT",
    "intent": "学习提效",
    "ground_truth": ["ppt-outline", "report-script"],
    "difficulty": "medium",
    "tags": ["PPT", "宣讲"]
  },
  {
    "id": "medium_009",
    "query": "面试腾讯产品经理岗位需要准备什么",
    "intent": "求职实习",
    "ground_truth": ["interview-q", "self-intro", "mock-interview"],
    "difficulty": "medium",
    "tags": ["面试", "准备", "具体公司"]
  },
  {
    "id": "medium_010",
    "query": "申请季要排时间线",
    "intent": "留学申请",
    "ground_truth": ["apply-timeline", "doc-checklist"],
    "difficulty": "medium",
    "tags": ["时间线", "规划"]
  },
  {
    "id": "medium_011",
    "query": "Excel表格需要自动计算公式",
    "intent": "学习提效",
    "ground_truth": ["excel-build", "excel-formula"],
    "difficulty": "medium",
    "tags": ["Excel", "公式"],
    "notes": "生成 vs 解释混淆"
  },
  {
    "id": "medium_012",
    "query": "把上课拍的照片笔记整理成文字",
    "intent": "学习提效",
    "ground_truth": ["note-tidy"],
    "difficulty": "medium",
    "tags": ["笔记", "OCR", "整理"]
  },
  {
    "id": "medium_013",
    "query": "简历和岗位要求差距在哪",
    "intent": "求职实习",
    "ground_truth": ["jd-match"],
    "difficulty": "medium",
    "tags": ["JD", "差距分析"]
  },
  {
    "id": "medium_014",
    "query": "GPA 3.4雅思7.0能申请英国什么学校",
    "intent": "留学申请",
    "ground_truth": ["bg-assess", "school-pick"],
    "difficulty": "medium",
    "tags": ["背景", "选校"]
  },
  {
    "id": "medium_015",
    "query": "考前刷题错了好多想分析原因",
    "intent": "学习考试",
    "ground_truth": ["mistake-book"],
    "difficulty": "medium",
    "tags": ["错题", "分析"]
  },
  {
    "id": "medium_016",
    "query": "个人陈述写了800字总觉得不对",
    "intent": "留学申请",
    "ground_truth": ["ps-diagnose"],
    "difficulty": "medium",
    "tags": ["文书", "诊断"]
  },
  {
    "id": "medium_017",
    "query": "要做数据分析作业需要Excel模板",
    "intent": "学习提效",
    "ground_truth": ["excel-build"],
    "difficulty": "medium",
    "tags": ["Excel", "数据分析"]
  },
  {
    "id": "medium_018",
    "query": "群面下周要参加想练习",
    "intent": "求职实习",
    "ground_truth": ["mock-interview", "self-intro"],
    "difficulty": "medium",
    "tags": ["群面", "练习"]
  },
  {
    "id": "medium_019",
    "query": "申请材料清单都需要准备什么",
    "intent": "留学申请",
    "ground_truth": ["doc-checklist"],
    "difficulty": "medium",
    "tags": ["材料", "清单"]
  },
  {
    "id": "medium_020",
    "query": "考研政治完全没开始怎么安排",
    "intent": "学习考试",
    "ground_truth": ["study-plan", "expert-planner"],
    "difficulty": "medium",
    "tags": ["考研", "计划", "零基础"]
  }
]
```

---

## Hard 级别（模糊意图，10条）

### 需要意图识别和上下文推理（10条）

```json
[
  {
    "id": "hard_001",
    "query": "马上要答辩了有点紧张",
    "intent": "学习提效",
    "ground_truth": ["ppt-review", "report-script", "ppt-outline"],
    "difficulty": "hard",
    "tags": ["答辩", "情绪性表达"],
    "notes": "需要推理出需要 PPT 和讲稿准备"
  },
  {
    "id": "hard_002",
    "query": "感觉自己条件一般不知道能不能出国",
    "intent": "留学申请",
    "ground_truth": ["bg-assess", "school-pick"],
    "difficulty": "hard",
    "tags": ["留学", "自我怀疑"],
    "notes": "情绪表达，需要评估 + 定位"
  },
  {
    "id": "hard_003",
    "query": "投了20家公司都石沉大海",
    "intent": "求职实习",
    "ground_truth": ["resume-fix", "jd-match"],
    "difficulty": "hard",
    "tags": ["求职", "问题诊断"],
    "notes": "隐含简历有问题"
  },
  {
    "id": "hard_004",
    "query": "下周presentation老师说要准备充分",
    "intent": "学习提效",
    "ground_truth": ["ppt-outline", "report-script", "ppt-review"],
    "difficulty": "hard",
    "tags": ["presentation", "模糊需求"]
  },
  {
    "id": "hard_005",
    "query": "想转专业但不知道方向",
    "intent": "留学申请",
    "ground_truth": ["major-match", "bg-assess"],
    "difficulty": "hard",
    "tags": ["转专业", "迷茫"]
  },
  {
    "id": "hard_006",
    "query": "复习进度落后了好焦虑",
    "intent": "学习考试",
    "ground_truth": ["review-tracker", "study-plan", "expert-planner"],
    "difficulty": "hard",
    "tags": ["复习", "进度", "情绪"],
    "notes": "需要进度检查 + 重新规划"
  },
  {
    "id": "hard_007",
    "query": "老板让我整个数据表格",
    "intent": "学习提效",
    "ground_truth": ["excel-build"],
    "difficulty": "hard",
    "tags": ["Excel", "口语化"],
    "notes": "口语表达：整 = 做"
  },
  {
    "id": "hard_008",
    "query": "HR面应该怎么准备",
    "intent": "求职实习",
    "ground_truth": ["interview-q", "self-intro"],
    "difficulty": "hard",
    "tags": ["HR面", "准备"],
    "notes": "需要识别面试轮次"
  },
  {
    "id": "hard_009",
    "query": "文书中介改完了我自己再看看",
    "intent": "留学申请",
    "ground_truth": ["ps-diagnose"],
    "difficulty": "hard",
    "tags": ["文书", "二次审阅"],
    "notes": "隐含需要逻辑检查而非重写"
  },
  {
    "id": "hard_010",
    "query": "这门课知识点太多了记不住",
    "intent": "学习考试",
    "ground_truth": ["material-digest", "note-tidy"],
    "difficulty": "hard",
    "tags": ["知识点", "记忆"],
    "notes": "需要总结 + 整理"
  }
]
```

---

## 数据集使用说明

### JSON 完整格式

```json
{
  "dataset_info": {
    "version": "1.0",
    "created_at": "2026-09-21",
    "total_cases": 60,
    "difficulty_distribution": {
      "easy": 30,
      "medium": 20,
      "hard": 10
    },
    "scene_distribution": {
      "study": 15,
      "job": 17,
      "abroad": 13,
      "exam": 15
    }
  },
  "test_cases": [
    // 上面所有 60 条数据合并到这里
  ]
}
```

### 评估方法

```javascript
// 计算指标
function evaluate(testCase, predictions) {
  const { ground_truth } = testCase;
  
  // Precision@1: Top-1 是否命中
  const p1 = ground_truth.includes(predictions[0]) ? 1 : 0;
  
  // Recall@3: Top-3 能否召回所有 ground_truth
  const top3 = predictions.slice(0, 3);
  const recalled = ground_truth.filter(gt => top3.includes(gt)).length;
  const r3 = recalled / ground_truth.length;
  
  // MRR: Mean Reciprocal Rank
  const ranks = ground_truth.map(gt => {
    const idx = predictions.indexOf(gt);
    return idx >= 0 ? 1 / (idx + 1) : 0;
  });
  const mrr = ranks.reduce((a, b) => a + b, 0) / ground_truth.length;
  
  return { p1, r3, mrr };
}
```

### 目标基准

| 难度 | Precision@1 目标 | Recall@3 目标 |
|------|-----------------|--------------|
| Easy | ≥ 85% | ≥ 95% |
| Medium | ≥ 70% | ≥ 90% |
| Hard | ≥ 50% | ≥ 80% |
| **Overall** | **≥ 70%** | **≥ 90%** |

---

## 扩展建议

### Bad Case 收集字段

实际运行中记录失败案例：

```json
{
  "id": "bad_001",
  "query": "...",
  "expected": ["skill-a"],
  "predicted": ["skill-b", "skill-c", "skill-d"],
  "reason": "多义词混淆",
  "fix": "添加同义词扩展"
}
```

### A/B 测试字段

```json
{
  "id": "ab_001",
  "query": "...",
  "variant_a": ["skill-1", "skill-2", "skill-3"],
  "variant_b": ["skill-2", "skill-1", "skill-4"],
  "user_clicked": "skill-2",
  "winner": "variant_b"
}
```

---

生成时间：2026-09-21
