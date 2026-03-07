<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import request from '../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, VideoPlay, Download } from '@element-plus/icons-vue'

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

const currentPage = ref(1)
const pageSize = ref(50)
const totalRows = ref(0)

const editDialogVisible = ref(false)
const isAddingNew = ref(false)
const currentRow = ref<any>({})
const currentRowId = ref<number | null>(null)

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
        handleTableSelect(firstTable)
      }
    }
  } catch (error) {
    ElMessage.error('Failed to load D1 tables.')
  } finally {
    loading.value = false
  }
}

const handleTableSelect = (tableName: string) => {
  currentPage.value = 1
  loadTableData(tableName)
}

const loadTableData = async (tableName: string) => {
  activeTable.value = tableName
  tableLoading.value = true
  try {
    const { data: countData } = await executeQuery(`SELECT COUNT(*) as _count FROM "${tableName}"`)
    totalRows.value = countData[0]?._count || 0

    const offset = (currentPage.value - 1) * pageSize.value
    const { data, columns } = await executeQuery(`SELECT rowid as _rowid, * FROM "${tableName}" LIMIT ${pageSize.value} OFFSET ${offset}`)
    tableData.value = data
    // Hide _rowid from the visible columns
    tableColumns.value = columns.filter(c => c !== '_rowid')
  } catch (error) {
    ElMessage.error(`Failed to load data for table: ${tableName}`)
  } finally {
    tableLoading.value = false
  }
}

const handlePageChange = (val: number) => {
  currentPage.value = val
  loadTableData(activeTable.value)
}

const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
  loadTableData(activeTable.value)
}

const handleExport = async () => {
  if (!activeTable.value) return
  ElMessage.info('Fetching data for export...')
  try {
    const { data, columns } = await executeQuery(`SELECT * FROM "${activeTable.value}" LIMIT 50000`)
    if (data.length === 0) return ElMessage.warning('No data to export')

    // Build CSV
    const headers = columns.join(',')
    const rows = data.map((row: any) => {
      return columns.map(col => {
        let val = row[col]
        if (val === null || val === undefined) return ''
        val = String(val).replace(/"/g, '""')
        return `"${val}"`
      }).join(',')
    })
    const csvContent = [headers, ...rows].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.setAttribute('download', `${activeTable.value}_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    ElMessage.error('Failed to export data')
  }
}

const handleAddRow = () => {
  isAddingNew.value = true
  currentRow.value = {}
  tableColumns.value.forEach(col => {
    currentRow.value[col] = ''
  })
  editDialogVisible.value = true
}

const handleEditRow = (row: any) => {
  isAddingNew.value = false
  currentRowId.value = row._rowid
  // Deep copy without _rowid
  const copy = { ...row }
  delete copy._rowid
  currentRow.value = copy
  editDialogVisible.value = true
}

const handleCopyRow = (row: any) => {
  isAddingNew.value = true
  currentRowId.value = null
  // Deep copy without _rowid
  const copy = { ...row }
  delete copy._rowid
  currentRow.value = copy
  editDialogVisible.value = true
}

const handleDeleteRow = async (row: any) => {
  ElMessageBox.confirm(
    'Are you sure you want to delete this row?',
    'Delete Confirmation',
    {
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await executeQuery(`DELETE FROM "${activeTable.value}" WHERE rowid = ${row._rowid}`)
      ElMessage.success('Row deleted successfully')
      loadTableData(activeTable.value)
    } catch (error) {
      ElMessage.error('Failed to delete row')
    }
  }).catch(() => {
    // cancelled
  })
}

const confirmSaveRow = async () => {
  try {
    // Keep all columns except strictly undefined ones
    const cols = Object.keys(currentRow.value).filter(col => {
      // If the UI set it to an empty string while it's supposedly nullable, we might want to let it pass
      // or we just save everything returned by the form.
      return currentRow.value[col] !== undefined
    })

    const formatValue = (val: any) => {
      if (val === null || val === '') return 'NULL'
      if (typeof val === 'number' || typeof val === 'boolean') return val
      return `'${String(val).replace(/'/g, "''")}'`
    }

    if (isAddingNew.value) {
      if (cols.length === 0) return
      const colNames = cols.map(c => `"${c}"`).join(', ')
      const values = cols.map(c => formatValue(currentRow.value[c])).join(', ')
      await executeQuery(`INSERT INTO "${activeTable.value}" (${colNames}) VALUES (${values})`)
      ElMessage.success('Row added successfully')
    } else {
      if (cols.length === 0) return
      const setClause = cols.map(c => `"${c}" = ${formatValue(currentRow.value[c])}`).join(', ')
      await executeQuery(`UPDATE "${activeTable.value}" SET ${setClause} WHERE rowid = ${currentRowId.value}`)
      ElMessage.success('Row updated successfully')
    }
    editDialogVisible.value = false
    loadTableData(activeTable.value)
  } catch (error: any) {
    ElMessage.error('Failed to save row: ' + (error?.response?.data?.errors?.[0]?.message || 'Unknown syntax error'))
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
                <div v-else v-for="table in tables" :key="table" @click="handleTableSelect(table)" :class="[
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
                <h3 class="font-medium text-slate-800 dark:text-slate-200 font-mono text-sm truncate">
                  <span v-if="activeTable">SELECT * FROM "{{ activeTable }}"</span>
                  <span v-else class="text-slate-400">Please select a table</span>
                </h3>
                <div class="flex gap-2">
                  <el-button v-if="activeTable" size="small" :icon="Download" @click="handleExport">Export
                    CSV</el-button>
                  <el-button v-if="activeTable" type="primary" size="small" @click="handleAddRow">Add Row</el-button>
                </div>
              </div>
              <div class="flex-1 overflow-hidden flex flex-col" v-if="activeTable">
                <el-table :data="tableData" v-loading="tableLoading" class="w-full flex-1" stripe border>
                  <el-table-column v-for="col in tableColumns" :key="col" :prop="col" :label="col" min-width="150">
                    <template #default="{ row }">
                      <div class="truncate text-sm font-mono" :title="String(row[col])">{{ row[col] !== null ? row[col]
                        : 'NULL' }}</div>
                    </template>
                  </el-table-column>
                  <el-table-column label="Actions" width="200" fixed="right" align="center">
                    <template #default="{ row }">
                      <el-button size="small" type="primary" link @click="handleEditRow(row)">Edit</el-button>
                      <el-button size="small" type="success" link @click="handleCopyRow(row)">Copy</el-button>
                      <el-button size="small" type="danger" link @click="handleDeleteRow(row)">Delete</el-button>
                    </template>
                  </el-table-column>
                  <template #empty>
                    <div class="py-12 text-slate-400">No data found in this table.</div>
                  </template>
                </el-table>
                <div
                  class="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-end">
                  <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
                    :page-sizes="[50, 100, 200, 500]" background layout="total, sizes, prev, pager, next, jumper"
                    :total="totalRows" @size-change="handleSizeChange" @current-change="handlePageChange" />
                </div>
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

    <!-- Edit/Add Row Dialog -->
    <el-dialog v-model="editDialogVisible" :title="isAddingNew ? 'Add New Row' : 'Edit Row'" width="600px">
      <el-form label-position="top">
        <el-form-item v-for="col in tableColumns" :key="col" :label="col">
          <el-input v-model="currentRow[col]" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editDialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="confirmSaveRow">Save</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
:deep(.el-tabs__content) {
  padding: 0 !important;
  height: calc(100% - 40px);
}
</style>
