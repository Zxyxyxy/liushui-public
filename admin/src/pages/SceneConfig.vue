<script setup lang="ts">
import Placeholder from '../components/ui/Placeholder.vue'
import { SCENE_ACCENT, SCENE_ICON, SCENE_LABEL } from '../data/creators'

/** 四场景的中层配置，只读。
 *  「边界」这一栏是审核时判越界的依据 —— 工具审核里 sub-08 那条就是拿它判的。 */
const SCENES = [
  {
    id: 'study',
    boundary: '与在读课业直接相关的提效。不含代写作业、代考',
    entryFiles: ['课件 PDF', '论文', '课程表', '作业要求'],
    artifacts: ['paper.summary', 'paper.qa', 'weekly.report', 'note.outline'],
    depth: '偏深：已有 9 个工具，覆盖读—写—讲三段',
  },
  {
    id: 'job',
    boundary: '简历、JD、面试、实习过程。不含心理咨询与劳动仲裁',
    entryFiles: ['简历', 'JD', '面试记录', '实习评价'],
    artifacts: ['match.report', 'resume.draft', 'interview.checklist', 'offer.sheet'],
    depth: '最深：10 个工具，且是唯一接了真实 skill 的场景',
  },
  {
    id: 'abroad',
    boundary: '选校、文书、申请材料与时间线。不含签证代办与中介撮合',
    entryFiles: ['成绩单', '文书草稿', '推荐信', '语言成绩'],
    artifacts: ['school.list', 'essay.draft', 'apply.timeline', 'material.checklist'],
    depth: '9 个工具，重度依赖外部数据 —— 台账上过期的那两个都在这',
  },
  {
    id: 'exam',
    boundary: '备考计划、错题与真题分析。不含押题与答案分发',
    entryFiles: ['错题截图', '真题', '考试大纲'],
    artifacts: ['plan.timeline', 'error.list', 'exam.summary'],
    depth: '最薄：5 个工具。总览页上那根短柱子就是它',
  },
]
</script>

<template>
  <Placeholder title="场景配置" sub="四场景的边界与产出类型。只读">
    <div class="space-y-3">
      <article v-for="s in SCENES" :key="s.id" class="rounded-xl border border-water-100 bg-white/70 p-4">
        <div class="flex items-center gap-2">
          <span class="text-base leading-none">{{ SCENE_ICON[s.id] }}</span>
          <p class="text-[14px] font-bold" :style="{ color: SCENE_ACCENT[s.id] }">{{ SCENE_LABEL[s.id] }}</p>
          <span class="ml-auto text-[11px] text-ink-300">{{ s.depth }}</span>
        </div>

        <dl class="mt-2.5 space-y-1.5 text-[12px]">
          <div class="flex gap-2">
            <dt class="w-16 shrink-0 text-ink-400">边界</dt>
            <dd class="min-w-0 flex-1 text-ink-700">{{ s.boundary }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-16 shrink-0 text-ink-400">入口文件</dt>
            <dd class="min-w-0 flex-1 text-ink-600">{{ s.entryFiles.join('、') }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-16 shrink-0 text-ink-400">产出类型</dt>
            <dd class="min-w-0 flex-1">
              <span v-for="a in s.artifacts" :key="a" class="mono mr-1 mb-1 inline-block">{{ a }}</span>
            </dd>
          </div>
        </dl>
      </article>
    </div>

    <p class="note mt-4">「边界」不是文案，是审核依据。契约检查过不代表边界过，边界要人判。</p>
  </Placeholder>
</template>
