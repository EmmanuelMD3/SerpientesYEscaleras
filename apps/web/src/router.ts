import { createRouter, createWebHistory } from 'vue-router';

import AdminView from './views/AdminView.vue';
import PlayerView from './views/PlayerView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/admin',
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
    },
    {
      path: '/play/:roomCode',
      name: 'play',
      component: PlayerView,
    },
  ],
});

export default router;
