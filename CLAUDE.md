# CLAUDE.md — 表扬大会 · 颁奖公布系统

内网（LAN）颁奖公布网页系统：服务端保管名单，控制端操作，输出页上大屏，嘉宾页给嘉宾用手机揭晓。
与用户沟通用**简体中文**；代码注释也用中文。

## 硬性约束（改代码前先看）

1. **防泄露是第一原则。** 未揭晓的名字、照片永远不能离开服务器发给输出页 / 嘉宾页。
   - 输出页和嘉宾页只拿 `publicView()`，它只包含 `winners.slice(0, state.revealed)`。改动它时逐行确认没有把整份 `award.winners` 带出去。
   - `/media/photo` 只在「已登录控制端」或「密钥正确 + 该照片已揭晓」时返回。带 ETag 的 304 也要先过这道检查（`sendPhoto()` 在权限判断之后调用）。
  - 照片优先发 `data/photos/_cache/<原名>__<大小>_<mtime>.jpg`（控制端压缩上传的版本），见 `photoSource()`。
   - 照片文件名会出现在控制端，所以提示用户用编号命名（`001.jpg`）。
2. **零依赖、单文件服务端。** `server.js` 只能用 Node 内建模块（`http`、`fs`、`crypto` 等）。原因：要打包成 Node SEA 单文件 exe，SEA 里 `require` 只能加载内建模块。不要加 npm 依赖，不要拆成多个 `.js`。
3. **离线可用。** 三个网页都是自包含 HTML（内联 CSS/JS），不能引用 CDN、Google Fonts 或任何外网资源，现场可能没有外网。
4. **版本号成对修改。** 改了 API、动作或返回结构时，同时把 `server.js` 的 `VERSION` 和 `public/control.html` 的 `CLIENT_VERSION` 改成同一个新值，并在 `CHANGELOG.md` 记一条。两边不一致时控制端会显示橙色警告横条。这个机制就是为了防止「新控制端 + 旧服务端」导致的「未知操作」问题，以前真实发生过。
5. **不提交敏感文件。** `.gitignore` 已排除 `config.json`（密码、密钥）、`data/`（名单、照片、进度）、`logs/`、`Result/`、`dist/`、`/AwardCeremony*.exe`、主目录生成的 `加密名单.bat` / `解密名单.bat`、`obs/`（含输出页密钥）、主目录的 `Picture*.png` 设计参考图。新增会产生敏感内容的路径时，同步加进 `.gitignore`。

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

## 文件结构

```
server.js              服务端（唯一的程序文件，约 700 行）
public/control.html    控制端（登录、现场控制、奖项编辑、图片导出分页、自动播放、嘉宾授权、多屏地址、OBS 导出）
public/display.html    输出页（纯输出，1920×1080 为基准自适应任意比例）
public/guest.html      嘉宾揭晓页（手机，按住 1 秒揭晓）
build.bat              双击编译 exe
build/build-exe.js     SEA 打包脚本（离线）
build/vendor/          随附的 postject（注入 SEA blob）和 resedit（改 exe 图标与版本信息），都是 MIT
build/icon/            应用图标源文件：icon.svg（≥48px）、icon-small.svg（≤40px）、icon.ico、PNG
build/使用说明.txt      便携版说明（只在输出到 dist 时复制）
start.bat              启动源码版
README.md              用户文档（中文）
```

运行时生成：`config.json`、`data/awards.json|awards.enc`、`data/state.json`（进度，不含名字）、`data/photos/`（含 `_cache/` 压缩版）、`data/fonts/`（上传的字体）、`data/export-style.json`（图片导出设计）、`logs/audit.log`。

- 字体：`event.fontTitle` = 中文字体、`fontText` = 英文 / 数字字体（字段名是历史原因），值是系统字体名或 `file:文件名`；两者拼成「英文, 中文, 默认」套用到 `--serif` 和 `--sans`。系统字体名先经 `sysFont()`（去 PowerPoint 标签、补中文名的英文别名，display.html 和 control.html 各一份，要一起改）；display.html 的 `applyFonts()` 和 control.html 的 `fontFamily()` 用 FontFace 加载 `/media/font`。图片导出在独立分页 `#export`（control.html `exRender()` 用 canvas 画、`makeZip()` 打包）；样式对象 `EXS`（`EX_PRESET()` 为默认，`exClean()` 整理），经 `GET/PUT /api/control/export-style` 存到 `data/export-style.json`。⚠ `exChanged()` 会把 `EXS` 换成新对象，事件处理里要按 key 现取 `EXS.elems[key]`，不能抓住旧对象。快捷键只在 `#live` 显示时生效。⚠ control.html 的 `HTML_FONT` 必须和 display.html `:root` 的 `--serif` / `--sans` 保持一致（导出字体要和大屏同步）。

## 服务端架构（server.js）

- **名单字段**：每位获奖者 `{ name, cls（班级）, sid（学号）, detail（备注）, photo, type }`（`type` 只有 `'team'` 一种取值，表示团体；个人不写），`normalizeData()` 会去掉空字段。`publicView()` 只带出已揭晓者的这些字段。
- **状态**：`state = { mode, awardId, revealed, phase, doneIds, blackout, message, seq }`
  - `phase` 只用于入围揭晓奖项（`revealMode: 'nominee'` 且有 `win` 标记，见 `isNominee()`）：`''` 介绍入围者 → `suspense` → `winner`。奖项是否完成统一用 `isComplete(a, st)` 判断。`commit()` 在非 reveal 模式下会清空 `phase`。
  - ⚠ `publicView()` 绝不能带出 `win`；`winnerIndex` 只在 `phase === 'winner'` 时给。
  - `mode` 取值：`standby` / `group`（分类标题）/ `title` / `reveal` / `message`。`group` 模式下 `awardId` 指向该分类里下一个要公布的奖项；分类 = 相邻同名的 `award.group`（`groupRun()`）。整组设定（如 `groupNoNum` 不显示编号）存在组里每个奖项上，读取时「任一奖项设了就算」，控制端修改时整组一起写。
  - 每次改动都走 `commit()`：推入 `history`（供撤销）→ 存 `state.json` → `afterChange()`。
  - `afterChange()` 依次做：必要时收回嘉宾授权 → `scheduleAuto()` → `broadcast()`。
- **「下一步」逻辑**：`planNext(state)` 返回 `{ st, desc }`。控制端的下一步提示、自动播放、嘉宾揭晓都用它，修改时三处会一起受影响。
- **动作**：`POST /api/control/action`，参数 `{ action, ... }`。动作列表：
  `next`、`standby`、`blackout`、`message`、`group`、`title`、`revealAll`、`markPending`、`undo`、`resetProgress`、`autoStart`、`autoStop`、`guestArm`、`guestDisarm`、`rotateGuestKey`。
  - 新增动作时：在 `doAction()` 的 switch 里加 case；如果它**不该**打断自动播放，加进开头的豁免数组；在控制端 `labelOf()` 里加中文名；递增版本号。
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
  - 网页优先读 `ROOT/public/*.html`，没有就用 `sea.getAsset()` 读打包在 exe 里的版本。
  - 出错时窗口不立即关闭，用 `quit()` 等用户按 Enter。
  - 启动后自动打开控制端（`openBrowser`）。
- **OBS 导出**：`GET /api/control/obs?host=&fps=` 生成 OBS 场景集合。每个屏幕一个场景、一个浏览器来源，并挂上 DistroAV 的 `ndi_filter`（设置项 `ndi_filter_ndiname`，NDI 名为 `AWARD-MAIN` / `AWARD-SIDE`）。
- **配置**：`DEFAULT_CONFIG` 与 `config.json` 合并。新增配置项要有默认值；需要写回文件时参照 `screens` 的「缺键就写回」做法。

## 输出页（display.html）

- **舞台**：以 1920×1080 为基准单位，短边固定、长边延伸，`SW`/`SH` 是舞台的逻辑尺寸。
  - 4096×1280 → 3456×1080；1216×896 → 1920×1415。
  - 网址参数 `res=宽x高` 强制比例，`name=` 是屏幕名（显示在控制端已连接列表里）。
  - 窗口尺寸改变时 `relayout()` 静默重排，不放动画。
- **排版**：
  - `planText()`（无照片）遍历列数按字号打分；`planPhoto()`（有照片）遍历列数，选让 3:2 卡片最大的行列，卡片宽小于 150 时退回纯文字。
  - 照片卡：整张照片铺满（`PHOTO_AR = 3/2`，`object-fit: cover`），名字 / 班级 / 学号叠在左侧 41% 区域（拍法是人站右边、左边留空），字号按卡片宽度（`--name ≈ cw × 0.078`）。奖项里有团体（`award.hasTeams`）时整个网格加 `.cap`：照片完整在上（`.phbox` 3:2），名字 / 班级学号 / 备注在下居中，卡片比例 `1 / (1/1.5 + CAP_H)`。照片网格用 flex，最后一行居中。
  - 人数超过 12 时，奖项标题区缩小（`.dense`）。
  - 入围揭晓：排版时高度 × 0.74 预留放大空间；`applyPhase()` 切换 `.suspense` / `.crowned`，`crown()` 用 offsetLeft/Top 算出把得主卡移到网格中央的 `--wx/--wy/--ws`。
- **动画**：首次载入、刷新、撤销时，已揭晓的卡片直接显示，不放彩带（`booted` / `isUndo`）。
- **不要用 `seq` 去重渲染**：存数据时不会递增 `seq`，但活动名称等内容会变。

## 测试方法（云端环境验证过的流程）

- **服务端流程**：用 `curl` 登录（带 `X-AC: 1`）→ 发动作 → 读 `/api/display/stream`（用 `--max-time 1`），确认未揭晓的名字没有出现在输出里。
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
- 三个网页 `<head>` 里的 `<link rel="icon">` 是 `icon-small.svg` 的 base64，改图标时要一起更新。
- `build-exe.js` 的顺序必须是：去签名 → postject 注入 → `setIconAndVersion()`。如果先改图标再注入，postject（LIEF）会报 “Relocation corrupted”。

## 格式与编码

- `.bat` 必须是 **CRLF** 换行、UTF-8 编码，开头加 `chcp 65001 >nul`。
   - `build.bat` 里 `node build\build-exe.js` 之后只能放纯英文行：cmd 在 chcp 65001 下跑完长命令后会读错后面的中文行（出现 `'e' is not recognized`）。编译后的提示文字由 build-exe.js 输出。
  - 用 Python 改 `.bat` 时要 `open(..., newline='')`，否则匹配不到 `\r\n`。
- 在 cmd 里设置环境变量要写成 `set "VAR=value"`，否则值末尾会带空格。
- 所有新功能都要同步写进 `README.md`（用户看的，中文）和 `CHANGELOG.md`。
