import axios from "axios";
import { useAuthStore } from "../store/auth";
import router from "../router";

const request = axios.create({
  baseURL: "/client/v4",
  timeout: 10000,
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 403) {
        // 凭证失效，清除 store 并跳转登录
        const authStore = useAuthStore();
        authStore.clearCredentials();
        router.push("/login");
      }
    }
    return Promise.reject(error);
  },
);

export default request;
