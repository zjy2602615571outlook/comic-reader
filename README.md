# Comic Reader — 极简 PDF 漫画在线阅读器

无登录、单页面、支持流式加载与「摸鱼」伪装的 PDF 漫画阅读器。
后端 FastAPI（只读流式 + Range），前端 React 18 + Vite + Tailwind + pdfjs-dist，前端经 Cloudflare Worker 反代交付。

## 架构

```
浏览器  ──https──>  Cloudflare Worker (comic-reader-web)  ──/api/*──>  FastAPI (容器 127.0.0.1:9002)
                          └─ ASSETS: ./dist (SPA)                              └─ /app/comics/*.pdf (只读挂载)
```

- 容器内端口 `8999`，宿主机映射 `9002`，与 `8999/9000` 零冲突。
- 无数据库、无 Redis，仅一个 FastAPI 容器。
- 共用宿主机 systemd `cloudflared` 隧道，不含隧道容器。

## 目录

| 用途 | 路径 |
| --- | --- |
| Dockge Stack / 构建目录 | `/home/zjy/datas/build/comic-reader/` |
| PDF 漫画存储（宿主机，只读挂载） | `/home/zjy/datas/dockerdatas/comic-reader/comics/` |
| 应用缓存数据（可写） | `/home/zjy/datas/dockerdatas/comic-reader/appdata/` |

## 后端 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | `{"status":"ok"}` |
| `GET` | `/api/comics` | 递归扫描 `/app/comics`，返回 PDF 列表（path/name/size/modified/dir） |
| `GET` | `/api/comics/stream?path=<相对路径>` | 流式返回 PDF，原生支持 HTTP Range（前端按页/分段加载） |

安全：免登录；`x-client-platform` 软校验默认放行 `web`（可经 `ALLOWED_PLATFORMS` 配置）；CORS 全放行。

## 部署步骤

### 1. Cloudflare Zero Trust 新增 Public Hostname

- Subdomain: `comic`
- Domain: `26026155.xyz`
- Service: `HTTP -> 127.0.0.1:9002`

### 2. 宿主机创建目录并放入 PDF

```bash
mkdir -p /home/zjy/datas/dockerdatas/comic-reader/comics \
         /home/zjy/datas/dockerdatas/comic-reader/appdata \
         /home/zjy/datas/build/comic-reader

# 把 .pdf 漫画扔进 comics 目录（支持子目录递归）
cp /path/to/*.pdf /home/zjy/datas/dockerdatas/comic-reader/comics/
```

### 3. 拉取代码到构建目录

```bash
cd /home/zjy/datas/build/comic-reader
git clone https://github.com/zjy2602615571outlook/comic-reader.git .
```

### 4. 构建并启动后端容器

```bash
cd /home/zjy/datas/build/comic-reader
docker compose up -d --build
```

### 5. 发布前端到 Cloudflare Pages/Worker（可选，已配置反代）

前端构建后通过 `wrangler` 部署（需在 `frontend/` 配置 Cloudflare 账号）：

```bash
cd frontend
npm install
npm run build
npx wrangler deploy
```

`wrangler.toml` 中 `BACKEND_ORIGIN = "https://comic.26026155.xyz"` 指向上面隧道的公网域名。

### 6. 访问

打开 Worker 域名或 `https://comic.26026155.xyz` 即可直接阅读。

## 使用说明（前端快捷键）

| 键 | 功能 |
| --- | --- |
| `←` / `→` 或 `a` / `d` | 单页模式翻页 |
| `+` / `-` | 缩放 |
| `F` | 全屏切换 |
| `M` | 切换连续滚动 / 单页 |
| `L` | 显示 / 隐藏漫画列表 |
| `Esc` / `空格` | 一键「摸鱼」伪装（伪代码编辑器遮罩） |

- 阅读进度按漫画路径自动保存在 `localStorage`，再次打开自动恢复。
- 工具栏鼠标静止后自动隐藏，移入即现。
- PDF 经 Range 流式加载，大文件按需分段读取。
