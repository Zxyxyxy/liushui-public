<script setup lang="ts">
import Placeholder from '../components/ui/Placeholder.vue'
import StatusChip from '../components/ui/StatusChip.vue'
import { BADGE_STYLE, CREATORS } from '../data/creators'
import { fmt } from '../lib/fmt'
</script>

<template>
  <Placeholder title="创作者列表" sub="与前台同名同 id。只读，结算在「月度结算」">
    <div class="t-wrap">
      <table class="t">
        <thead>
          <tr>
            <th>创作者</th>
            <th>类型</th>
            <th class="text-right">工具数</th>
            <th class="text-right">月活用户</th>
            <th>参与补贴</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in CREATORS" :key="c.id">
            <td>
              <div class="flex items-center gap-2.5">
                <span class="text-base leading-none">{{ c.avatar }}</span>
                <div>
                  <p class="font-semibold text-ink-900">{{ c.name }}</p>
                  <p class="text-[11px] text-ink-300">
                    <span class="mono">{{ c.id }}</span>
                  </p>
                </div>
              </div>
            </td>
            <td>
              <span class="chip !py-0.5 !text-[10px]" :class="BADGE_STYLE[c.badge.kind]">{{ c.badge.label }}</span>
            </td>
            <td class="num">{{ c.toolCount }}</td>
            <td class="num">{{ fmt(c.monthlyActiveUsers) }}</td>
            <td>
              <StatusChip
                :tone="c.id === 'official' ? 'muted' : 'ok'"
                :label="c.id === 'official' ? '平台自营，不参与' : '参与'"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Placeholder>
</template>
