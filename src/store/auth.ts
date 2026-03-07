import { defineStore } from "pinia";

interface AuthState {
  accountId: string | null;
  email: string | null;
  apiKey: string | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    accountId: localStorage.getItem("cf_account_id"),
    email: localStorage.getItem("cf_email"),
    apiKey: localStorage.getItem("cf_api_key"),
  }),

  getters: {
    isValid: (state): boolean => {
      return !!state.accountId && !!state.email && !!state.apiKey;
    },
  },

  actions: {
    setCredentials(accountId: string, email: string, apiKey: string) {
      this.accountId = accountId;
      this.email = email;
      this.apiKey = apiKey;
      localStorage.setItem("cf_account_id", accountId);
      localStorage.setItem("cf_email", email);
      localStorage.setItem("cf_api_key", apiKey);
    },

    clearCredentials() {
      this.accountId = null;
      this.email = null;
      this.apiKey = null;
      localStorage.removeItem("cf_account_id");
      localStorage.removeItem("cf_email");
      localStorage.removeItem("cf_api_key");
    },
  },
});
