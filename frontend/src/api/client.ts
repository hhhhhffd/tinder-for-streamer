import axios from "axios";

/**
 * Pre-configured Axios instance for all API calls.
 *
 * - baseURL: reads from VITE_API_BASE_URL env var, falls back to "/api"
 * - withCredentials: sends httpOnly cookies for JWT auth
 * - Content-Type: JSON by default
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string || "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Response interceptor — handle 401 (expired/invalid token).
 *
 * Redirects to landing page ONLY for protected endpoints.
 * Skips redirect for:
 * - /auth/me (normal check for unauthenticated users)
 * - When already on the landing page (prevents infinite reload loop)
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const requestUrl = error.config?.url ?? "";
      const isAuthCheck = requestUrl.includes("/auth/me");
      const isOnLanding = window.location.pathname === "/";

      /* Only redirect for non-auth-check 401s and when not already on landing */
      if (!isAuthCheck && !isOnLanding) {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
