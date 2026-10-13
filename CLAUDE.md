# CLAUDE.md — 表扬大会 · 颁奖公布系统

内网（LAN）颁奖公布网页系统：服务端保管名单，控制端操作，输出页上大屏，嘉宾页给嘉宾用手机揭晓。
与用户沟通用**简体中文**；代码注释也用中文。

## 硬性约束（改代码前先看）

1. **防泄露是第一原则。** 未揭晓的名字、照片永远不能离开服务器发给输出页 / 嘉宾页。
   - 输出页和嘉宾页只拿 `publicView()`（`lib/views.js`），它只包含 `winners.slice(0, state.revealed)`。改动它时逐行确认没有把整份 `award.winners` 带出去。
   - `/media/photo`（`lib/routes/display.js`）只在「已登录控制端」或「密钥正确 + 该照片已揭晓」时返回。带 ETag 的 304 也要先过这道检查（`sendCached()` 在权限判断之后调用）。
   - 照片优先发 `data/photos/_cache/<原名>__<大小>_<mtime>.jpg`（控制端压缩上传的版本），见 `lib/media.js` 的 `photoSource()`。
   - `/assets/*` 只放程序代码、样式和图标，不需要密钥；**绝不能**把名单、照片或任何数据放进 `public/`。
   - 照片文件名会出现在控制端，所以提示用户用编号命名（`001.jpg`）。
2. **零依赖。** 服务端只能用 Node 内建模块（`http`、`fs`、`crypto` 等），不要加 npm 依赖。代码按功能分在 `lib/` 里（见下面「代码结构」）；SEA 里 `require` 只能加载内建模块，所以 `build-exe.js` 会先把 `server.js` + `lib/**/*.js` 合并成一个文件（`bundle()`）。模块之间只用**相对路径** `require('./xxx')`，不要用动态 require 或 `__dirname` 拼路径找代码。
3. **离线可用。** 网页的 CSS / JS 都在 `public/` 里，经 `/assets/…` 由服务端提供（exe 里打包了一份）。不能引用 CDN、Google Fonts 或任何外网资源，现场可能没有外网。
4. **版本号成对修改。** 改了 API、动作或返回结构时，同时把 `lib/env.js` 的 `VERSION` 和 `public/js/control/core.js` 的 `CLIENT_VERSION` 改成同一个新值，并在 `CHANGELOG.md` 加一个新的 `## [x.y]`（build.bat 用它决定 exe 文件名，三者不一致时编译会提示）。两边不一致时控制端会显示橙色警告横条。这个机制就是为了防止「新控制端 + 旧服务端」导致的「未知操作」问题，以前真实发生过。
5. **不提交敏感文件。** `.gitignore` 已排除 `config.json`（密码、密钥）、`data/*`（名单、照片、进度；例外放行 `data/fonts/` 和 `data/export-style.json`，这两项不含名字）、`logs/`、`Result/`、`dist/`、`/AwardCeremony*.exe`、主目录生成的 `加密名单.bat` / `解密名单.bat`、`obs/`（含输出页密钥）、主目录的 `Picture*.png` 设计参考图。新增会产生敏感内容的路径时，同步加进 `.gitignore`。

## 运行

```bat
start.bat                      :: 源码版（需要 Node.js 18+，编译 exe 需 22+）
node server.js                 :: 同上
node server.js encrypt         :: data/awards.json → data/awards.enc（AES-256-GCM + scrypt），抹除明文
node server.js decrypt         :: 反向
build.bat                      :: 编译 AwardCeremony-V<版本>.exe 到项目主目录（版本取自 CHANGELOG.md 最新的 ## [x.y]）
set "OUT_DIR=dist" && node build\build-exe.js   :: 输出到 dist\（U 盘便携版）
```

- 首次运行会生成 `config.json`（随机的控制端密码、`displayKey`、`guestKey`）。用户实际环境用的是 **80 端口**。
- 环境变量 `AWARD_PASS` 可以代替交互输入口令（测试时用）。
- exe 与 `start.bat` 共用主目录的 `config.json`、`data/`、`logs/`，不能同时运行（端口冲突）。

## 代码结构

```
server.js                 服务端入口：读设置和名单、启动 HTTP、encrypt / decrypt 命令
lib/                      服务端，按功能分（只用 Node 内建模块）
  env.js                  版本号 VERSION、所有文件路径、是否 exe（IS_EXE / sea）、CASCADE_STEP
  runtime.js              运行中的共享状态 rt：cfg、data（名单）、passphrase、state、history、clients、sessions、hooks
  util.js                 hex / str / safeEqual / atomicWrite / shred / audit / askHidden
  net.js                  IP 白名单（inAny）、本机内网地址（lanUrls）
  config.js               config.json：默认值、读写、screens()
  data.js                 名单：normalizeData（格式检查）、加密 / 解密、saveData、SAMPLE
  show.js                 现场流程状态机：findAward、groupRun、isComplete、planNext、commit、undo、进度存档
  autoplay.js             自动播放（服务端计时）
  guest.js                嘉宾揭晓授权
  actions.js              控制端动作 doAction()、afterChange()（注册到 rt.hooks）
  views.js                ⚠ 防泄露核心：publicView()（大屏 / 嘉宾）、controlView()（控制端）
  sse.js                  实时推送：sseOpen、broadcast、dropClients
  sessions.js             登录会话、密码错误次数限制
  http.js                 安全标头、sendJson / sendText / sendStatic、readBody、csrfOk、safeAsset
  media.js                照片（压缩版优先、ETag）和字体文件
  obs.js                  OBS 场景集合
  cli.js                  quit()、口令输入、encrypt / decrypt 命令
  routes/index.js         路由总入口：IP 检查后依次交给 assets → display → guest → control
  routes/assets.js        /assets/css|js|img/…（静态资源，不需要密钥）
  routes/display.js       /display、/api/display/stream、/media/font、/media/photo（输出页密钥）
  routes/guest.js         /guest、/api/guest/*（嘉宾密钥）
  routes/control.js       /control、/api/login、/api/logout、/api/control/*（登录 + 防 CSRF；接口表 API）
public/                   网页（只有程序和样式，没有数据）
  display.html / control.html / guest.html   只有 HTML 结构，最后按顺序载入脚本
  css/fonts.css           ⚠ 默认字体（大屏和图片导出共用的唯一一份 --font-serif / --font-sans）
  css/display.css / control.css / guest.css
  img/icon.svg            网页图标（= build/icon/icon-small.svg）
  js/shared/              几个页面共用：fonts.js（sysFont、fontFamily）、qr.js（二维码）、zip.js（makeZip）
  js/fx/                  大屏特效：dust.js（背景浮尘）、flash.js（揭晓闪光 burst）、galaxy.js（待机旋涡星系，默认）、goldriver.js（待机金色光河，原本）、standby.js（切换）
  js/display/             大屏：stage.js（参数、舞台自适应）→ fonts.js → cards.js（名字卡排版）→ nominee.js（入围揭晓）→ render.js → main.js（连接）
  js/control/             控制端：core.js（共用状态和小工具）→ session.js → live.js / live-view.js（现场控制）→ guest.js → ui.js
                          → editor.js / import.js / photos.js / fonts.js（奖项编辑）→ export.js（图片导出）→ main.js（启动）
  js/guest/main.js        嘉宾揭晓页
build.bat                 双击编译 exe
build/build-exe.js        SEA 打包脚本（离线）：bundle() 合并服务端代码，public/ 全部作为资源
build/vendor/             随附的 postject（注入 SEA blob）和 resedit（改 exe 图标与版本信息），都是 MIT
build/icon/               应用图标源文件：icon.svg（≥48px）、icon-small.svg（≤40px）、icon.ico、PNG
build/使用说明.txt         便携版说明（只在输出到 dist 时复制）
start.bat                 启动源码版
README.md                 用户文档（中文）
```

运行时生成：`config.json`、`data/awards.json|awards.enc`、`data/state.json`（进度，不含名字）、`data/photos/`（含 `_cache/` 压缩版）、`data/fonts/`（上传的字体）、`data/export-style.json`（图片导出设计）、`logs/audit.log`。

### 网页脚本的规则

- 不用打包工具，也不用 ES module：每个页面按 `<script src>` 的顺序载入普通脚本，**所有脚本共用同一个全局作用域**（顶层的 `const` / `let` / `function` 互相看得到）。
  - 新文件要放对位置：载入时就会执行的代码，只能用前面文件已经定义好的东西；事件处理和函数内部可以用后面文件的。
  - 同一页面的所有脚本里，顶层名字不能重复；也不要用 `top`、`name`、`status`、`location` 之类浏览器保留的名字。
  - 每个文件开头写注释：这个文件做什么、「提供」哪些名字、「需要」哪些文件。文件里加 `'use strict'`。
- 新增 css / js 文件放在 `public/css|js|img/` 下（文件名只用字母、数字、`-`、`_`），exe 会自动打包，服务端不用改。
- 字体：`event.fontTitle` = 中文字体、`fontText` = 英文 / 数字字体（字段名是历史原因），值是系统字体名或 `file:文件名`；两者拼成「英文, 中文, 默认」套用到 `--serif` 和 `--sans`。`sysFont()` / `fontFamily()` 在 `js/shared/fonts.js`（大屏、控制端共用一份）；大屏的 `applyFonts()` 在 `js/display/fonts.js`。默认字体只在 `css/fonts.css` 定义，控制端的 `HTML_FONT`（`js/control/export.js`）用 `getComputedStyle` 读它。
- 图片导出：`js/control/export.js` 的 `exRender()` 用 canvas 画、`makeZip()`（`js/shared/zip.js`）打包；样式对象 `EXS`（`EX_PRESET()` 为默认，`exClean()` 整理），经 `GET/PUT /api/control/export-style` 存到 `data/export-style.json`。⚠ `exChanged()` 会把 `EXS` 换成新对象，事件处理里要按 key 现取 `EXS.elems[key]`，不能抓住旧对象。快捷键只在 `#live` 显示时生效（`js/control/live.js`）。

## 服务端架构（lib/）

- **名单字段**：每位获奖者 `{ name, cls（班级）, sid（学号）, detail（备注）, photo, type }`（`type` 只有 `'team'` 一种取值，表示团体；个人不写），`normalizeData()` 会去掉空字段。`publicView()` 只带出已揭晓者的这些字段。
- **共享状态**：都在 `lib/runtime.js` 的 `rt` 上（`rt.cfg`、`rt.data`、`rt.state`…）。整体替换时写 `rt.state = …`，不要把 `rt.state` 存进模块级变量。
- **状态**：`rt.state = { mode, awardId, revealed, phase, doneIds, blackout, message, seq }`
  - `revealMode`：`one` 逐一 / `firstall` 先一后全 / `all` 一次全部 / `nominee` 入围揭晓。
  - 先一后全：每下 `revealed + 1`，大屏只显示第 `revealed` 位（`award.view.mode = 'solo'`）；`revealed` 到最后一位后，下一下 `phase = 'all'`、`page = 0`（全部出现，每页最多 `GALLERY_MAX = 20` 张，按 `award.cascade` 间隔逐张出现），再按就 `page + 1`。完成 = `phase === 'all'` 且到最后一页（`isComplete()`）。`commit()` 在 `phase !== 'all'` 时把 `page` 归零。
  - `phase` 只用于入围揭晓奖项（`revealMode: 'nominee'` 且有 `win` 标记，见 `isNominee()`）：`''` 介绍入围者 → `suspense` → `winner`。奖项是否完成统一用 `isComplete(a, st)` 判断。`commit()` 在非 reveal 模式下会清空 `phase`。
  - ⚠ `publicView()` 绝不能带出 `win`；`winnerIndex` 只在 `phase === 'winner'` 时给。
  - `mode` 取值：`standby` / `group`（分类标题）/ `title` / `reveal` / `photo`（合影画面：分类 + 奖项名称，没有名单）/ `message`。`group` 模式下 `awardId` 指向该分类里下一个要公布的奖项；分类 = 相邻同名的 `award.group`（`groupRun()`）。整组设定（如 `groupNoNum` 不显示编号）存在组里每个奖项上，读取时「任一奖项设了就算」，控制端修改时整组一起写。
  - 每次改动都走 `show.commit()`：推入 `rt.history`（供撤销）→ 存 `state.json` → `rt.hooks.afterChange()`（= `actions.js` 的 `afterChange()`，这样 `show.js` 不用反过来 require 推送模块）。
  - `afterChange()` 依次做：必要时收回嘉宾授权 → `scheduleAuto()` → `broadcast()`。
- **「下一步」逻辑**：`planNext(state)` 返回 `{ st, desc }`。控制端的下一步提示、自动播放、嘉宾揭晓都用它，修改时三处会一起受影响。
- **动作**：`POST /api/control/action`，参数 `{ action, ... }`。动作列表：
  `next`、`standby`、`blackout`、`message`、`group`、`title`、`photo`、`revealAll`、`markPending`、`undo`、`resetProgress`、`autoStart`、`autoStop`、`guestArm`、`guestDisarm`、`rotateGuestKey`。
  - 新增动作时：在 `lib/actions.js` 的 `doAction()` switch 里加 case；如果它**不该**打断自动播放，加进 `KEEP_AUTO`；在控制端 `js/control/live.js` 的 `labelOf()` 里加中文名；递增版本号。
- **新增接口**：在 `lib/routes/control.js` 的 `API` 表加一行 `'方法 路径': handler`（已自动做登录和 CSRF 检查）；不需要登录的页面接口放到对应的 routes 文件里。
- **自动播放**：在服务端计时（`auto`、`scheduleAuto()`），控制端关掉也继续跑。除 `next` 和自动播放、嘉宾相关动作外，任何手动操作都会 `stopAuto()`。
- **嘉宾揭晓**：`guest.armed` 只对当前奖项有效，揭晓完或换奖项时自动收回；嘉宾按键限流 1 秒。
- **推送**：用 SSE（不用 WebSocket，避免依赖）。客户端类型：`display` / `preview` / `guest` / `control`。`send()` 按类型选择 `publicView()` 或 `controlView()`。
- **安全**：
  - IP 白名单（`allowedNetworks`），控制端可再限定 IP（`controlAllowedIps`）。
  - 登录失败 5 次锁 5 分钟；会话绑定登录 IP，Cookie 为 HttpOnly + SameSite=Strict。
  - 写操作要求请求头 `X-AC: 1` 且 Origin 与 Host 一致（防 CSRF）。
  - 所有响应 `no-store`、`no-referrer`、CSP；未知路径一律 404。
  - 审计记录写到 `logs/audit.log`。
- **exe 模式**：`IS_EXE`（`node:sea`）为真时：
  - `ROOT` 取 exe 所在目录。
  - 网页和 `/assets/*` 优先读 `ROOT/public/…`，没有就用 `sea.getAsset('css/display.css')` 这类相对路径读打包在 exe 里的版本（`lib/http.js` 的 `sendStatic()`）。
  - 出错时窗口不立即关闭，用 `quit()` 等用户按 Enter。
  - 启动后自动打开控制端（`openBrowser`）。
- **OBS 导出**：`GET /api/control/obs?host=&fps=` 生成 OBS 场景集合。每个屏幕一个场景、一个浏览器来源，并挂上 DistroAV 的 `ndi_filter`（设置项 `ndi_filter_ndiname`，NDI 名为 `AWARD-MAIN` / `AWARD-SIDE`）。
- **配置**：`DEFAULT_CONFIG` 与 `config.json` 合并。新增配置项要有默认值；需要写回文件时参照 `screens` 的「缺键就写回」做法。

## 输出页（public/js/display/、js/fx/）

- **舞台**：以 1920×1080 为基准单位，短边固定、长边延伸，`SW`/`SH` 是舞台的逻辑尺寸。
  - 4096×1280 → 3456×1080；1216×896 → 1920×1415。
  - 网址参数 `res=宽x高` 强制比例，`name=` 是屏幕名（显示在控制端已连接列表里）。
  - 窗口尺寸改变时 `relayout()` 静默重排，不放动画。
- **排版**：
  - `planText()`（无照片）遍历列数按字号打分；`planPhoto()`（有照片）遍历列数，选让 3:2 卡片最大的行列，卡片宽小于 150 时退回纯文字。
  - 照片卡：整张照片铺满（`PHOTO_AR = 3/2`，`object-fit: cover`），名字 / 班级 / 学号叠在左侧 41% 区域（拍法是人站右边、左边留空），字号按卡片宽度（`--name ≈ cw × 0.078`）。奖项里有团体（`award.hasTeams`）时整个网格加 `.cap`：照片完整在上（`.phbox` 3:2），名字 / 班级学号 / 备注在下居中，卡片比例 `1 / (1/1.5 + CAP_H)`。照片网格用 flex，最后一行居中。
  - 人数超过 12 时，奖项标题区缩小（`.dense`）。
  - 入围揭晓：排版时高度 × 0.74 预留放大空间；`applyPhase()` 切换 `.suspense` / `.crowned`，`crown()` 用 offsetLeft/Top 算出把得主卡移到网格中央的 `--wx/--wy/--ws`。
- **动画**：首次载入、刷新、撤销时，已揭晓的卡片直接显示，不放闪光（`booted` / `isUndo`）。
- **特效**（`js/fx/`）：`burst(n)` 揭晓闪光（亮度 `FLASH_PEAK`）；待机背景由 `standbyFx(on, event.standbyFx)` 切换——`galaxyFx(on)` 旋涡星系（默认，设定在 `GY`）/ `goldFx(on)` 金色光河（原本的设计），只在待机画面显示时运行（`render.js` 的 `show()` 控制），两者共用 canvas `#goldfx`；背景浮尘一直运行（隔帧画）。
- **不要用 `seq` 去重渲染**：存数据时不会递增 `seq`，但活动名称等内容会变。

## 测试方法（云端环境验证过的流程）

- **服务端流程**：用 `curl` 登录（带 `X-AC: 1`）→ 发动作 → 读 `/api/display/stream`（用 `--max-time 1`），确认未揭晓的名字没有出现在输出里。
- **重构后的回归**：新旧两个版本各起一个服务端（不同端口），用同一个脚本走完整场 + 所有动作 / 接口，把每一步的状态和公开视图写成文本再 `diff`，应该完全一样。
- **画面**：用 Playwright 截图检查。Chromium 在 `/opt/pw-browsers`，Playwright 版本要和它匹配（1.56 可用）。
  - 主屏 4096×1280 可以用 2048×640 的视口加 `res` 参数测试。
  - 用 Python PIL 生成占位头像做照片测试，**不要用用户真实照片**。
- **exe**：
  - 云端用 npm 包 `node-win-x64@<与本机 node 相同版本>` 作为 Windows 底座。
  - 用 Linux 的 node 作为底座、`EXE_NAME=xxx` 打一个 Linux 版 SEA，实际跑起来验证 SEA 代码路径。
  - Windows 版 exe 只能检查 PE 结构：签名表已清空、包含 `NODE_SEA_BLOB`、fuse 已翻转。
- **杀进程**：不要用 `pkill -f "node server.js"`，它会连执行命令的 shell 一起杀掉。按 `/proc/*/cwd` 或端口找进程。

## 图标

- 改图标：编辑 `build/icon/icon.svg` 和 `icon-small.svg`，然后重新生成 `icon.ico`。用 Chromium 把 SVG 渲染成 16/20/24/32/40（小版）和 48/64/128/256（大版）的 PNG，再写进 ICO：**256 px 用 PNG，其余尺寸用 BMP（32 位 BGRA + AND 遮罩）**。小尺寸如果也用 PNG，资源管理器有时读不出来，会继续显示 Node 的默认图标。
- 网页图标是 `public/img/icon.svg`（= `icon-small.svg`），改图标时要一起更新。
- `build-exe.js` 的顺序必须是：去签名 → postject 注入 → `setIconAndVersion()`。如果先改图标再注入，postject（LIEF）会报 “Relocation corrupted”。

## 格式与编码

- `.bat` 必须是 **CRLF** 换行、UTF-8 编码，开头加 `chcp 65001 >nul`。
   - `build.bat` 里 `node build\build-exe.js` 之后只能放纯英文行：cmd 在 chcp 65001 下跑完长命令后会读错后面的中文行（出现 `'e' is not recognized`）。编译后的提示文字由 build-exe.js 输出。
  - 用 Python 改 `.bat` 时要 `open(..., newline='')`，否则匹配不到 `\r\n`。
- 在 cmd 里设置环境变量要写成 `set "VAR=value"`，否则值末尾会带空格。
- 所有新功能都要同步写进 `README.md`（用户看的，中文）和 `CHANGELOG.md`。
