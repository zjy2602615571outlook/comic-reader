# Comic Reader — 极简 PDF 漫画在线阅读器

无登录、单页面、支持流式加载与「摸鱼」伪装的 PDF 漫画阅读器。
后端 FastAPI（只读流式 + Range），前端 React 18 + Vite + Tailwind + pdfjs-dist，前端经 Cloudflare Worker 反代交付，后端经 Cloudflare Tunnel 暴露。**全部资源在一个 Cloudflare 账号下。**

## 实际部署架构（cc.cd 账号 `b6c8…320b`）

```
浏览器
  │ https://yuezvjktetzga.cc.cd
  ▼
Cloudflare Worker (comic-reader-web)         ← 前端 SPA(ASSETS) + /api 反代
  │ /api/*  → https://comic.yuezvjktetzga.cc.cd
  ▼
Cloudflare Tunnel (comic-backend, 041c3db5…)  ← CNAME comic.yuezvjktetzga.cc.cd → *.cfargotunnel.com
  │ ingress: comic.yuezvjktetzga.cc.cd → http://localhost:9002
  ▼
Ubuntu 192.168.0.120  容器 comic-reader-api (0.0.0.0:9002 → 容器 8999)
  └─ /app/comics/*.pdf (只读挂载)
```

- 前端 Worker：`yuezvjktetzga.cc.cd`（apex，AAAA `100::` proxied + Workers Route `yuezvjktetzga.cc.cd/*` → `comic-reader-web`）
- 后端隧道：账号内自建 tunnel `comic-backend`，ingress `comic.yuezvjktetzga.cc.cd → http://localhost:9002`，DNS CNAME `comic → 041c3db5….cfargotunnel.com`(proxied)
- 后端隧道连接器：Ubuntu 上**第二个** cloudflared systemd 服务 `cloudflared-comic-backend`（与原有的 26026155.xyz 隧道服务并存，互不影响）
- QUIC/UDP 7844 在该网络被阻断，隧道自动降级为 HTTP/2（TCP 443），正常工作。

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

安全：免登录；`x-client-platform` 软校验默认放行 `web`；CORS 全放行。

## 部署/复现步骤

### 后端容器（Ubuntu 192.168.0.120）

```bash
mkdir -p /home/zjy/datas/dockerdatas/comic-reader/comics \
         /home/zjy/datas/dockerdatas/comic-reader/appdata \
         /home/zjy/datas/build/comic-reader
cp /path/to/*.pdf /home/zjy/datas/dockerdatas/comic-reader/comics/   # 支持子目录递归

cd /home/zjy/datas/build/comic-reader
# 放入 docker-compose.yml + backend/ （从本仓库）
docker compose up -d --build
curl -f http://127.0.0.1:9002/health   # 期望 {"status":"ok"}
```

> 构建注意：本机 BuildKit 默认 DNS(8.8.8.8) 在国内被墙，`docker-compose.yml` 已设 `build.network: host` 使用宿主 DNS；`Dockerfile` 用阿里云 pip 镜像 `https://mirrors.aliyun.com/pypi/simple/`。

### 后端公网隧道（cc.cd 账号，已用 API 自动完成）

通过 Cloudflare API（`cfdomainapitoken`）完成，无需手动：
1. `POST /accounts/{acct}/cfd_tunnel` 创建 tunnel `comic-backend`
2. `PUT /accounts/{acct}/cfd_tunnel/{id}/configurations` 设 ingress `comic.yuezvjktetzga.cc.cd → http://localhost:9002`
3. `POST /zones/{zone}/dns_records` 建 CNAME `comic → {tunnel}.cfargotunnel.com`(proxied)
4. Ubuntu 上 systemd 服务 `cloudflared-comic-backend` 用 `--token <connector token>` 连接该隧道

### 前端 Worker（cc.cd 账号，已部署）

```bash
cd frontend
npm install && npm run build
CLOUDFLARE_API_TOKEN=…  CLOUDFLARE_ACCOUNT_ID=b6c8…320b  npx wrangler deploy
```

`wrangler.toml` 关键配置：
- `routes = [{ pattern = "yuezvjktetzga.cc.cd", custom_domain = true }]`（apex 绑定；实际由 route+DNS 完成）
- `[vars] BACKEND_ORIGIN = "https://comic.yuezvjktetzga.cc.cd"`
- `[assets] directory = "./dist", run_worker_first = true`

### 访问

打开 **https://yuezvjktetzga.cc.cd** 直接阅读。把 PDF 扔进 `/home/zjy/datas/dockerdatas/comic-reader/comics/` 后点前端「⟳」刷新即可。

## 使用说明（前端快捷键）

| 键 | 功能 |
| --- | --- |
| `←` / `→` 或 `a` / `d` | 单页模式翻页 |
| `+` / `-` 或 `Ctrl+滚轮` | 缩放 |
| `F` | 全屏切换 |
| `M` | 切换连续滚动 / 单页 |
| `L` | 显示 / 隐藏漫画列表 |
| `Esc` / `空格` | 一键「摸鱼」伪装（伪代码编辑器遮罩） |

- 阅读进度按漫画路径自动保存在 `localStorage`，再次打开自动恢复。
- 工具栏鼠标静止后自动隐藏，移入即现。
- PDF 经 Range 流式加载，大文件按需分段读取。
