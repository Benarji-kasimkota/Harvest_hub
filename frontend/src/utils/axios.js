import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL ||
  (window.location.hostname.includes('github.dev')
    ? window.location.href.replace('-3000', '-5000').split('/').slice(0, 3).join('/')
    : 'http://localhost:5000');

const instance = axios.create({ baseURL, withCredentials: true });

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/api/auth/refresh') &&
      !original.url?.includes('/api/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return instance(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${baseURL}/api/auth/refresh`, {}, { withCredentials: true });
        const newToken = data.token;
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(data));
        instance.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return instance(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
