import { api } from "../config/api";

export const sirAnalytics = {
    runAnalysis: async (constituencyId: number) => {
        const response = await api.post(`/sir/analytics/run/${constituencyId}`);
        return response.data;
    },

    getHighRiskBooths: async (constituencyId: number, limit: number = 10) => {
        const response = await api.get(`/sir/analytics/high-risk/${constituencyId}`, {
            params: { limit }
        });
        return response.data;
    },

    getValidationSample: async (constituencyId: number, samplePercent: number = 5.0) => {
        const response = await api.get(`/sir/analytics/validation-sample/${constituencyId}`, {
            params: { sample_percent: samplePercent }
        });
        return response.data;
    }
};
