/*
 * 用 Node 模拟 ESP32 按钮发出的请求，检查服务端回应是否和 esp32-guest-button.ino 预期的一样。
 * 不需要 ESP32。先开一个测试服务端（不要用主目录的真实 data/），再执行：
 *   node Keypad/test-protocol.js http://127.0.0.1:8097/guest?k=密钥 [控制端密码]
 * 给了控制端密码时会自动登录、授权嘉宾，测试完整流程，并检查控制端看得到按钮的信号和延迟。
 */
'use strict';

const [, , guestUrl, pass] = process.argv;
if (!guestUrl) { console.log('用法：node Keypad/test-protocol.js <嘉宾链接> [控制端密码]'); process.exit(1); }
const u = new URL(guestUrl);
const key = u.searchParams.get('k');
const base = `http://${u.hostname}:${+u.port || 80}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 和 ino 一样：GET /api/guest/button 问能不能按，带上信号和上一次的延迟
let lastRtt = -1;
async function poll(k = key) {
  const t0 = Date.now();
  const q = `k=${k}&id=AwardButton-TEST&rssi=-58&miss=0&up=${Math.round(process.uptime())}&v=2` + (lastRtt >= 0 ? `&rtt=${lastRtt}` : '');
  const r = await fetch(`${base}/api/guest/button?${q}`);
  lastRtt = Date.now() - t0;
  const body = await r.text();
  return { code: r.status, armed: body.includes('"armed":true'), body };
}
const reveal = () => fetch(`${base}/api/guest/reveal?k=${key}`, { method: 'POST', headers: { 'X-AC': '1' } }).then(r => r.status);

(async () => {
  let p = await poll();
  console.log('问状态：', p.code, p.body, '（应为 200，armed = false）');
  console.log('未授权时按：', await reveal(), '（应为 409）');
  if (pass) {
    const h = { 'X-AC': '1', 'Content-Type': 'application/json' };
    const r = await fetch(`${base}/api/login`, { method: 'POST', headers: h, body: JSON.stringify({ password: pass }) });
    const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    const act = a => fetch(`${base}/api/control/action`, { method: 'POST', headers: { ...h, Cookie: cookie }, body: JSON.stringify(a) }).then(r => r.status);
    console.log('登录：', r.status);
    console.log('公布奖项：', await act({ action: 'next' }), await act({ action: 'next' }));
    console.log('授权嘉宾：', await act({ action: 'guestArm' }));
    p = await poll();
    console.log('灯应该亮：armed =', p.armed);
    console.log('按一下：', await reveal(), '（应为 200）');
    console.log('马上再按：', await reveal(), '（应为 429）');
    console.log('收回授权：', await act({ action: 'guestDisarm' }));
    p = await poll();
    console.log('灯应该灭：armed =', p.armed);
    const st = await fetch(`${base}/api/control/state`, { headers: { Cookie: cookie } }).then(r => r.json());
    const b = (st.buttons || []).find(x => x.id === 'AwardButton-TEST');
    console.log('控制端看到的按钮：', b ? `${b.online ? '在线' : '离线'}，信号 ${b.rssi} dBm，延迟 ${b.rtt} ms（平均 ${b.rttAvg}）` : '⚠ 没有');
  }
  console.log('错的密钥：', (await poll('wrong')).code, '（应为 403）');
})();
