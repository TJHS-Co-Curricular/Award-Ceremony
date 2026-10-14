/*
 * 控制端 · 启动：已登录就直接进入，否则显示登录框。
 */
"use strict";

boot().catch(() => showLogin());
