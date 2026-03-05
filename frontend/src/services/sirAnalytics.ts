import { api } from "../config/api";

function buildUrl(path: string, params?: Record<string, string | number>) {
  const url = path.startsWith("/") ? path : `/${path}`;
  if (!params || Object.keys(params).length === 0) return url;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => search.set(k, String(v)));
  return `${url}?${search.toString()}`;
}

export const sirAnalytics = {
    runAnalysis: async (constituencyId: number) => {
        const response = await api.post(`/sir/analytics/run/${constituencyId}`);
        return response.data;
    },

    getHighRiskBooths: async (constituencyId: number, limit: number = 10) => {
        const response = await api.get(buildUrl(`/sir/analytics/high-risk/${constituencyId}`, { limit }));
        return response.data;
    },

    getValidationSample: async (constituencyId: number, samplePercent: number = 5.0) => {
        const response = await api.get(buildUrl(`/sir/analytics/validation-sample/${constituencyId}`, { sample_percent: samplePercent }));
        return response.data;
    }
};
