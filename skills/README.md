# 流水学生 AI 平台 - Skill 资源库

本目录收集了适合学生场景的开源 Claude Code Skills，供参考和集成使用。

## 📋 已下载 Skills 清单

### 🎯 简历/求职类（对应"求职实习"场景）

| 项目 | 功能 | 对应前台工具 |
|------|------|-------------|
| **resume-builder-skill** | 哈佛标准 + ATS 优化简历生成 | `resume-fix`, `jd-match` |
| **resume-tailoring-skill** | AI 简历定制，针对 JD 优化 | `jd-match` |
| **resume-best-practices** | 简历优化 + ATS 评分 + XYZ 公式 | `resume-fix` |
| **resume-jd-match** | 简历与 JD 匹配分析 | `jd-match` |

### 📄 文档处理类（对应"学习提效"场景）

| 项目 | 功能 | 对应前台工具 |
|------|------|-------------|
| **claude-office-skills** | Office 文档创建编辑（Word/Excel/PPT） | `excel-build`, `excel-formula`, `ppt-outline` |
| **claude-skill-pdf** | Markdown → 专业 PDF，多模板 + 中文支持 | `pdf-digest`, 文档导出 |
| **markdown-converter.md** | PDF/Word/Excel/PPT → Markdown 转换 | `pdf-digest`, `note-tidy` |

### 📚 学习/笔记类（对应"学习考试"场景）

| 项目 | 功能 | 对应前台工具 |
|------|------|-------------|
| **tutor-skills** | PDF/文档 → Obsidian 学习库 + 测验 | `pdf-digest`, `note-tidy` |
| **agent-skills** | 文档处理 + 学习材料生成 + PDF 提取 | `material-digest`, `study-plan` |
| **course-builder** | 研究驱动的课程生成器 | `study-plan`, 学习路径规划 |

### ✍️ 写作/润色类（对应"留学申请"场景）

| 项目 | 功能 | 对应前台工具 |
|------|------|-------------|
| **essay-skills** | 专业论文写作和编辑 | `ps-draft`, `ps-diagnose`, `en-polish` |
| **claude-writing-skills** | 写作流程：大纲 → 初稿 → 编辑 → 润色 | `en-polish`, `report-script` |
| **academic-research-skills** | 学术研究全流程：研究 → 写作 → 审阅 → 修订 | `ps-diagnose`, 学术写作 |

### 🔧 综合工具集

| 项目 | 功能 | 特点 |
|------|------|------|
| **claude-code-skills** | 教育管理 + 文档处理 + 生产力自动化 | 多场景覆盖 |
| **ClaudeSkills** | 8 个生产级 skill：文档生成 + 生命周期管理 | 生产就绪 |

---

## 🎯 集成优先级建议

### P0（立即集成）
根据前台 mock 数据的用户量排序：

1. **claude-office-skills** - Excel/PPT 工具
   - 对应 `ppt-outline` (48,210 用户)
   - 对应 `excel-formula` (41,200 用户)
   - 对应 `excel-build` (27,400 用户)

2. **resume-builder-skill** - 简历修改
   - 对应 `resume-fix` (76,400 用户)
   - 对应 `jd-match` (58,700 用户)

3. **tutor-skills** - PDF 总结
   - 对应 `pdf-digest` (52,300 用户)

### P1（近期集成）

4. **claude-skill-pdf** - PDF 生成能力
5. **resume-best-practices** - 简历优化增强
6. **markdown-converter** - 文档格式转换

### P2（按需集成）

7. **essay-skills** - 文书写作（留学场景）
8. **course-builder** - 学习计划生成
9. **claude-writing-skills** - 润色工具增强

---

## 📊 前台工具覆盖情况

### 学习提效（study）
- ✅ `ppt-outline` → `claude-office-skills`
- ✅ `report-script` → `claude-writing-skills`
- ✅ `ppt-review` → 待定
- ✅ `excel-build` → `claude-office-skills`
- ✅ `excel-formula` → `claude-office-skills`
- ✅ `pdf-digest` → `tutor-skills` + `markdown-converter`
- ✅ `note-tidy` → `tutor-skills`
- ✅ `en-polish` → `claude-writing-skills` + `essay-skills`

### 求职实习（job）
- ✅ `resume-fix` → `resume-builder-skill` + `resume-best-practices`
- ✅ `jd-match` → `resume-tailoring-skill` + `resume-jd-match`
- ✅ `resume-extract` → `resume-builder-skill`
- ✅ `self-intro` → `resume-builder-skill`
- ✅ `interview-q` → 待定
- ⚠️ `mock-interview` → 需要多轮对话支持
- ⚠️ `job-tracker` → 需要数据持久化
- ⚠️ `interview-review` → 待定
- ⚠️ `wf-autumn` → 工作流类型

### 留学申请（abroad）
- ⚠️ `bg-assess` → 需要外部数据源
- ⚠️ `school-pick` → 需要外部数据源
- ⚠️ `school-compare` → 需要外部数据源
- ⚠️ `major-match` → 需要外部数据源
- ✅ `ps-diagnose` → `essay-skills` + `academic-research-skills`
- ✅ `ps-draft` → `essay-skills` + `claude-writing-skills`
- ⚠️ `apply-timeline` → 需要外部数据源
- ⚠️ `doc-checklist` → 需要外部数据源
- ⚠️ `expert-abroad` → 需要多轮对话支持

### 学习考试（exam）
- ✅ `study-plan` → `course-builder`
- ✅ `material-digest` → `agent-skills` + `tutor-skills`
- ✅ `mistake-book` → `tutor-skills`
- ⚠️ `review-tracker` → 需要数据持久化
- ⚠️ `expert-planner` → 需要多轮对话支持
- ⚠️ `wf-course-report` → 工作流类型

**覆盖率统计**：
- ✅ 可直接集成：16 个工具
- ⚠️ 需要额外开发：14 个工具（外部数据源/多轮对话/数据持久化/工作流）

---

## 🔗 相关资源

### Skill 资源库
- [rohitg00/awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit) - 最全工具包（135 agents + 35 skills）
- [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) - 精选 Claude Skills 列表

### 原始来源
所有 skill 均从 GitHub 公开仓库克隆，遵循各自开源协议。

---

## 📝 使用说明

### 如何集成一个 Skill

1. 查看目标 skill 的 `README.md` 了解功能和依赖
2. 检查是否有 `SKILL.md` 文件（Claude Code skill 标准格式）
3. 阅读安装说明和配置要求
4. 根据前台工具需求进行适配和集成

### 注意事项

- 部分 skill 需要外部 API（如学校数据库、招聘数据）
- 部分 skill 需要本地工具链（如 pandoc、LaTeX）
- 集成前需评估：功能匹配度、维护成本、依赖复杂度
- 遵循各 skill 的开源协议

---

最后更新：2026-09-21
