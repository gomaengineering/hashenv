import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login (unauthorized - not authenticated)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    // 403 errors (forbidden) are handled by components - don't redirect
    // These indicate access control restrictions, not authentication issues
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  register: async (data: { name: string; username: string; email: string; password: string }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  login: async (data: { email: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  verifyEmail: async (token: string) => {
    const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return response.data;
  },
  resendVerification: async (email: string) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },
  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
  resetPassword: async (token: string, password: string) => {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  },
};

// Projects API
export const projectsAPI = {
  list: async () => {
    const response = await api.get('/projects');
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },
  create: async (data: { name: string }) => {
    const response = await api.post('/projects', data);
    return response.data;
  },
  addMember: async (projectId: string, data: { userId: string; permission: 'read' | 'write' }) => {
    const response = await api.post(`/projects/${projectId}/members`, data);
    return response.data;
  },
  removeMember: async (projectId: string, userId: string) => {
    const response = await api.delete(`/projects/${projectId}/members/${userId}`);
    return response.data;
  },
  searchUsers: async (query: string, limit: number = 10) => {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const response = await api.get(`/projects/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data;
  },
  listUsers: async () => {
    const response = await api.get('/projects/users/list');
    return response.data;
  },
};

// Env Files API
export const envAPI = {
  upload: async (projectId: string, file: File, environment: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('environment', environment);
    
    const response = await api.post(`/projects/${projectId}/env`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  uploadText: async (projectId: string, content: string, environment: string) => {
    const response = await api.post(`/projects/${projectId}/env`, {
      content,
      environment,
    });
    return response.data;
  },
  download: async (projectId: string, environment: string, version?: number) => {
    const params = new URLSearchParams({ environment });
    if (version) {
      params.append('version', version.toString());
    }
    
    const response = await api.get(`/projects/${projectId}/env?${params.toString()}`, {
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '.env');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  edit: async (projectId: string, envFileId: string, content: string) => {
    const response = await api.put(`/projects/${projectId}/env/${envFileId}`, {
      content,
    });
    return response.data;
  },
  delete: async (projectId: string, envFileId: string) => {
    const response = await api.delete(`/projects/${projectId}/env/${envFileId}`);
    return response.data;
  },
  listVersions: async (projectId: string, environment?: string) => {
    const params = environment ? new URLSearchParams({ environment }) : '';
    const response = await api.get(`/projects/${projectId}/env/versions${params ? `?${params}` : ''}`);
    return response.data;
  },
  getFileContent: async (projectId: string, envFileId: string) => {
    const response = await api.get(`/projects/${projectId}/env/${envFileId}/content`);
    return response.data;
  },
  getLogs: async (projectId: string, environment?: string) => {
    const params = environment ? new URLSearchParams({ environment }) : '';
    const response = await api.get(`/projects/${projectId}/env/logs${params ? `?${params}` : ''}`);
    return response.data;
  },
  downloadLogs: async (projectId: string, environment?: string) => {
    const params = environment ? new URLSearchParams({ environment }) : '';
    const response = await api.get(`/projects/${projectId}/env/logs/download${params ? `?${params}` : ''}`, {
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hashenv-logs-${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

// Secrets API
export const secretsAPI = {
  list: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/secrets`);
    return response.data;
  },
  get: async (projectId: string, secretId: string) => {
    const response = await api.get(`/projects/${projectId}/secrets/${secretId}/content`);
    return response.data;
  },
  create: async (projectId: string, data: { name: string; content: string }) => {
    const response = await api.post(`/projects/${projectId}/secrets`, data);
    return response.data;
  },
  update: async (projectId: string, secretId: string, data: { name?: string; content?: string }) => {
    const response = await api.put(`/projects/${projectId}/secrets/${secretId}`, data);
    return response.data;
  },
  delete: async (projectId: string, secretId: string) => {
    const response = await api.delete(`/projects/${projectId}/secrets/${secretId}`);
    return response.data;
  },
};

// Settings API
export const settingsAPI = {
  get: async () => {
    const response = await api.get('/settings');
    return response.data;
  },
  update: async (data: { flushDuration?: number | null; panicButton?: { flushEnvs?: boolean; revokeCollaborators?: boolean; downloadEnvs?: boolean; askConfirmation?: boolean } }) => {
    const response = await api.put('/settings', data);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/settings/profile');
    return response.data;
  },
  updateProfile: async (data: { name?: string; username?: string }) => {
    const response = await api.put('/settings/profile', data);
    return response.data;
  },
  panic: async () => {
    const response = await api.post('/settings/panic');
    return response.data;
  },
};
