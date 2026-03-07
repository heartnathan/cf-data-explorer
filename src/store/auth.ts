import { defineStore } from "pinia";

interface AuthState {
  accountId: string | null;
  token: string | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    accountId: localStorage.getItem("cf_account_id"),
    token: localStorage.getItem("cf_token"),
  }),

  getters: {
    isValid: (state): boolean => {
      return !!state.accountId && !!state.token;
    },
  },

  actions: {
    setCredentials(accountId: string, token: string) {
      this.accountId = accountId;
      this.token = token;
      localStorage.setItem("cf_account_id", accountId);
      localStorage.setItem("cf_token", token);
    },

    clearCredentials() {
      this.accountId = null;
      this.token = null;
      localStorage.removeItem("cf_account_id");
      localStorage.removeItem("cf_token");
    },
  },
});
