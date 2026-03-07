<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import request from '../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Edit, Delete, Plus, Search } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const namespaceId = route.params.id as string

const loading = ref(true)
const keysList = ref<any[]>([])
const searchKeyword = ref('')
const cursor = ref<string | null>(null)
const hasMore = ref(false)

const drawerVisible = ref(false)
const drawerType = ref<'add' | 'edit'>('add')
const drawerLoading = ref(false)
const formData = ref({
  key: '',
  value: ''
})

const fetchKeys = async (loadMore = false) => {
  if (!authStore.accountId) return
  if (!loadMore) {
    loading.value = true
    keysList.value = []
    cursor.value = null
  }

  try {
    const params: any = { limit: 50 }
    if (searchKeyword.value) params.prefix = searchKeyword.value
    if (cursor.value) params.cursor = cursor.value

    const res: any = await request.get(`/accounts/${authStore.accountId}/storage/kv/namespaces/${namespaceId}/keys`, { params })
    
    if (loadMore) {
      keysList.value.push(...(res.result || []))
    } else {
      keysList.value = res.result || []
    }
    
    cursor.value = res.result_info?.cursor || null
    hasMore.value = !!cursor.value
  } catch (error) {
    ElMessage.error('Failed to load KV namespace keys.')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchKeys()
}

const handleAdd = () => {
  drawerType.value = 'add'
  formData.value = { key: '', value: '' }
  drawerVisible.value = true
}

const handleEdit = async (row: any) => {
  drawerType.value = 'edit'
  formData.value.key = row.name
  formData.value.value = ''
  drawerVisible.value = true
  drawerLoading.value = true

  // Fetch the actual value
  try {
    const res: any = await request.get(`/accounts/${authStore.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(row.name)}`, {
      responseType: 'text'
    })
    
    // Attempt to stringify if it's parsed, otherwise use as is
    if (typeof res === 'object') {
      formData.value.value = JSON.stringify(res, null, 2)
    } else {
      formData.value.value = String(res)
    }
  } catch (error) {
    ElMessage.error('Failed to load Key value.')
  } finally {
    drawerLoading.value = false
  }
}

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`Are you sure you want to delete the key "${row.name}"?`, 'Warning', {
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    type: 'warning',
  }).then(async () => {
    try {
      await request.delete(`/accounts/${authStore.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(row.name)}`)
      ElMessage.success('Key deleted successfully.')
      fetchKeys()
    } catch (error) {
      ElMessage.error('Failed to delete key.')
    }
  }).catch(() => {})
}

const submitDrawer = async () => {
  if (!formData.value.key) {
    ElMessage.warning('Key name is required.')
    return
  }
  
  drawerLoading.value = true
  try {
    // Cloudflare KV values are sent as plain text or JSON payloads, using headers
    await request.put(`/accounts/${authStore.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(formData.value.key)}`, formData.value.value, {
      headers: {
        'Content-Type': 'text/plain' 
      }
    })
    
    ElMessage.success(drawerType.value === 'add' ? 'Key added successfully' : 'Key updated successfully')
    drawerVisible.value = false
    fetchKeys()
  } catch (error) {
    ElMessage.error('Failed to save KV data.')
  } finally {
    drawerLoading.value = false
  }
}

onMounted(() => {
  if (namespaceId) {
    fetchKeys()
  }
})
</script>

<template>
  <div class="h-full bg-slate-50 dark:bg-slate-900 p-6 md:p-8 flex flex-col">
    <div class="max-w-7xl mx-auto w-full flex-1 flex flex-col">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-8">
        <el-button @click="router.push('/dashboard')" :icon="Back" circle />
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            KV Namespace
          </h1>
          <p class="mt-1 text-sm text-slate-500 font-mono">{{ namespaceId }}</p>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
          <el-input 
            v-model="searchKeyword" 
            placeholder="Search by prefix..." 
            clearable 
            @clear="handleSearch"
            @keyup.enter="handleSearch"
            :prefix-icon="Search"
          >
            <template #append>
              <el-button @click="handleSearch">Search</el-button>
            </template>
          </el-input>
        </div>
        <el-button type="primary" :icon="Plus" @click="handleAdd">Add Key</el-button>
      </div>

      <!-- DataTable -->
      <div class="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col">
        <el-table :data="keysList" v-loading="loading" class="w-full" height="100%">
          <el-table-column prop="name" label="Key" min-width="250">
            <template #default="{ row }">
              <span class="font-mono text-sm text-slate-700 dark:text-slate-300 font-medium break-all">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Expiration" width="180">
            <template #default="{ row }">
              <span v-if="row.expiration" class="text-xs text-slate-500 font-mono">
                {{ new Date(row.expiration * 1000).toLocaleString() }}
              </span>
              <span v-else class="text-xs text-slate-400">Never</span>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="150" align="right">
            <template #default="{ row }">
              <el-button size="small" :icon="Edit" @click="handleEdit(row)" text type="primary">Edit</el-button>
              <el-button size="small" :icon="Delete" @click="handleDelete(row)" text type="danger">Delete</el-button>
            </template>
          </el-table-column>
          
          <template #empty>
            <div class="py-12 flex flex-col items-center justify-center text-slate-400">
              <el-icon :size="48" class="mb-4 opacity-50"><DataLine /></el-icon>
              <p>No keys found in this namespace.</p>
            </div>
          </template>
        </el-table>

        <div v-if="hasMore" class="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-center bg-slate-50 dark:bg-slate-900/50">
          <el-button :loading="loading" @click="fetchKeys(true)" plain>Load More</el-button>
        </div>
      </div>
    </div>

    <!-- Drawer for Edit / Add -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerType === 'add' ? 'Add New Key' : 'Edit Key'"
      direction="rtl"
      size="50%"
      :destroy-on-close="true"
    >
      <div class="p-6 h-full flex flex-col gap-6" v-loading="drawerLoading">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Key Name</label>
          <el-input v-model="formData.key" placeholder="e.g. settings:theme" :disabled="drawerType === 'edit'" font-mono />
        </div>
        
        <div class="flex-1 flex flex-col min-h-0">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex justify-between">
            <span>Value (Text / JSON)</span>
          </label>
          <el-input 
            v-model="formData.value" 
            type="textarea" 
            :rows="15" 
            placeholder="Enter value here..."
            class="font-mono text-sm h-full"
            resize="none"
          />
        </div>
        
        <div class="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <el-button @click="drawerVisible = false">Cancel</el-button>
          <el-button type="primary" @click="submitDrawer" :loading="drawerLoading">Save</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
:deep(.el-textarea__inner) {
  height: 100% !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
