/*
 * 特效 · 待机画面背景切换：控制端「效果控制」里选（FXC.standby）。
 *   galaxy    = 旋涡星系（js/fx/galaxy.js，默认）
 *   goldriver = 金色光河（js/fx/goldriver.js，原本的设计，保留作备份）
 * 两种都画在同一个 canvas #goldfx 上，同一时间只运行一种。
 * 提供：standbyFx(on, kind)
 */
'use strict';

const STANDBY_FX = { galaxy: on => galaxyFx(on), goldriver: on => goldFx(on) };
let standbyKind = null;
function standbyFx(on, kind) {
  const k = STANDBY_FX[kind] ? kind : 'galaxy';
  if (standbyKind && standbyKind !== k) STANDBY_FX[standbyKind](false);   // 换了背景：先停掉旧的
  standbyKind = k;
  STANDBY_FX[k](on);
}
