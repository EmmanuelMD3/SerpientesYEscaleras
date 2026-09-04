import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { getSocket } from './services/socket';
import './styles.css';

getSocket();

createApp(App).use(router).mount('#app');
