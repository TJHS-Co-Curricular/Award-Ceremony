/* OBS 场景集合：每个屏幕一个场景 + 浏览器来源，并挂上 DistroAV 的 NDI 输出滤镜（NDI 名 AWARD-MAIN / AWARD-SIDE …） */
'use strict';
const crypto = require('crypto');
const rt = require('./runtime');
const { screens } = require('./config');

function obsSceneCollection(host, fps) {
  const CFG = rt.cfg;
  const list = screens([{ name: '输出', width: 1920, height: 1080 }]);
  const base = (id, name, settings, extra = {}) => ({
    prev_ver: 503447555, name, uuid: crypto.randomUUID(), id, versioned_id: id, settings,
    mixers: 0, sync: 0, flags: 0, volume: 1.0, balance: 0.5, enabled: true, muted: false,
    'push-to-mute': false, 'push-to-mute-delay': 0, 'push-to-talk': false, 'push-to-talk-delay': 0,
    hotkeys: {}, deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0, private_settings: {}, ...extra
  });
  const sources = [], order = [];
  list.forEach((sc, idx) => {
    const ndiName = 'AWARD-' + (idx === 0 ? 'MAIN' : idx === 1 ? 'SIDE' : 'SCREEN' + (idx + 1));
    const url = `http://${host}:${CFG.port}/display?k=${CFG.displayKey}&res=${sc.width}x${sc.height}&name=${encodeURIComponent(sc.name + '·OBS')}`;
    const browser = base('browser_source', `${sc.name} 网页 ${sc.width}×${sc.height}`, {
      url, width: sc.width, height: sc.height, fps_custom: true, fps,
      shutdown: false, restart_when_active: false, reroute_audio: false, is_local_file: false, css: ''
    }, {
      filters: [{
        prev_ver: 503447555, name: `NDI 输出 ${ndiName}`, uuid: crypto.randomUUID(), id: 'ndi_filter', versioned_id: 'ndi_filter',
        settings: { ndi_filter_ndiname: ndiName, ndi_filter_ndigroups: '' }, mixers: 0, sync: 0, flags: 0, volume: 1.0, balance: 0.5,
        enabled: true, muted: false, hotkeys: {}, deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0, private_settings: {}
      }]
    });
    const sceneName = `${sc.name} ${sc.width}×${sc.height}`;
    const scene = base('scene', sceneName, {
      id_counter: 1, custom_size: false,
      items: [{
        name: browser.name, source_uuid: browser.uuid, visible: true, locked: true, rot: 0.0,
        pos: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, align: 5, bounds_type: 0, bounds_align: 0, bounds_crop: false, bounds: { x: 0, y: 0 },
        crop_left: 0, crop_top: 0, crop_right: 0, crop_bottom: 0, id: 1, group_item_backup: false,
        scale_filter: 'disable', blend_method: 'default', blend_type: 'normal',
        show_transition: { duration: 0 }, hide_transition: { duration: 0 }, private_settings: {}
      }]
    }, { filters: [] });
    sources.push(scene, browser);
    order.push({ name: sceneName });
  });
  return {
    name: '表扬大会', current_scene: order[0].name, current_program_scene: order[0].name, scene_order: order,
    sources, groups: [], quick_transitions: [], transitions: [], saved_projectors: [],
    current_transition: 'Fade', transition_duration: 300, preview_locked: false,
    scaling_enabled: false, scaling_level: 0, scaling_off_x: 0.0, scaling_off_y: 0.0, modules: {},
    canvases: []
  };
}

module.exports = { obsSceneCollection };
