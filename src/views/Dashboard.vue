<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import request from '../utils/request'
import { ElMessage } from 'element-plus'
import { DataLine, Files, Coin } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)

const d1Databases = ref<any[]>([])
const kvNamespaces = ref<any[]>([])
const r2Buckets = ref<any[]>([])

const fetchDashboardData = async () => {
  const accountId = authStore.accountId
  if (!accountId) return

  loading.value = true
  try {
    const [d1Res, kvRes, r2Res] = await Promise.allSettled([
      // D1 API
      request.get(`/accounts/${accountId}/d1/database`),
      // KV API
      request.get(`/accounts/${accountId}/storage/kv/namespaces`),
      // R2 API
      request.get(`/accounts/${accountId}/r2/buckets`)
    ])

    if (d1Res.status === 'fulfilled') {
      d1Databases.value = (d1Res.value as any).result || []
    } else {
      console.warn('Failed to fetch D1', d1Res.reason)
    }

    if (kvRes.status === 'fulfilled') {
      kvNamespaces.value = (kvRes.value as any).result || []
    } else {
      console.warn('Failed to fetch KV', kvRes.reason)
    }

    if (r2Res.status === 'fulfilled') {
      r2Buckets.value = (r2Res.value as any).result || []
    } else {
      console.warn('Failed to fetch R2', r2Res.reason)
    }
  } catch (error) {
    ElMessage.error('Failed to load dashboard data.')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
})

const navigateToItem = (type: string, id: string) => {
  router.push(`/${type}/${id}`)
}
</script>

<template>
  <div class="h-full bg-slate-50 dark:bg-slate-900 p-6 md:p-8">
    <div class="max-w-7xl mx-auto space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Overview</h1>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            View and manage resources in your Cloudflare account.
          </p>
        </div>
        <el-button @click="fetchDashboardData" :loading="loading" :icon="'Refresh'" circle size="large" />
      </div>

      <!-- Dashboard Grid -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <el-skeleton v-for="i in 3" :key="i" animated class="h-64 rounded-xl" />
      </div>

      <div v-else class="space-y-8">

        <!-- D1 Block -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <el-icon :size="24" color="#f97316">
              <Coin />
            </el-icon>
            <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">D1 Databases</h2>
            <el-tag size="small" type="warning" class="ml-2 font-mono" round>{{ d1Databases.length }}</el-tag>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-if="d1Databases.length === 0"
              class="col-span-full py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No D1 databases found.
            </div>
            <div v-for="db in d1Databases" :key="db.uuid" @click="navigateToItem('d1', db.uuid)"
              class="group cursor-pointer bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-orange-500/50 transition-all duration-200 flex flex-col justify-between h-32">
              <div>
                <h3
                  class="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-orange-500 transition-colors truncate"
                  :title="db.name">{{ db.name }}</h3>
                <p class="text-xs text-slate-500 mt-1 font-mono truncate" :title="db.uuid">{{ db.uuid }}</p>
              </div>
              <div class="flex justify-between items-center text-xs text-slate-400">
                <span>{{ db.version }}</span>
                <span
                  class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-orange-500">
                  Manage <el-icon>
                    <ArrowRight />
                  </el-icon>
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- KV Block -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <el-icon :size="24" color="#10b981">
              <DataLine />
            </el-icon>
            <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">KV Namespaces</h2>
            <el-tag size="small" type="success" class="ml-2 font-mono" round>{{ kvNamespaces.length }}</el-tag>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-if="kvNamespaces.length === 0"
              class="col-span-full py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No KV namespaces found.
            </div>
            <div v-for="kv in kvNamespaces" :key="kv.id" @click="navigateToItem('kv', kv.id)"
              class="group cursor-pointer bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all duration-200 flex flex-col justify-between h-32">
              <div>
                <h3
                  class="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-500 transition-colors truncate"
                  :title="kv.title">{{ kv.title }}</h3>
                <p class="text-xs text-slate-500 mt-1 font-mono truncate" :title="kv.id">{{ kv.id }}</p>
              </div>
              <div class="flex justify-end items-center text-xs text-slate-400">
                <span
                  class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-emerald-500">
                  Manage Keys <el-icon>
                    <ArrowRight />
                  </el-icon>
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- R2 Block -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <el-icon :size="24" color="#3b82f6">
              <Files />
            </el-icon>
            <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">R2 Buckets</h2>
            <el-tag size="small" type="primary" class="ml-2 font-mono" round>{{ r2Buckets.length }}</el-tag>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-if="r2Buckets.length === 0"
              class="col-span-full py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No R2 buckets found.
            </div>
            <div v-for="r2 in r2Buckets" :key="r2.name" @click="navigateToItem('r2', r2.name)"
              class="group cursor-pointer bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-500/50 transition-all duration-200 flex flex-col justify-between h-32">
              <div>
                <h3
                  class="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-500 transition-colors truncate"
                  :title="r2.name">{{ r2.name }}</h3>
                <p class="text-xs text-slate-500 mt-1">Location: {{ r2.location || 'auto' }}</p>
              </div>
              <div class="flex justify-between items-center text-xs text-slate-400">
                <span>Created: {{ new Date(r2.creation_date).toLocaleDateString() }}</span>
                <span
                  class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-blue-500">
                  Browse <el-icon>
                    <ArrowRight />
                  </el-icon>
                </span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  </div>
</template>
