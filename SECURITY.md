# 安全

## 报告问题

请不要在公开 issue 里贴可利用细节、密钥或个人信息。优先使用 GitHub 的 **Security → Report a vulnerability**（Security Advisories）私下报告。

这是一个没有账号、没有聊天、没有支付的静态寺院 + 占座小服务，但它仍然欢迎安全审查。

## 范围

- `server.mjs` 的静态文件服务、WebSocket 占座和在线人数；
- 前端依赖与构建链；
- 可能导致他人无法进入、无法坐下、信息泄露或浏览器执行任意脚本的问题。

## 部署注意

- `server.mjs` 默认只监听 `127.0.0.1:5200`。如果要放到公网，请放在反向代理之后，并设置 `ALLOWED_ORIGINS`（逗号分隔）限制可连接的站点来源。
- 它没有账号体系，蒲团占座是匿名的：任何人都可以坐下、起身。不要把它当作需要身份认证的服务。
- 不要把 API Token、Cloudflare 证书、`.env` 或私钥提交到仓库。
- 生产环境建议使用命名隧道或受控的反向代理，而不是把开发服务器直接暴露到公网。

## 已知依赖提示

`ws@8.18.3` 存在上游 DoS 公告 [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)（微小分片导致内存耗尽），截至二〇二六年十一月没有可用修复版本。本项目已做以下缓解：

- WebSocket `maxPayload: 1024`，单条消息不能任意增长；
- `MAX_CLIENTS` 默认 200，可在环境变量里调低；
- `ALLOWED_ORIGINS` 限制浏览器来源；
- 建议在反向代理层加连接数/速率限制。

Dependabot 会在上游修复后提示升级。若你准备大规模公开部署，建议在代理层加限流，或改用受控的托管 WebSocket 服务。
