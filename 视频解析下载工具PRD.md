# 视频解析下载工具 PRD

> 版本：v1.1 | 日期：2026-05-28 | 作者：Claude Code（v1.0 初稿 → v1.1 经技术调研后修订）

---

## 一、产品概述

### 1.1 产品定位

一个 Web 网页工具，用户粘贴抖音/快手/B站视频分享链接后，一键解析视频信息、下载无水印视频、获取 AI 语音转文字文案。

### 1.2 目标用户

- 有视频素材收集需求的自媒体创作者
- 需要提取视频文案的内容运营人员
- 普通用户（保存喜欢的视频、提取文字内容）

### 1.3 核心价值

将"找解析工具 → 下载视频 → 找转文字工具 → 提取音频 → 转文字"这一串操作，简化为**一个链接 → 全部搞定**。

---

## 二、功能需求

### 2.1 功能总览

```
用户粘贴链接 → 自动识别平台 → 解析视频信息 → 展示信息卡片
                                                    │
                                   ┌────────────────┼────────────────┐
                                   ▼                ▼                ▼
                              一键下载视频      一键复制标题      获取视频文案
                              (无水印直链)                      (语音转文字)
                                                                   │
                                                              一键复制文字
```

### 2.2 核心功能详述

#### F1：链接解析

| 项目 | 说明 |
|------|------|
| 入口 | 首页顶部输入框 + 解析按钮 |
| 支持平台 | 抖音、快手、哔哩哔哩 |
| 输入 | 各平台分享链接（如 `https://v.douyin.com/xxxx/`） |
| 输出 | 视频封面、标题、作者、无水印视频直链 |
| 实现 | 后端（Vercel API Routes）代理调用 BugPk-API 解析，解决浏览器直调 BugPk 的跨域（CORS）问题。BugPk 免费接口单 IP 限制约 50 次/小时 |
| 异常处理 | 链接无效提示"请检查链接格式"；平台不支持提示"暂不支持该平台"；接口超时/失败自动重试 3 次后提示"服务繁忙，请稍后重试" |

#### F2：信息卡片展示

| 项目 | 说明 |
|------|------|
| 内容 | 视频封面大图、标题、作者名、平台标识（抖音/快手/B站图标） |
| 交互 | 卡片从解析结果中渐入展示 |
| 响应式 | 桌面端与移动端均有良好体验 |

#### F3：一键下载视频

| 项目 | 说明 |
|------|------|
| 功能 | 点击按钮后浏览器触发视频文件下载，纯前端完成，不经过后端 |
| 实现 | 前端 `fetch(video_url, { referrerPolicy: 'no-referrer' })` 下载为 Blob，通过 `<a>` 标签触发下载。`referrerPolicy: 'no-referrer'` 用于绕过抖音/快手/B站 CDN 的 Referer 防盗链校验。文件较大（>200MB）时启用流式下载避免浏览器内存溢出 |
| 文件名 | `{平台}_{作者}_{标题}.mp4`（截取合理长度，过滤 Windows 文件名非法字符 `\ / : * ? " < > \|`） |
| 兼容性 | Safari 移动端 `referrerPolicy` 支持不完整，需后端提供备用代理下载端点 `GET /api/download?url=xxx` |

#### F4：一键复制标题

| 项目 | 说明 |
|------|------|
| 功能 | 点击按钮将视频标题复制到系统剪贴板 |
| 反馈 | 复制成功后按钮短暂变为"已复制"状态 |

#### F5：获取视频文案（语音转文字）

| 项目 | 说明 |
|------|------|
| 触发方式 | **默认不提取。** 信息卡片展示后，用户主动点击"获取视频文案"按钮才触发转写流程（懒加载） |
| 流程 | 点击提交 `POST /api/transcribe` → 后端立即返回 `task_id` → 后端异步执行（下载视频 → FFmpeg 提取音频 → 豆包 ASR 识别）：前端通过 `GET /api/transcribe/{task_id}` 轮询状态 |
| 展示 | 点击按钮后按钮下方展开文案区域，显示进度（"提取音频中..."→"语音识别中..."→完成），文案内容在文本框内显示 |
| 复制 | 文案完成后显示"一键复制文案"按钮 |
| 性能 | 短视频（≤1分钟）约 5-10 秒；中等视频（10 分钟）约 1-2 分钟（含 Render 0.1 CPU 的 FFmpeg 耗时） |
| 首次请求 | Render 免费层 15 分钟无流量后休眠，首个请求冷启动约 30-60 秒，前端需提示用户等待 |
| 时长建议 | 前端提示"建议 15 分钟以内的视频"，不设后端硬性限制 |
| 临时清理 | 处理完成后立即删除服务端临时文件 |
| 异常处理 | ASR 失败提示"文案提取失败，请重试"，不影响视频下载和标题复制功能 |
| 异步超时 | 整体任务超过 5 分钟未完成则标记失败，提示用户重试 |

### 2.3 不做（v1.0 范围外）

- 用户注册/登录
- 下载历史记录
- YouTube 等其他平台支持
- 批量链接解析
- 说话人分离
- 服务端视频永久存储
- 视频格式转换

---

## 三、技术方案

### 3.1 架构概览

```
┌──────────────────────────────────────────────────────────┐
│                      用户浏览器                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              React SPA (Vite)                        │ │
│  │  输入框 → 解析 → 信息卡片 → 下载/复制/获取文案         │ │
│  └────────────────────────┬─────────────────────────────┘ │
└───────────────────────────┼───────────────────────────────┘
                            │ HTTPS
        ┌───────────────────┼───────────────────┐
        ▼                                       ▼
┌───────────────────┐              ┌────────────────────────┐
│  Vercel（免费）     │              │  Render（免费）          │
│                   │              │                        │
│  React SPA 静态托管 │             │  FastAPI + FFmpeg       │
│  + API Routes     │              │                        │
│  (代理 BugPk 解析)  │             │  POST /api/transcribe   │
│                   │              │  GET  /api/transcribe/  │
│                   │              │        {task_id}        │
│                   │              │  GET  /api/health       │
│  永不休眠，即刻响应  │             │  15分钟无流量自动休眠     │
└───────────────────┘              └────────────────────────┘
```

### 3.2 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | SPA，Vite 构建 |
| UI 组件库 | Tailwind CSS + shadcn/ui | 现代化、响应式 |
| 状态管理 | React Hooks（useState/useReducer） | 场景简单，无需 Redux |
| HTTP 客户端 | axios | 请求后端 API |
| 后端框架 | FastAPI (Python 3.11+) | 异步支持好，自带 API 文档 |
| 视频解析 | BugPk-API | 免费，GET 请求，约 50 次/小时/IP；通过 Vercel API Routes 代理解决 CORS |
| 音频处理 | FFmpeg（subprocess 调用） | 提取音频为 MP3 格式 |
| 语音转文字 | 豆包录音文件识别极速版（火山引擎） | HTTP 同步 API（一次请求直接返回），资源 ID：`volc.bigasr.auc_turbo`（注：非 `volc.seedasr.auc`），端点：`openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash` |
| 前端部署 | Vercel | 静态托管 + API Routes，免费，自动部署，CDN 加速 |
| 后端部署 | Render | Web Service 免费方案（512MB RAM / 0.1 vCPU / 1GB 存储），Docker 部署，15 分钟无流量自动休眠 |

### 3.3 API 设计

#### 3.3.1 视频解析

```
POST /api/parse
Content-Type: application/json

Request:
{
  "url": "https://v.douyin.com/xxxx/"
}

Response 200:
{
  "code": 200,
  "data": {
    "platform": "douyin",        // douyin | kuaishou | bilibili
    "title": "视频标题",
    "author": "作者名称",
    "cover": "https://xxx.jpg",  // 封面图
    "video_url": "https://xxx.mp4"  // 无水印直链
  }
}

Response 400/500:
{
  "code": 400,
  "msg": "请检查链接格式 / 暂不支持该平台 / 服务繁忙，请稍后重试"
}
```

#### 3.3.2 语音转文字（异步模式）

因 Render 免费方案 0.1 CPU 处理较慢，且 HTTP 请求有超时限制，采用异步任务 + 轮询模式：

```
POST /api/transcribe
Content-Type: application/json

Request:
{
  "video_url": "https://xxx.mp4"  // 从解析结果获取
}

Response 202:
{
  "code": 202,
  "task_id": "uuid-string",
  "status": "pending"
}
```

```
GET /api/transcribe/{task_id}

Response 200（处理中）:
{
  "code": 200,
  "status": "processing",       // pending | processing | done | failed
  "stage": "extracting_audio",  // extracting_audio | transcribing
  "progress": "正在提取音频..."
}

Response 200（完成）:
{
  "code": 200,
  "status": "done",
  "data": {
    "text": "大家好，欢迎来到我的频道..."  // 纯文本，已分段加标点
  }
}

Response 200（失败）:
{
  "code": 200,
  "status": "failed",
  "msg": "文案提取失败，请重试"
}
```

```
GET /api/health

Response 200:
{
  "status": "ok"
}
```
前端轮询间隔：`processing` 状态每 2 秒轮询一次，超过 5 分钟未完成前端自动提示失败。

### 3.4 关键技术要点

#### 3.4.1 BugPk-API 调用（通过 Vercel API Routes 代理）

```
平台映射：
  抖音     → https://api.bugpk.com/api/douyin.php?url={url}
  快手     → https://api.bugpk.com/api/kuaishou.php?url={url}
  B站      → https://api.bugpk.com/api/bilibili.php?url={url}

返回字段：code, msg, data.author, data.title, data.cover, data.url
```

- **CORS 代理**：BugPk API 不返回 CORS 头，浏览器直调会被拦截。由 Vercel API Routes（Serverless Function）做代理转发
- **频率限制**：免费接口单 IP 约 50 次/小时，Vercel Serverless 出口 IP 不固定，实际频控上限可能高于 50 次
- **备选方案**：核心源码开源（GitHub: jiuhunwl/short_videos，PHP 8.0），如 BugPk 演示站不可用可自行部署

#### 3.4.2 FFmpeg 音频提取

```bash
ffmpeg -i input.mp4 -vn -acodec libmp3lame -b:a 64k -ar 16000 -ac 1 output.mp3 -y
```

- 格式：MP3 64kbps, 16kHz, 单声道（豆包 ASR 支持 WAV/MP3/OGG，MP3 体积小便于上传）
- Render 的 Docker 镜像需预装 FFmpeg：`apt-get install -y ffmpeg`
- 处理完后立即删除 input.mp4 和 output.mp3

#### 3.4.3 豆包 ASR 调用流程

- **接口类型**：同步接口，一次 HTTP POST 请求直接返回识别结果（无需提交→轮询）
- **端点**：`https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- **资源 ID**：`volc.bigasr.auc_turbo`（注意：不是 `volc.seedasr.auc`）
- **认证**：请求头携带 `X-Api-App-Key` 和 `X-Api-Access-Key`（火山引擎控制台获取）
- **限制**：最大音频时长 2 小时，最大文件 100MB（短视频场景完全够用，无需切片逻辑）
- **响应**：JSON 直接返回完整识别文本，已自动分段和添加标点
- **并发**：个人账户默认并发数较低（通常 3-5），本项目单用户串行调用无影响

#### 3.4.4 重试与降级策略

| 场景 | 策略 |
|------|------|
| BugPk 解析失败 | 自动重试 3 次，间隔 1s/2s/3s，全失败则提示用户 |
| 豆包 ASR 失败 | 自动重试 2 次，全失败则标记任务 failed |
| FFmpeg 提取失败 | 标记任务 failed，提示"音频提取失败" |
| 整体任务超时（>5 分钟） | 标记任务 failed，前端提示"处理超时，请重试" |
| 文案功能整体降级 | ASR/FFmpeg 失败不影响解析、下载、复制标题功能 |
| Render 冷启动 | 睡前首个请求需等 30-60 秒，前端在 ASR 按钮点击后检测响应延迟并提示"服务唤醒中，预计需要 30-60 秒..." |

#### 3.4.5 Render 异步任务架构

由于 Render 免费方案存在以下限制，文案提取采用后台异步处理 + 前端轮询：
- **HTTP 超时**：Render 对单次请求有约 100 秒超时限制，长视频处理（3-6 分钟）不能走同步模式
- **内存限制**：512MB RAM，FFmpeg 运行时不能同时处理多个任务
- **并发保护**：使用内存级任务队列（Python `asyncio.Queue` 或简单的 `dict` 存储任务状态），确保同一时间只有一个 FFmpeg 进程运行

```
前端                     Render 后端
  │                         │
  ├─ POST /api/transcribe ──→ 立即返回 202 + task_id
  │                         启动后台 asyncio Task:
  │                         ├─ 下载视频到临时文件
  │                         ├─ FFmpeg 提音频 (subprocess)
  │                         ├─ 豆包 ASR 识别 (httpx)
  │                         ├─ 删除临时文件
  │                         └─ 更新任务状态为 done/failed
  │                         │
  ├─ GET /api/transcribe/{id} → 返回当前状态 + 阶段
  │  (每 2s 轮询，直到 done/failed)
```

---

## 四、用户界面

### 4.1 整体布局

```
┌──────────────────────────────────────────────┐
│                🎬 视频解析下载                  │
│        粘贴链接，一键下载无水印视频与文案         │
│                                              │
│  ┌──────────────────────────────────┐        │
│  │  🔗 粘贴视频分享链接...     [ 解析 ]│        │
│  └──────────────────────────────────┘        │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  [平台标签: 抖音]                     │    │
│  │                                      │    │
│  │  ┌──────────────────────────────┐    │    │
│  │  │        🖼️ 视频封面大图         │    │    │
│  │  └──────────────────────────────┘    │    │
│  │                                      │    │
│  │  📹 视频标题文字                     │    │
│  │  👤 作者名                           │    │
│  │                                      │    │
│  │  ┌──────────┐ ┌──────────┐          │    │
│  │  │ ⬇ 下载视频 │ │ 📋 复制标题│          │    │
│  │  └──────────┘ └──────────┘          │    │
│  │                                      │    │
│  │  ┌──────────────────────────────┐    │    │
│  │  │ 🎙️ 获取视频文案 (点击后触发)     │    │    │
│  │  └──────────────────────────────┘    │    │
│  │                                      │    │
│  │  ← 默认隐藏，点击按钮后才展开 →       │    │
│  │  (处理进度："服务唤醒中..."→          │    │
│  │   "提取音频中..."→"语音识别中...")    │    │
│  │  ┌──────────────────────────────┐    │    │
│  │  │ 文案文本框 (识别完成后出现)    │    │    │
│  │  └──────────────────────────────┘    │    │
│  │  [ 📋 一键复制文案 ] (完成后显示)     │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 4.2 状态流转

```
初始状态 → 输入链接 → 点击解析 → Loading（解析中...）
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              解析成功          解析失败         超时
              展示卡片          错误提示        重试/提示
                    │
         用户点击"获取文案"
                    │
              POST /api/transcribe → 返回 task_id
                    │
              轮询 GET /api/transcribe/{task_id}
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    冷启动唤醒   音频提取中   语音识别中
    (等待30-60s)  (进度提示)   (进度提示)
         │          │          │
         └──────────┴──────────┘
                    │
              ┌─────┴─────┐
              ▼           ▼
          提取成功    提取失败
          展示文字    提示重试
          可复制
```

### 4.3 响应式断点

| 断点 | 布局 |
|------|------|
| ≥ 768px（桌面） | 卡片水平居中，最大宽度 640px |
| < 768px（移动） | 卡片全宽，左右留 16px 边距，按钮自适应 |

### 4.4 色彩与视觉

- 主色调：深色背景 + 毛玻璃卡片，偏工具感
- 平台色标识：抖音(黑+粉) / 快手(橙) / B站(蓝) 作为小标签色
- 按钮：圆角、清晰图标 + 文字
- 加载态：骨架屏或脉冲动画

---

## 五、项目结构

```
video-parser/
├── frontend/                    # React 前端
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── UrlInput.tsx      # 链接输入组件
│   │   │   ├── VideoCard.tsx     # 视频信息卡片
│   │   │   ├── TranscriptPanel.tsx # 文案展示面板
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorMessage.tsx
│   │   ├── hooks/
│   │   │   └── useVideoParser.ts # 核心解析逻辑 hook
│   │   ├── services/
│   │   │   └── api.ts            # axios 封装
│   │   ├── types/
│   │   │   └── index.ts          # TypeScript 类型定义
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css             # Tailwind 入口
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── main.py              # 应用入口
│   │   ├── routers/
│   │   │   ├── parse.py         # /api/parse 路由
│   │   │   └── transcribe.py    # /api/transcribe 路由
│   │   ├── services/
│   │   │   ├── parser.py        # BugPk 解析服务
│   │   │   └── asr.py           # FFmpeg + 豆包 ASR 服务
│   │   ├── utils/
│   │   │   ├── retry.py         # 重试装饰器
│   │   │   └── cleaner.py       # 临时文件清理
│   │   └── config.py            # 配置（API Key 等环境变量）
│   ├── requirements.txt
│   ├── Dockerfile
│   └── render.yaml              # Render 部署配置
│
└── README.md
```

---

## 六、部署方案

### 6.1 前端部署（Vercel）

1. 关联 GitHub 仓库
2. 设置 Framework: Vite，Root Directory: `frontend`
3. Vercel API Routes（`frontend/api/` 目录下的 Serverless Functions）自动代理 BugPk 解析请求，解决 CORS 问题
4. 环境变量：
   - `VITE_API_BASE_URL` → Render 后端地址（文案提取用）
   - `BUGPK_BASE_URL=https://api.bugpk.com/api`
5. 自动部署：git push → Vercel 自动构建发布
6. 费用：免费（静态托管 + Serverless Functions 均含慷慨免费额度）

### 6.2 后端部署（Render）

1. 关联 GitHub 仓库
2. 选择 Web Service，Root Directory: `backend`，类型：Docker
3. Render 免费方案配置：512 MB RAM / 0.1 vCPU / 1 GB 存储 / 750 小时/月
4. 注意：15 分钟无流量后服务自动休眠，下次请求冷启动约 30-60 秒
5. 环境变量：
   - `VOLC_APP_ID=xxx`
   - `VOLC_ACCESS_TOKEN=xxx`
   - 不需要 `VOLC_ASR_RESOURCE_ID`（资源 ID 在代码中硬编码为 `volc.bigasr.auc_turbo`）
6. Dockerfile 中需包含 FFmpeg：`RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*`
7. 自动部署：git push → Render 自动构建 Docker 镜像并运行
8. 费用：免费

### 6.3 环境变量清单

| 变量 | 位置 | 说明 |
|------|------|------|
| `VITE_API_BASE_URL` | Vercel | Render 后端 API 地址（文案提取用） |
| `BUGPK_BASE_URL` | Vercel | BugPk API 地址（Serverless 代理用） |
| `VOLC_APP_ID` | Render | 火山引擎应用 ID（X-Api-App-Key） |
| `VOLC_ACCESS_TOKEN` | Render | 火山引擎 Access Token（X-Api-Access-Key） |

---

## 七、非功能需求

| 需求 | 说明 |
|------|------|
| 性能 | 解析接口 < 3 秒返回；ASR 文案提取按音频时长而定，首次请求含 Render 冷启动约 30-60 秒 |
| 时长 | 前端提示"建议 15 分钟以内的视频"，后端不做硬性限制（豆包 ASR 上限 2 小时） |
| 安全 | Vercel API Routes 校验链接格式，拒绝非目标平台链接；不存储用户数据；火山引擎 API Key 仅存后端 |
| 可用性 | 核心流程（解析+下载+复制标题）运行在 Vercel，不依赖 Render 后端；ASR 降级不影响主功能 |
| 兼容性 | 支持 Chrome/Firefox/Safari/Edge 最近两个大版本；Safari 移动端 `referrerPolicy` 不完整，通过后端 `/api/download` 备用代理 |
| 移动端 | 响应式设计，移动端全功能可用 |

---

## 八、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| BugPk 接口不稳定或关停 | 解析失败 | BugPk 源码开源可自行部署（PHP 8.0）；预留考拉解析等备选接口 |
| 豆包 ASR 费用超预期 | 运营成本 | 前端"获取文案"按钮旁提示预估费用；火山引擎控制台可设 QPS/月调用量上限 |
| 平台链接格式变化 | 解析失败 | 错误提示引导用户反馈；关注 BugPk GitHub 更新 |
| Render 免费额度调整 | 服务不可用 | 后端轻量化设计，Docker 镜像可迁至 Railway/国内云 |
| 视频直链防盗链升级 | 前端下载失败 | `referrerPolicy: 'no-referrer'` 方案失效时，Vercel API Routes 增加代理下载端点 |
| 大视频导致 Render 内存溢出 | 文案提取失败 | Docker 限制 FFmpeg 内存，超限时返回友好提示；前端提示建议 15 分钟内 |

---

## 九、后续迭代方向（v2+）

- 支持 YouTube、TikTok、小红书、微博等更多平台
- 用户系统 + 下载/解析历史记录
- 支持批量链接解析
- 说话人分离（豆包 ASR 已支持 `enable_speaker_info` 参数，v2 只需前端增加切换开关）
- 长视频流式下载（解决 >200MB 视频浏览器内存问题）
- 文案翻译功能
- 视频封面单独下载
- PWA 支持（可安装到桌面）
- 自建 BugPk 实例提高稳定性
