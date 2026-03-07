<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import request from '../utils/request'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const form = reactive({
  accountId: authStore.accountId || '',
  email: authStore.email || '',
  apiKey: authStore.apiKey || ''
})

const handleLogin = async () => {
  if (!form.accountId || !form.email || !form.apiKey) {
    ElMessage.warning('Please enter Account ID, Email, and Global API Key')
    return
  }

  loading.value = true
  try {
    // 探测接口验证有效性：尝试拉取 KV 命名空间列表作为探针
    await request.get(`/accounts/${form.accountId}/storage/kv/namespaces`, {
      headers: {
        'X-Auth-Email': form.email,
        'X-Auth-Key': form.apiKey
      }
    })

    // 验证成功
    authStore.setCredentials(form.accountId, form.email, form.apiKey)
    ElMessage.success('Authentication successful')
    router.push('/dashboard')
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.errors?.[0]?.message || 'Authentication failed. Please check your credentials.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
    <div
      class="w-full max-w-md bg-white dark:bg-slate-950 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <!-- Header -->
      <div class="p-8 pb-6 text-center border-b border-slate-100 dark:border-slate-800/50">
        <div
          class="w-16 h-16 mx-auto bg-gradient-to-br from-orange-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-4 items-center">
          <el-icon :size="32" color="white">
            <Cloudy />
          </el-icon>
        </div>
        <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">CF Data Explorer</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Manage D1, KV, and R2 seamlessly</p>
      </div>

      <!-- Form -->
      <div class="p-8 pb-10">
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Account ID</label>
            <el-input v-model="form.accountId" placeholder="e.g. 8a91b..." size="large" clearable
              :prefix-icon="'User'" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cloudflare Email</label>
            <el-input v-model="form.email" placeholder="name@example.com" size="large" clearable
              :prefix-icon="'Message'" />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">Global API Key</label>
              <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank"
                class="text-xs text-orange-500 hover:text-orange-600 font-medium">Get Key &rarr;</a>
            </div>
            <el-input v-model="form.apiKey" type="password" placeholder="Enter your Cloudflare Global API Key"
              size="large" show-password clearable :prefix-icon="'Key'" @keyup.enter="handleLogin" />
            <p class="text-xs text-slate-400 mt-2 leading-relaxed">
              Required: Account ID, Email, and Global API Key to manage Cloudflare resources
            </p>
          </div>

          <div class="pt-2">
            <el-button type="primary" size="large"
              class="w-full !rounded-lg !bg-orange-500 hover:!bg-orange-600 !border-none !h-12 text-base font-medium shadow-md shadow-orange-500/20"
              :loading="loading" @click="handleLogin">
              Connect to Cloudflare
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
