import { handleApi } from '../../server/router.js';
import { createGitHubStore } from '../../server/lib/github-store.js';

// Cloudflare Pages Functions：/api/* 全部交给统一路由处理
export async function onRequest(context) {
  return handleApi(context.request, context.env, createGitHubStore(context.env));
}
