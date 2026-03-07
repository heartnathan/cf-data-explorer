import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../store/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "Login",
      component: () => import("../views/Login.vue"),
    },
    {
      path: "/",
      redirect: "/dashboard",
    },
    {
      path: "/dashboard",
      name: "Dashboard",
      component: () => import("../views/Dashboard.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/kv/:id",
      name: "KVManager",
      component: () => import("../views/KVManager.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/d1/:id",
      name: "D1Manager",
      component: () => import("../views/D1Manager.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/r2/:id",
      name: "R2Manager",
      component: () => import("../views/R2Manager.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isValid) {
    next("/login");
  } else {
    next();
  }
});

export default router;
