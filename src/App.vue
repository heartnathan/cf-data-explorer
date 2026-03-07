<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './store/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const isLoginPage = computed(() => route.name === 'Login')

const handleLogout = () => {
  authStore.clearCredentials()
  router.push('/login')
}
</script>

<template>
  <div class="h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
    <!-- Navbar -->
    <header v-if="!isLoginPage" class="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 flex items-center justify-between shrink-0 shadow-sm z-10">
      <div class="flex items-center gap-3">
        <div class="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-amber-500 flex items-center gap-2">
          <el-icon :size="20"><Platform /></el-icon>
          CF Explorer
        </div>
        
        <nav class="ml-6 flex items-center gap-1">
          <router-link to="/dashboard" custom v-slot="{ navigate, isActive }">
            <el-button :type="isActive ? 'primary' : ''" :plain="isActive" :text="!isActive" @click="navigate" size="small">
              Dashboard
            </el-button>
          </router-link>
        </nav>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="text-xs text-slate-500 max-w-[150px] truncate" :title="authStore.accountId || ''">
          ACC: {{ authStore.accountId }}
        </div>
        <el-button type="danger" plain size="small" @click="handleLogout">Logout</el-button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto w-full">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Custom Element Plus Overrides for Tailwind compatibility */
.el-drawer__body {
  padding: 0 !important;
}
.el-dialog__body {
  padding-top: 10px !important;
}
</style>
