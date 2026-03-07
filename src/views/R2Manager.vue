<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import request from '../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Folder, Document, UploadFilled, Delete, Picture } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const bucketName = route.params.id as string

const loading = ref(true)
const allObjects = ref<any[]>([])
const currentPrefix = ref('')

const uploadDialogVisible = ref(false)
const uploadFiles = ref<File[]>([])
const uploading = ref(false)

const currentPage = ref(1)
const pageSize = ref(50)

const currentObjects = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return allObjects.value.slice(start, start + pageSize.value)
})

const handlePageChange = (val: number) => {
  currentPage.value = val
}

const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
}

const breadcrumbs = computed(() => {
  const parts = currentPrefix.value.split('/').filter(Boolean)
  const crumbs = [{ label: bucketName, prefix: '' }]
  let current = ''
  for (const part of parts) {
    current += part + '/'
    crumbs.push({ label: part, prefix: current })
  }
  return crumbs
})

const fetchObjects = async () => {
  if (!authStore.accountId) return
  loading.value = true

  const folders = new Set<string>()
  const files: any[] = []

  try {
    let cursor = null
    let hasMore = true

    while (hasMore) {
      let url = `/accounts/${authStore.accountId}/r2/buckets/${bucketName}/objects?limit=1000`
      // Limit to current directory only
      if (currentPrefix.value) url += `&prefix=${encodeURIComponent(currentPrefix.value)}`
      url += `&delimiter=%2F`
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`

      const res: any = await request.get(url)

      // Files in current directory
      if (Array.isArray(res.result)) {
        res.result.forEach((f: any) => {
          let name = f.key
          if (currentPrefix.value && name.startsWith(currentPrefix.value)) {
            name = name.slice(currentPrefix.value.length)
          }
          if (name) {
            files.push({ ...f, isFolder: false, displayName: name })
          }
        })
      }

      // Extract Folders (delimited prefixes). The CF API returns them in result_info.delimited usually.
      const prefixes = res.result_info?.delimited || res.result_info?.delimited_prefixes || res.delimited_prefixes || res.delimitedPrefixes || []
      if (Array.isArray(prefixes)) {
        prefixes.forEach((p: string) => {
          let name = p
          if (currentPrefix.value && p.startsWith(currentPrefix.value)) name = p.slice(currentPrefix.value.length)
          if (name.endsWith('/')) name = name.slice(0, -1)
          if (name) folders.add(name)
        })
      }

      // Check for next page
      if (res.result_info?.is_truncated && res.result_info?.cursor) {
        cursor = res.result_info.cursor
      } else {
        hasMore = false
      }
    }

    // Sort and combine
    const folderList = Array.from(folders).sort().map(f => ({
      key: currentPrefix.value + f + '/',
      displayName: f,
      isFolder: true,
      size: 0,
      uploaded: ''
    }))

    allObjects.value = [...folderList, ...files.sort((a, b) => a.displayName.localeCompare(b.displayName))]
    currentPage.value = 1
  } catch (error) {
    ElMessage.error('Failed to load R2 directory.')
  } finally {
    loading.value = false
  }
}

const navigateTo = (prefix: string) => {
  currentPrefix.value = prefix
  fetchObjects()
}

const handleRowClick = (row: any) => {
  if (row.isFolder) {
    navigateTo(row.key)
  } else {
    // 若需要可展开抽屉看详情，此处简化
  }
}

const isImage = (fileName: string) => {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName)
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`Are you sure you want to delete "${row.displayName}"?`, 'Warning', {
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    type: 'warning',
  }).then(async () => {
    try {
      await request.delete(`/accounts/${authStore.accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(row.key)}`)
      ElMessage.success('Object deleted successfully.')
      fetchObjects()
    } catch (error) {
      ElMessage.error('Failed to delete object.')
    }
  }).catch(() => { })
}

// Upload Handler
const handleFileChange = (e: any) => {
  uploadFiles.value = Array.from(e.target.files)
}

const confirmUpload = async () => {
  if (uploadFiles.value.length === 0) return
  uploading.value = true

  try {
    for (const file of uploadFiles.value) {
      const fullPath = currentPrefix.value + file.name
      await request.put(`/accounts/${authStore.accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(fullPath)}`, file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        }
      })
    }
    ElMessage.success('All files uploaded successfully.')
    uploadDialogVisible.value = false
    uploadFiles.value = []
    fetchObjects()
  } catch (err) {
    ElMessage.error('Failed to upload some files.')
  } finally {
    uploading.value = false
  }
}

onMounted(() => {
  if (bucketName) {
    fetchObjects()
  }
})
</script>

<template>
  <div class="h-full bg-slate-50 dark:bg-slate-900 p-6 md:p-8 flex flex-col">
    <div class="max-w-7xl mx-auto w-full flex-1 flex flex-col">
      <!-- Header / Breadcrumbs -->
      <div class="flex items-center gap-4 mb-6">
        <el-button @click="router.push('/dashboard')" :icon="Back" circle />
        <div class="flex items-center gap-2 overflow-x-auto text-lg">
          <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.prefix">
            <span v-if="idx > 0" class="text-slate-400">/</span>
            <span @click="navigateTo(crumb.prefix)"
              class="cursor-pointer hover:text-blue-500 hover:underline transition-colors select-none font-medium"
              :class="idx === breadcrumbs.length - 1 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'">
              {{ crumb.label }}
            </span>
          </template>
        </div>
        <div class="ml-auto flex gap-3">
          <el-button @click="fetchObjects" :loading="loading" plain>Refresh</el-button>
          <el-button type="primary" :icon="UploadFilled" @click="uploadDialogVisible = true">Upload</el-button>
        </div>
      </div>

      <!-- File Browser -->
      <div
        class="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex-1 flex flex-col overflow-hidden">
        <el-table :data="currentObjects" v-loading="loading" class="w-full" height="100%"
          @row-dblclick="handleRowClick">
          <el-table-column label="Name" min-width="250">
            <template #default="{ row }">
              <div class="flex items-center gap-3 cursor-pointer select-none group" @click="handleRowClick(row)">
                <el-icon :size="20"
                  :color="row.isFolder ? '#eab308' : (isImage(row.displayName) ? '#10b981' : '#64748b')">
                  <Folder v-if="row.isFolder" />
                  <Picture v-else-if="isImage(row.displayName)" />
                  <Document v-else />
                </el-icon>
                <span class="font-medium group-hover:text-blue-500 transition-colors truncate"
                  :class="row.isFolder ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'">
                  {{ row.displayName }}
                </span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="Size" width="120">
            <template #default="{ row }">
              <span v-if="!row.isFolder" class="text-xs text-slate-500 font-mono">{{ formatSize(row.size) }}</span>
              <span v-else class="text-xs text-slate-400">-</span>
            </template>
          </el-table-column>

          <el-table-column label="Uploaded At" width="180">
            <template #default="{ row }">
              <span v-if="!row.isFolder" class="text-xs text-slate-500 font-mono">{{ new
                Date(row.uploaded).toLocaleString() }}</span>
              <span v-else class="text-xs text-slate-400">-</span>
            </template>
          </el-table-column>

          <el-table-column label="Actions" width="120" align="right">
            <template #default="{ row }">
              <el-button v-if="!row.isFolder" size="small" :icon="Delete" @click.stop="handleDelete(row)" text
                type="danger">Delete</el-button>
            </template>
          </el-table-column>

          <template #empty>
            <div class="py-20 flex flex-col items-center justify-center text-slate-400">
              <el-icon :size="64" class="mb-4 opacity-30">
                <Folder />
              </el-icon>
              <p>This directory is empty.</p>
            </div>
          </template>
        </el-table>
        <div class="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-end">
          <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
            :page-sizes="[50, 100, 200, 500]" background layout="total, sizes, prev, pager, next, jumper"
            :total="allObjects ? allObjects.length : 0" @size-change="handleSizeChange"
            @current-change="handlePageChange" />
        </div>
      </div>
    </div>

    <!-- Upload Dialog -->
    <el-dialog v-model="uploadDialogVisible" title="Upload Files" width="500px">
      <div class="p-4 pt-2 space-y-4 text-center">
        <label
          class="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50">
          <input type="file" class="hidden" multiple @change="handleFileChange" />
          <el-icon :size="32" class="text-blue-500 mb-2">
            <UploadFilled />
          </el-icon>
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Click to select files</span>
          <span class="text-xs text-slate-400 mt-1">Uploading to: <span class="font-mono text-blue-500">{{ bucketName
              }}/{{
                currentPrefix }}</span></span>
        </label>

        <div v-if="uploadFiles.length > 0"
          class="text-left mt-4 border border-slate-200 dark:border-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          <div v-for="f in uploadFiles" :key="f.name"
            class="flex justify-between items-center text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span class="font-mono truncate mr-2 text-slate-700 dark:text-slate-300">{{ f.name }}</span>
            <span class="text-xs text-slate-400 whitespace-nowrap">{{ formatSize(f.size) }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="uploadDialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="confirmUpload" :loading="uploading" :disabled="uploadFiles.length === 0">
            Confirm Upload
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>
