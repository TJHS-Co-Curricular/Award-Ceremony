#!/usr/bin/env bash
# 表扬大会 · 颁奖公布系统 —— Linux / macOS 启动脚本（Windows 用 start.bat）
#   ./start.sh                         启动服务端（和 start.bat 一样）
#   ./start.sh render [任务.json] [--parallel N] [--out 目录]
#                                      批量导出影片（远端服务器用）：服务端没在跑就自动在后台开、导完自动关
#   任务文件格式见 tools/render-jobs.example.json；不给就每个屏幕各导出一支 60 秒的待机画面，存到 Result/影片/
#   名单是加密的：先 export AWARD_PASS=口令，或执行时会问你
#   Chrome 路径：export CHROME=/usr/bin/google-chrome；额外参数：export CHROME_FLAGS="..."
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "未检测到 Node.js，请先安装 Node.js 22 或更新版本：https://nodejs.org"; exit 1; }
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')

if [ "${1:-}" != "render" ]; then
  [ "$NODE_MAJOR" -ge 18 ] || { echo "Node.js 版本太旧（$(node -v)），请安装 18 或更新版本"; exit 1; }
  exec node server.js "$@"
fi
shift
[ "$NODE_MAJOR" -ge 22 ] || { echo "批量导出需要 Node.js 22 或更新版本（现在是 $(node -v)）"; exit 1; }

# 第一次用：先让服务端生成 config.json
if [ ! -f config.json ]; then
  echo "第一次运行，先生成 config.json …"
  ( node server.js >/dev/null 2>&1 & echo $! > .render-server.pid ); sleep 3
  kill "$(cat .render-server.pid)" 2>/dev/null || true; rm -f .render-server.pid
fi
PORT=$(node -p 'require("./config.json").port || 80')

STARTED=""
if curl -fs -o /dev/null "http://127.0.0.1:$PORT/assets/img/icon.svg" 2>/dev/null; then
  echo "服务端已经在跑（端口 $PORT），直接使用。"
else
  if [ -f data/awards.enc ] && [ -z "${AWARD_PASS:-}" ]; then
    read -r -s -p "名单是加密的，请输入解密口令：" AWARD_PASS; echo; export AWARD_PASS
  fi
  mkdir -p logs
  echo "在后台启动服务端（端口 $PORT，输出写到 logs/render-server.log）…"
  node server.js > logs/render-server.log 2>&1 &
  STARTED=$!
  trap '[ -n "$STARTED" ] && kill "$STARTED" 2>/dev/null; true' EXIT
  for _ in $(seq 1 50); do
    curl -fs -o /dev/null "http://127.0.0.1:$PORT/assets/img/icon.svg" 2>/dev/null && break
    kill -0 "$STARTED" 2>/dev/null || { echo "服务端启动失败："; tail -20 logs/render-server.log; exit 1; }
    sleep 0.2
  done
fi

node tools/render-video.js "$@"
