# SmartKey Frontend

React + TypeScript + Vite 前端工程。

## 开发

```bash
npm install
npm run dev
```

默认运行在 `http://127.0.0.1:5173`，并通过 Vite 代理把 `/api` 请求转发到本地后端。

## 环境变量

可选环境变量：

- `VITE_API_BASE_URL`：前端请求 API 的基础地址，默认是 `/api`
- `VITE_API_PROXY_TARGET`：本地开发时 Vite 代理目标，默认是 `http://localhost:3000`

建议优先从仓库根目录运行，使用统一脚本同时启动前后端。
