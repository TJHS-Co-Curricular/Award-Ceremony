#!/usr/bin/env node
/*
 * 检查无头 Chrome 能不能用上显卡画画面：把 lib/render.js 里每一组显卡启动参数都试一次，列出实际用到的显卡。
 * 用法：node tools/gpu-check.js（不需要服务端在跑）。显示「显卡 ✓」的那组就是服务器渲染会用的。
 * 想试别的参数：RENDER_GPU_FLAGS="--use-angle=vulkan --xxx" node tools/gpu-check.js
 */
'use strict';
const R = require('../lib/render');
(async () => {
  const a = R.available(); if (!a.ok) { console.log('✗ ' + a.reason); process.exit(1); }
  console.log('Chrome：' + a.chrome + '\n');
  for (const [name, flags] of R.GPU_FLAGS) {
    try {
      const c = await R.launchChromeWith(flags, name);
      console.log(`${c.gpu.hw ? '显卡 ✓' : 'CPU  ✗'}  ${name.padEnd(12)} ${c.gpu.renderer}\n         参数：${flags.join(' ') || '（无）'}`);
      const f = c.gpu.features || {};   // 2d_canvas = 网页画布、rasterization = 画面光栅化、gpu_compositing = 合成，要是 enabled 才是用显卡
      if (c.gpu.hw) console.log(`         画布 ${f['2d_canvas'] || '?'} · 光栅化 ${f.rasterization || '?'} · 合成 ${f.gpu_compositing || '?'}`);
      c.close();
    } catch (e) { console.log(`失败    ${name.padEnd(12)} ${e.message.split('\n')[0]}`); }
  }
  const ff = R.ffEncoder();
  console.log(`\n编码：${ff.ok ? ff.label + '（ffmpeg ' + ff.codec + '）' : '浏览器内建'}${ff.reason ? '  · ' + ff.reason : ''}`);
  setTimeout(() => process.exit(0), 2500);
})();
