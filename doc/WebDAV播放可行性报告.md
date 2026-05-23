# WebDAV 远程播放 —— 可行性报告

> 评估对象:参照现有「OneDrive 远程播放」,新增「WebDAV 远程播放」功能
> 评估结论:**高度可行**(技术风险低、基础设施齐备、改动量小于 OneDrive)
> 评估日期:2026-05-23

---

## 一、结论速览

| 维度 | 评估 |
|------|------|
| 总体可行性 | ★★★★★ 高度可行 |
| 核心技术风险 | 低(关键能力均已具备) |
| 需触碰播放核心的改动 | 仅 1 处(注入 Basic Auth header,约 10 行) |
| 预估工作量 | 约 600~700 行,**少于** OneDrive(1500 行) |
| 主要外部依赖风险 | WebDAV 服务器需支持 Range 请求(主流均支持) |

**一句话结论**:项目已内置 `webdav` 库、播放器已支持 per-track 自定义请求头、Android 已放行明文 HTTP,且 OneDrive 提供了可直接套用的架构范本。WebDAV 播放比 OneDrive 更简单(无需 OAuth、播放地址稳定无需实时刷新),唯一新增的核心机制是「给播放请求注入 `Authorization` 头」,而该机制项目已为网易云实现过同类逻辑。

---

## 二、关键技术依据(逐条带证据)

### 2.1 WebDAV 客户端能力 —— 已具备 ✅

- 依赖已存在:`webdav@5.8.0`(`package.json:84`)。
- 已有封装 `src/utils/webdav.ts`:基于 `createClient(url, { username, password })`,已封装 `getDirectoryContents` / `getFileContents` / `stat` / `exists` / `putFileContents` / `createDirectory`。
- 目录列举与递归扫描可直接用库的 `getDirectoryContents(path, { deep: true })`,无需自己实现 PROPFIND。

> ⚠️ 注意:当前 `webdav.ts` 的 `client` 是**单例**且绑定 `sync.webdav.*` 同步配置(`webdav.ts:7-22`)。播放若使用独立服务器/账号,需要把客户端改造成可多实例或新建独立模块,避免与「同步」配置互相污染。

### 2.2 播放器支持自定义请求头 —— 已具备 ✅(决定性)

这是 WebDAV 播放能否成立的**核心**。WebDAV 文件需要 `Authorization: Basic xxx` 才能访问,而播放器必须能在拉流时携带该头。

证据(`src/plugins/player/playList.ts:11-83`):

```js
const wyStreamHeaders = { Referer: 'https://music.163.com/', Origin: 'https://music.163.com' }

const getTrackHeaders = (musicInfo, url) => {
  ...
  return source === 'wy' ? wyStreamHeaders : undefined   // 网易云已在用 per-track headers
}

const buildTrackExtra = (musicInfo, url) => {
  const headers = getTrackHeaders(musicInfo, url)
  const userAgent = getTrackUserAgent(musicInfo, url)
  return { ...(userAgent != null ? { userAgent } : {}), ...(headers ? { headers } : {}) }
}
// track.push({ id, url, ...extra, ... }) ← headers 随 track 下发给 TrackPlayer
```

- `LX.Player.Track extends RNTrack`(`types/player.d.ts:92`),`react-native-track-player@4.1.2`(`package.json:76`)的 Track 原生支持 `headers` 字段。
- **网易云已经在用同一机制注入 `Referer`/`Origin`**,WebDAV 只需复刻为注入 `Authorization`。
- 这同时规避了 ExoPlayer 不支持 `https://user:pass@host` 这种 URL 内联凭证的问题 —— 用 header 是唯一正确路径,而项目恰好已支持。

### 2.3 明文 HTTP 已放行 —— 已具备 ✅

自建 WebDAV(群晖、Alist、nginx、坚果云私有部署)很多是 `http://`。Android 9+ 默认禁止明文流量,通常是部署最大障碍。

证据(`android/app/src/main/res/xml/network_security_config.xml`):
```xml
<base-config cleartextTrafficPermitted="true" />
```
**已全局允许明文 HTTP**,http WebDAV 服务器开箱即用,无需任何额外配置。

### 2.4 源路由架构可扩展 —— 已具备 ✅

`src/core/music/index.ts:35-45` 的三层分发(下载 / local / 在线)已被 OneDrive 验证为可扩展点。WebDAV 同样以 `source: 'local'` + `meta.webdav` 标记接入,只需在三个分发函数各加一条分支。

### 2.5 凭证安全机制 —— 已具备 ✅

`syncHelpers.ts:9-14` 的 `SENSITIVE_SETTING_KEYS` 已包含 `sync.webdav.password`,同步时自动剔除。WebDAV 播放配置复用该机制即可保证密码不被上传/泄露。

### 2.6 现成架构范本 —— 已具备 ✅

OneDrive 的 `auth/drive/music/utils` + UI + 类型 + 导航注册是一套完整可套用的模板,详见 `doc/OneDrive播放实现分析.md`。

---

## 三、WebDAV 播放 vs OneDrive 差异分析

| 维度 | OneDrive | WebDAV | 对实现的影响 |
|------|----------|--------|--------------|
| 认证方式 | OAuth 2.0(设备码 + token) | Basic Auth(用户名/密码) | **WebDAV 更简单**,无需 OAuth、无需 token 刷新 |
| 鉴权代码量 | `auth.ts` 245 行 | 几乎为 0(库内置) | 省去最重的一块 |
| 播放 URL | 时效性预签名直链 | 固定 URL(baseUrl + path) | **WebDAV 更简单**,`getMusicUrl` 直接拼接,无需每次实时请求刷新 |
| 拉流认证 | URL 自带签名,无需 header | **必须注入 `Authorization` 头** | 唯一新增的核心机制 |
| 目录列举 | Graph REST API(自写 fetch) | `webdav` 库 `getDirectoryContents` | WebDAV 直接用库 |
| 缩略图 | Graph 自带 thumbnails | 无 | 用占位图 / 在线源匹配封面 |
| SDK | 全部自研 | 复用 `webdav@5.8.0` | 减少代码 |

**核心洞察**:OneDrive 把复杂度花在「认证 + 时效直链刷新」上;WebDAV 把这两块都省了,只增加「拉流时带 Basic Auth 头」这一件事——而项目已具备该能力。

---

## 四、推荐实现方案

### 4.1 目标数据流

```mermaid
flowchart TD
    A[配置 URL/用户名/密码/目录] --> B[测试连接 getDirectoryContents]
    B --> C[递归扫描 getDirectoryContents deep:true]
    C -->|过滤音频扩展名| D[转换为 MusicInfo: source=local, meta.webdav=true]
    D --> E[保存配置 @webdav_play_config]
    E --> F[点击歌曲 → 写入 TEMP 列表 + playList]
    F --> G[getMusicUrl 返回 baseUrl+path 固定地址]
    G --> H[playList 注入 Authorization: Basic 头]
    H --> I[TrackPlayer 带头拉流播放]
```

### 4.2 模块规划(对照 OneDrive)

| 新增文件 | 参照 | 预估行数 | 说明 |
|----------|------|---------|------|
| `src/core/webdavPlay/client.ts` | `oneDrive/auth.ts` | ~60 | 独立 webdav 客户端 + 播放配置读写(不复用同步单例) |
| `src/core/webdavPlay/drive.ts` | `oneDrive/drive.ts` | ~150 | 目录浏览、递归扫描、`DriveFile→MusicInfo` 转换 |
| `src/core/webdavPlay/music.ts` | `oneDrive/music.ts` | ~40 | `getMusicUrl/getPicUrl/getLyricInfo` 适配 |
| `src/core/webdavPlay/utils.ts` | `oneDrive/utils.ts` | ~10 | `isWebDAVMusicInfo()` |
| `src/types/webdavPlay.d.ts` | `types/onedrive.d.ts` | ~50 | 类型定义 |
| `src/screens/Home/Views/WebDAVPlay/index.tsx` | OneDrive UI | ~400 | 配置页 + 列表页(比 OneDrive 简单,无设备码流) |

| 改动文件 | 改动 | 行数 |
|----------|------|------|
| `src/core/music/index.ts` | 三个分发函数各加 `'webdav' in meta` 分支 | ~9 |
| `src/plugins/player/playList.ts` | `getTrackHeaders` 增加 WebDAV 分支注入 Basic Auth | ~10 |
| `src/config/constant.ts` | 注册 `nav_webdav` 导航项 | ~1 |
| `src/config/defaultSetting.ts` | 默认显隐 | ~1 |
| `src/event/appEvent.ts` | 「跳转到正在播放」定位(可选) | ~6 |

### 4.3 唯一的核心改动 —— 注入 Basic Auth 头

在 `playList.ts` 中扩展 `getTrackHeaders`(示意):

```js
import { Buffer } from '@craftzdog/react-native-buffer'  // 项目已有该依赖

const getTrackHeaders = (musicInfo, url) => {
  if (!url || !/^https?:\/\//.test(url) || wyMediaUrlRxp.test(url)) return undefined
  const info = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  // WebDAV:运行时从配置取凭证生成头,凭证不写入歌曲对象
  if (info.source === 'local' && info.meta?.webdav) {
    const { username, password } = getWebDAVPlayCredentials()
    const token = Buffer.from(`${username}:${password}`).toString('base64')
    return { Authorization: `Basic ${token}` }
  }
  return getTrackSource(musicInfo) === 'wy' ? wyStreamHeaders : undefined
}
```

> **凭证存储建议**:采用「运行时从配置生成 header」而非把 base64 凭证写进 `musicInfo.meta`。原因:歌曲对象可能随临时列表/歌单被导出或同步,凭证写入 meta 会有泄露风险;与网易云 cookie 不入 track 的现有思路保持一致。

### 4.4 `getMusicUrl` 比 OneDrive 更简单

WebDAV 文件地址稳定,直接拼接即可,**无需** OneDrive 那样每次播放重新请求刷新直链:

```js
export const getMusicUrl = async ({ musicInfo }) => {
  return joinUrl(getWebDAVBaseUrl(), musicInfo.meta.filePath)  // 一次性拼接
}
```

---

## 五、风险与难点

| 风险 | 等级 | 说明与对策 |
|------|------|-----------|
| 服务器需支持 Range 请求(206) | 中 | seek/流式播放依赖。nginx/Apache/坚果云/Alist/群晖均支持;少数简易服务器不支持会导致无法拖动进度,需在文档提示 |
| WebDAV 客户端单例与同步配置冲突 | 中 | `webdav.ts` 现为单例绑定同步配置,播放须新建独立客户端模块,不复用 |
| 路径特殊字符 / 中文编码 | 中 | 拼接文件 URL 时需 `encodeURI` 各路径段;`webdav` 库返回的 href 编码需统一处理 |
| 大目录递归扫描慢 / 服务器限流 | 中 | 同 OneDrive,深层 PROPFIND 较慢;沿用 OneDrive 的「根目录扫描二次确认」提示 |
| 凭证泄露 | 低 | 复用 `SENSITIVE_SETTING_KEYS` 过滤;凭证不写入歌曲 meta |
| 自签名 HTTPS 证书 | 低~中 | 部分自建服务器用自签证书,ExoPlayer 可能拒绝;明文 HTTP 已放行可作为退路 |
| 封面/歌词缺失 | 低 | WebDAV 无缩略图,复用 OneDrive 的「在线源按歌名歌手匹配」逻辑 |

---

## 六、工作量与实施建议

### 工作量估算
约 **600~700 行**,低于 OneDrive(~1500 行)。省在:无 OAuth(-245 行)、播放地址无需刷新逻辑、目录操作复用 `webdav` 库、UI 更简单(无设备码交互)。

### 分阶段实施
1. **阶段一(核心闭环)**:独立 webdav 客户端 + 扫描 + `MusicInfo` 转换 + `getMusicUrl` + `playList.ts` 注入 Basic Auth → 跑通「能播一首 WebDAV 歌曲」。这是验证可行性的最小闭环,风险全部集中在此,建议优先打通。
2. **阶段二(完整体验)**:UI 配置页 + 列表页 + 目录浏览 + 搜索 + 导航注册。
3. **阶段三(打磨)**:封面/歌词在线匹配、跳转定位、错误提示(Range 不支持、连接失败)、扫描进度。

### 建议先做的验证(降低不确定性)
在正式开发前,用一首真实 WebDAV 音频做「冒烟验证」:构造一个带 `headers.Authorization` 的 track 直接喂给 `TrackPlayer`,确认目标服务器能流式播放并支持 seek。**这一步若通过,整个功能即无技术悬念。**

---

## 七、总结

WebDAV 播放在本项目中**高度可行且性价比高**:

- ✅ 全部关键基础设施就绪:`webdav` 库、播放器 per-track headers、明文 HTTP 放行、敏感字段过滤、源路由扩展点、OneDrive 范本。
- ✅ 比 OneDrive 更简单:省去 OAuth 与时效直链刷新。
- ✅ 仅 1 处核心改动:在 `playList.ts` 注入 Basic Auth 头,且已有网易云同类先例。
- ⚠️ 主要不确定项是「目标服务器 Range 支持」,可通过一次冒烟验证快速排除。

建议按「最小闭环优先」推进,先打通带鉴权头的单曲播放,再补全 UI 与体验。
