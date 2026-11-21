/**
 * Cloudflare Workers 静态资源入口。
 * 3D 页面直接由 assets 提供；这个 Worker 预留给将来把占座改成 Durable Object。
 * 目前 /ws 不会在 Workers 上运行，前端会自动退回单人模拟。
 */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
