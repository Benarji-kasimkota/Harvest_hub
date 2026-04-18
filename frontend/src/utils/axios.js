import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 
  (window.location.hostname.includes('github.dev') 
    ? window.location.href.replace('-3000', '-5000').split('/').slice(0,3).join('/')
    : 'http://localhost:5000');

const instance = axios.create({ baseURL });

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default instance;
