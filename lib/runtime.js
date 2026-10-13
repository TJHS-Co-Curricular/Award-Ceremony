/*
 * 运行中的共享状态。各模块拿到的是同一个对象：需要整体替换时写 rt.data = …、rt.state = …，
 * 不要把 rt.data / rt.state 存进局部变量后长期使用（替换后会变成旧的）。
 */
'use strict';

module.exports = {
  cfg: null,          // config.json 的内容
  data: null,         // 名单 { event, awards }（内存里永远是明文）
  passphrase: null,   // 名单解密口令（只存在内存）
  // 现场状态。phase：
  //   入围揭晓：'' = 介绍入围者中 / 'suspense' = 悬念「得主是……」 / 'winner' = 已揭晓得主
  //   先一后全：'' = 一位一位单独显示 / 'all' = 最后全部出现（page = 第几页，每页最多 GALLERY_MAX 张）
  state: { mode: 'standby', awardId: null, revealed: 0, phase: '', page: 0, doneIds: [], blackout: false, message: '', seq: 0 },
  history: [],        // 撤销用的历史状态
  clients: new Set(), // SSE 连接 { res, kind: control | display | preview | guest, ip, token, label }
  sessions: new Map(),// 登录会话 token → { ip, exp }
  hooks: { afterChange: () => {} }   // 状态改变后要做的事（actions.js 注册）
};
