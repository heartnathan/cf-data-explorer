<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import request from '../utils/request'
import { ElMessage } from 'element-plus'
import { Back, VideoPlay } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const databaseId = route.params.id as string

const loading = ref(false)
const tables = ref<string[]>([])
const activeTab = ref('tables')
const activeTable = ref('')

const tableData = ref<any[]>([])
const tableColumns = ref<string[]>([])
const tableLoading = ref(false)

const sqlQuery = ref('SELECT * FROM sqlite_schema;')
const sqlResult = ref<any[]>([])
const sqlColumns = ref<string[]>([])
const sqlLoading = ref(false)
const sqlMeta = ref<any>(null)

// 执行 D1 语法
const executeQuery = async (sql: string) => {
  const res: any = await request.post(`/accounts/${authStore.accountId}/d1/database/${databaseId}/query`, {
    sql
  })
  if (res.result && res.result[0]) {
    const data = res.result[0].results || []
    return {
      data,
      meta: res.result[0].meta,
      columns: data.length > 0 ? Object.keys(data[0]) : []
    }
  }
  return { data: [], columns: [], meta: null }
}

const fetchTables = async () => {
  if (!authStore.accountId) return
  loading.value = true
  try {
    const { data } = await executeQuery(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`)
    tables.value = data.map((t: any) => t.name)
    if (tables.value.length > 0 && !activeTable.value) {
      const firstTable = tables.value[0]
      if (firstTable) {
        activeTable.value = firstTable
        await loadTableData(activeTable.value)
      }
    }
  } catch (error) {
    ElMessage.error('Failed to load D1 tables.')
  } finally {
    loading.value = false
  }
}

const loadTableData = async (tableName: string) => {
  activeTable.value = tableName
  tableLoading.value = true
  try {
    const { data, columns } = await executeQuery(`SELECT * FROM "${tableName}" LIMIT 100`)
    tableData.value = data
    tableColumns.value = columns
  } catch (error) {
    ElMessage.error(`Failed to load data for table: ${tableName}`)
  } finally {
    tableLoading.value = false
  }
}

const runCustomSql = async () => {
  if (!sqlQuery.value.trim()) return
  sqlLoading.value = true
  sqlResult.value = []
  sqlColumns.value = []
  sqlMeta.value = null
  try {
    const { data, columns, meta } = await executeQuery(sqlQuery.value)
    sqlResult.value = data
    sqlColumns.value = columns
    sqlMeta.value = meta
    ElMessage.success('Query executed successfully')
  } catch (error: any) {
    ElMessage.error(`SQL Error: ${error?.response?.data?.errors?.[0]?.message || 'Unknown error'}`)
  } finally {
    sqlLoading.value = false
  }
}

onMounted(() => {
  if (databaseId) {
    fetchTables()
  }
})
</script>

<template>
  <div class="h-full bg-slate-50 dark:bg-slate-900 p-6 md:p-8 flex flex-col">
    <div class="max-w-7xl mx-auto w-full flex-1 flex flex-col">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-6">
        <el-button @click="router.push('/dashboard')" :icon="Back" circle />
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            D1 Database
          </h1>
          <p class="mt-1 text-sm text-slate-500 font-mono">{{ databaseId }}</p>
        </div>
      </div>

      <el-tabs v-model="activeTab"
        class="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-2">
        <!-- Tables Data Explorer -->
        <el-tab-pane label="Table Browser" name="tables" class="h-full flex flex-row">
          <div class="flex h-[calc(100vh-230px)] rounded-lg overflow-hidden w-full">
            <!-- Sidebar -->
            <div
              class="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col">
              <div
                class="p-3 font-semibold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-wider border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span>Tables</span>
                <el-button link size="small" @click="fetchTables" :loading="loading"
                  class="!p-0 text-slate-400 hover:text-orange-500">Refresh</el-button>
              </div>
              <div class="flex-1 overflow-y-auto w-full">
                <div v-if="loading && tables.length === 0" class="p-4 space-y-2">
                  <el-skeleton-item variant="text" class="h-8" v-for="i in 5" :key="i" />
                </div>
                <div v-else-if="tables.length === 0" class="p-4 text-sm text-slate-400 text-center">
                  No tables found
                </div>
                <div v-else v-for="table in tables" :key="table" @click="loadTableData(table)" :class="[
                  'px-4 py-3 text-sm cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/50 flex items-center font-mono',
                  activeTable === table ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-l-2 border-l-orange-500 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                ]">
                  <el-icon class="mr-2 opacity-50">
                    <Coin />
                  </el-icon>
                  {{ table }}
                </div>
              </div>
            </div>

            <!-- Main Data Area -->
            <div class="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 relative">
              <div
                class="p-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-950 z-10">
                <h3 class="font-medium text-slate-800 dark:text-slate-200 font-mono">
                  <span v-if="activeTable">SELECT * FROM "{{ activeTable }}" LIMIT 100</span>
                  <span v-else class="text-slate-400">Please select a table</span>
                </h3>
              </div>
              <div class="flex-1 overflow-hidden" v-if="activeTable">
                <el-table :data="tableData" v-loading="tableLoading" class="w-full" height="100%" stripe border>
                  <el-table-column v-for="col in tableColumns" :key="col" :prop="col" :label="col" min-width="150">
                    <template #default="{ row }">
                      <div class="truncate text-sm font-mono" :title="String(row[col])">{{ row[col] !== null ? row[col]
                        : 'NULL' }}</div>
                    </template>
                  </el-table-column>
                  <template #empty>
                    <div class="py-12 text-slate-400">No data found in this table.</div>
                  </template>
                </el-table>
              </div>
              <div v-else class="flex-1 flex items-center justify-center text-slate-400">
                <div class="text-center">
                  <el-icon :size="48" class="mb-4 opacity-50">
                    <Coin />
                  </el-icon>
                  <p>Select a table from the sidebar to view data</p>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- SQL Console -->
        <el-tab-pane label="SQL Console" name="console">
          <div
            class="flex flex-col h-[calc(100vh-230px)] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <!-- Editor block -->
            <div
              class="h-1/3 min-h-[150px] border-b border-slate-200 dark:border-slate-800 flex flex-col relative bg-slate-50 dark:bg-slate-900">
              <div
                class="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-medium">
                <span class="text-slate-600 dark:text-slate-300">Query Editor</span>
                <el-button type="primary" size="small" :icon="VideoPlay" :loading="sqlLoading" @click="runCustomSql">
                  Run Query (Cmd+Enter)
                </el-button>
              </div>
              <textarea v-model="sqlQuery" @keydown.meta.enter="runCustomSql" @keydown.ctrl.enter="runCustomSql"
                class="flex-1 w-full bg-transparent p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
                placeholder="Enter SQL here... e.g. SELECT * FROM users;"></textarea>
            </div>

            <!-- Results block -->
            <div class="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden relative">
              <div v-if="sqlMeta"
                class="px-4 py-2 text-xs border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 font-mono text-slate-500 whitespace-nowrap overflow-x-auto">
                <span class="text-green-600 dark:text-green-400 font-semibold mr-4">Success</span>
                <span class="mr-4">Rows read: {{ sqlMeta.rows_read }}</span>
                <span class="mr-4">Rows written: {{ sqlMeta.rows_written }}</span>
                <span>Time: {{ sqlMeta.duration }}ms</span>
              </div>

              <div class="flex-1 overflow-hidden">
                <el-table v-if="sqlColumns.length > 0" :data="sqlResult" v-loading="sqlLoading" class="w-full"
                  height="100%" stripe border size="small">
                  <el-table-column v-for="col in sqlColumns" :key="col" :prop="col" :label="col" min-width="120">
                    <template #default="{ row }">
                      <div class="truncate font-mono" :title="String(row[col])">{{ row[col] !== null ? row[col] : 'NULL'
                        }}</div>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-else-if="!sqlLoading && sqlMeta"
                  class="flex-1 h-full flex items-center justify-center text-slate-500 text-sm">
                  Query executed successfully, but returned no rows.
                </div>
                <div v-else-if="!sqlLoading && !sqlMeta"
                  class="flex-1 h-full flex items-center justify-center text-slate-400">
                  <div class="text-center">
                    <el-icon :size="48" class="mb-4 opacity-50">
                      <VideoPlay />
                    </el-icon>
                    <p>Enter SQL and run to see results</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped>
:deep(.el-tabs__content) {
  padding: 0 !important;
  height: calc(100% - 40px);
}
</style>
