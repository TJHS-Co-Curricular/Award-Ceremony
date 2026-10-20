/*
 * 嘉宾实体揭晓按钮（ESP32 + Arduino）
 *
 * 一个按钮 + 一颗灯。连上现场 WiFi 后，等于一部「嘉宾手机」：
 *   - 主持人在控制端按「交给嘉宾揭晓」后，灯常亮 = 可以按
 *   - 按一下按钮 = 嘉宾揭晓（和手机上按住金色按钮一样）
 *   - 没授权时按了没有作用（服务端会拒绝），灯短闪一下
 *
 * 用两个接口（服务端要 1.38 以上）：
 *   GET  /api/guest/button?k=密钥&…  每 0.5 秒问一次「现在能不能按」，以服务端的回答为准
 *                                    （断线重连、服务端重启后都不会不同步）；顺便报信号强度和延迟，
 *                                    控制端「嘉宾揭晓」下面看得到
 *   POST /api/guest/reveal?k=密钥    揭晓（要带 X-AC: 1；服务端 1 秒内只算一次）
 *
 * 设置（WiFi 名称、密码、嘉宾链接）用手机网页改，存在 ESP32 里，不用重新烧录：
 *   - 第一次开机（还没设置过）、或插电时按住按钮 3 秒 → 进入「设置模式」
 *   - 开机 60 秒还连不上 WiFi → 也会开设置网页（同时继续试连 WiFi）
 *   手机连 WiFi「AwardButton-XXXX」（密码见 AP_PASS），浏览器打开 http://192.168.4.1
 * 同一个文件夹有 secrets.h 时，里面的值只当作「还没设置过」时的默认值（可以不要这个文件）。
 * 接线、灯号说明见 Keypad/README.md。
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>

#if __has_include("secrets.h")
#include "secrets.h"
#endif
#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASS
#define WIFI_PASS ""
#endif
#ifndef GUEST_URL
#define GUEST_URL ""
#endif

// ============================================================
// 硬件设置（按实际接线改）
// ============================================================

// 按钮：一脚接这个 GPIO，另一脚接 GND（用内部上拉，按下 = LOW）
const int BUTTON_PIN = 4;

// 灯：GPIO → 220Ω 电阻 → LED 正极，LED 负极接 GND
// 很多 ESP32 开发板 GPIO 2 上有板载蓝灯，没接线也能先看效果
const int LED_PIN = 2;

// 灯接法反过来（GPIO 输出 LOW 才亮）时改成 true
const bool LED_ACTIVE_LOW = false;

// 三色灯（红 / 黄 / 绿，各接一颗 LED：GPIO → 220Ω → LED 长脚，短脚接 GND）
//   红 = 正在连网络 / 服务端；黄 = 已连上，等主持人授权；绿 = 可以按
// 没接哪一颗就把它改成 -1。上面那颗单灯（GPIO 2）照旧工作，两种可以同时用
const int RED_PIN = 25;
const int YELLOW_PIN = 26;
const int GREEN_PIN = 27;

// 按住多久才算按下（毫秒）。0 = 一按就揭晓；怕误触可以改成 500
const unsigned long HOLD_MS = 0;

// 消抖时间（毫秒）
const unsigned long DEBOUNCE_MS = 30;

// 多久问一次服务端「现在能不能按」（毫秒）。主持人授权后，灯最多晚这么久才亮
const unsigned long POLL_MS = 500;

// 连续几次问不到才算和服务端断线（偶尔掉一个包，灯不会乱跳）
const int POLL_FAIL_LIMIT = 3;

// 设置用的 WiFi 热点密码（至少 8 位）。热点名称是 AwardButton- 加上这块板子编号的后 4 位
const char *AP_PASS = "award123";

// 开机多久连不上 WiFi，就打开设置网页（毫秒）
const unsigned long PORTAL_AFTER_MS = 60000;


// ============================================================
// 设置：存在 ESP32 的 NVS（断电不会丢）
// ============================================================

Preferences prefs;
String cfgSsid, cfgPass, cfgUrl;

void loadSettings() {
  prefs.begin("guestbtn", true);
  cfgSsid = prefs.getString("ssid", WIFI_SSID);
  cfgPass = prefs.getString("pass", WIFI_PASS);
  cfgUrl = prefs.getString("url", GUEST_URL);
  prefs.end();
}

void saveSettings() {
  prefs.begin("guestbtn", false);
  prefs.putString("ssid", cfgSsid);
  prefs.putString("pass", cfgPass);
  prefs.putString("url", cfgUrl);
  prefs.end();
}


// ============================================================
// 从嘉宾链接拆出主机、端口、密钥
// 例：http://192.168.1.10/guest?k=abcd1234  →  192.168.1.10 / 80 / abcd1234
// ============================================================

String host;
uint16_t port = 80;
String key;

bool parseGuestUrl(String u, String &h, uint16_t &p, String &k) {
  u.trim();
  if (u.startsWith("http://")) u = u.substring(7);
  else if (u.startsWith("https://")) return false;   // 服务端只有 http
  int slash = u.indexOf('/');
  if (slash < 0) return false;
  String hp = u.substring(0, slash);
  int colon = hp.indexOf(':');
  if (colon >= 0) {
    h = hp.substring(0, colon);
    p = hp.substring(colon + 1).toInt();
  } else {
    h = hp;
    p = 80;
  }
  int ki = u.indexOf("k=");
  if (ki < 0) return false;
  k = u.substring(ki + 2);
  int amp = k.indexOf('&');
  if (amp >= 0) k = k.substring(0, amp);
  return h.length() > 0 && p > 0 && k.length() > 0;
}


// ============================================================
// 灯
// ============================================================

// 灯号（优先级从上到下）：             单灯            三色灯
//   刚揭晓成功                          闪 3 下         绿闪 3 下
//   按了但还没授权 / 太快                短闪 1 下       红短闪 1 下
//   设置模式（手机连 AwardButton-XXXX）  慢闪            红黄轮流慢闪
//   正在连 WiFi 或服务端                 快闪            红常亮
//   嘉宾链接错误（密钥不对）             闪 2 下停一下   红闪 2 下停一下
//   已连上，等待授权                     灭              黄常亮
//   主持人已授权，可以按                 常亮            绿常亮
enum Status { ST_SETUP, ST_WIFI, ST_SERVER, ST_BADKEY, ST_READY };
Status status = ST_WIFI;
bool armed = false;
bool portalOn = false;    // 设置网页开着没有（灯号也要用，所以放这里）

unsigned long flashUntil = 0;   // 临时灯号（揭晓成功 / 被拒绝）结束的时间
unsigned long flashStart = 0;
bool flashGood = false;         // true = 揭晓成功（绿闪）；false = 被拒绝（红闪）

void pinOut(int pin, bool on) {
  if (pin >= 0) digitalWrite(pin, (on != LED_ACTIVE_LOW) ? HIGH : LOW);
}

void ledWrite(bool on) {
  pinOut(LED_PIN, on);
}

void rgbWrite(bool r, bool y, bool g) {
  pinOut(RED_PIN, r);
  pinOut(YELLOW_PIN, y);
  pinOut(GREEN_PIN, g);
}

void ledInit() {
  const int pins[] = { LED_PIN, RED_PIN, YELLOW_PIN, GREEN_PIN };
  for (int p : pins) {
    if (p < 0) continue;
    pinMode(p, OUTPUT);
    pinOut(p, false);
  }
}

void flash(int times, bool good) {
  flashStart = millis();
  flashUntil = flashStart + times * 200UL;
  flashGood = good;
}

void updateRgb(unsigned long now);   // 在下面

void updateLed() {
  unsigned long now = millis();
  if (now < flashUntil) {
    bool on = ((now - flashStart) % 200) < 100;
    ledWrite(on);
    rgbWrite(on && !flashGood, false, on && flashGood);
    return;
  }
  updateRgb(now);
  switch (status) {
    case ST_SETUP:
      ledWrite((now % 2000) < 1000);
      break;
    case ST_WIFI:
      if (portalOn) ledWrite((now % 2000) < 1000);   // 连不上 WiFi、设置网页已打开：和设置模式一样慢闪
      else ledWrite((now % 300) < 150);
      break;
    case ST_SERVER:
      ledWrite((now % 300) < 150);
      break;
    case ST_BADKEY: {
      unsigned long t = now % 1500;
      ledWrite(t < 120 || (t >= 240 && t < 360));
      break;
    }
    case ST_READY:
      ledWrite(armed);
      break;
  }
}

void updateRgb(unsigned long now) {
  bool slow = (now % 2000) < 1000;
  if (status == ST_SETUP || (status == ST_WIFI && portalOn)) rgbWrite(slow, !slow, false);   // 设置网页开着：红黄轮流
  else if (status == ST_WIFI || status == ST_SERVER) rgbWrite(true, false, false);
  else if (status == ST_BADKEY) {
    unsigned long t = now % 1500;
    rgbWrite(t < 120 || (t >= 240 && t < 360), false, false);
  } else rgbWrite(false, !armed, armed);   // ST_READY
}


// ============================================================
// 设置网页（手机连 ESP32 的热点后打开 http://192.168.4.1）
// ============================================================

WebServer web(80);
DNSServer dns;
bool setupOnly = false;   // true = 设置模式（不连服务端）；false = 连不上 WiFi 时顺便开的
String apName;

String esc(const String &s) {
  String o;
  for (unsigned int i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '&') o += "&amp;";
    else if (c == '<') o += "&lt;";
    else if (c == '>') o += "&gt;";
    else if (c == '"') o += "&quot;";
    else o += c;
  }
  return o;
}

// 密钥只显示后 4 位，不在网页上露出整条
String maskedUrl() {
  String h, k;
  uint16_t p;
  if (!parseGuestUrl(cfgUrl, h, p, k)) return cfgUrl.length() ? "（写法不对）" : "（还没设置）";
  return "http://" + h + (p == 80 ? "" : ":" + String(p)) + "/guest?k=…" + k.substring(k.length() > 4 ? k.length() - 4 : 0);
}

const char PAGE_HEAD[] PROGMEM = R"(<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>嘉宾按钮设置</title>
<style>body{font-family:sans-serif;max-width:480px;margin:0 auto;padding:16px;background:#f6f3ea;color:#222}
h1{font-size:20px}label{display:block;margin:14px 0 4px;font-weight:bold}
input,select{width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #bbb;border-radius:6px}
button{margin-top:18px;width:100%;padding:12px;font-size:17px;background:#b8860b;color:#fff;border:0;border-radius:6px}
.now{background:#fff;border-radius:6px;padding:10px;font-size:14px;line-height:1.7}.err{color:#b00020;font-weight:bold}
small{color:#666}</style></head><body><h1>🎤 嘉宾按钮设置</h1>)";

// 附近的 WiFi 选项：打开设置网页时扫一次存起来（扫描约 2 秒，每次开网页都扫的话手机会一直卡）
String wifiOptions;

void scanOptions() {
  Serial.println("[设置网页] 扫描附近的 WiFi …");
  int n = WiFi.scanNetworks();
  wifiOptions = "";
  for (int i = 0; i < n; i++) {
    String s = WiFi.SSID(i);
    if (!s.length() || wifiOptions.indexOf(">" + esc(s) + "<") >= 0) continue;   // 同名的只列一次
    wifiOptions += "<option>" + esc(s) + "</option>";
  }
  WiFi.scanDelete();
  Serial.printf("[设置网页] 扫到 %d 个 WiFi\n", n < 0 ? 0 : n);
}

void sendForm(const String &msg) {
  String h = FPSTR(PAGE_HEAD);
  if (msg.length()) h += "<p class=err>" + esc(msg) + "</p>";
  h += "<div class=now>现在的设置：<br>WiFi：" + esc(cfgSsid.length() ? cfgSsid : "（还没设置）") +
       "<br>嘉宾链接：" + esc(maskedUrl()) + "<br>板子编号：" + esc(apName) + "</div>";
  h += "<form method=post action=/save><label>现场 WiFi</label><select name=pick onchange=\"if(this.value)ssid.value=this.value\"><option value=''>— 从附近的 WiFi 选（或在下面直接输入）—</option>";
  h += wifiOptions;
  h += "</select><small>列表里没有？<a href=/rescan>重新扫描</a></small><input name=ssid id=ssid value=\"" + esc(cfgSsid) + "\" placeholder='WiFi 名称'>"
       "<label>WiFi 密码</label><input name=pass type=password placeholder='留空 = 不改'>"
       "<small>只支持 2.4 GHz、普通密码的 WiFi（要输入帐号的学校 WiFi 连不上）</small>"
       "<label>嘉宾链接</label><input name=url placeholder='留空 = 不改' autocapitalize=off autocomplete=off>"
       "<small>控制端右侧「嘉宾揭晓」→「复制」，整条贴上。例：http://192.168.1.10/guest?k=…</small>"
       "<button>保存并重启</button></form></body></html>";
  web.send(200, "text/html; charset=utf-8", h);
}

void handleSave() {
  String ssid = web.arg("ssid"), pass = web.arg("pass"), url = web.arg("url");
  ssid.trim();
  url.trim();
  if (!ssid.length()) return sendForm("请填 WiFi 名称");
  if (url.length()) {
    String h, k;
    uint16_t p;
    if (!parseGuestUrl(url, h, p, k)) return sendForm("嘉宾链接写法不对，请从控制端「嘉宾揭晓 → 复制」整条贴上");
    cfgUrl = url;
  } else if (!cfgUrl.length()) {
    return sendForm("请填嘉宾链接");
  }
  if (ssid != cfgSsid || pass.length()) cfgPass = pass;   // 换了 WiFi 就用新密码（开放 WiFi 可以留空）
  cfgSsid = ssid;
  saveSettings();
  Serial.println("设置已保存，重启");
  String h = FPSTR(PAGE_HEAD);
  h += "<p>✅ 已保存，按钮正在重启。</p><p>灯快闪 = 正在连线；熄灭 = 已连上服务端，等主持人授权。</p>"
       "<p>灯又变成慢闪：表示连不上 WiFi，60 秒后会再打开这个设置网页。</p></body></html>";
  web.send(200, "text/html; charset=utf-8", h);
  delay(1500);
  ESP.restart();
}

void startPortal(bool onlySetup) {
  if (portalOn) return;
  portalOn = true;
  setupOnly = onlySetup;
  WiFi.mode(WIFI_AP_STA);   // 留着 STA：才能扫描附近的 WiFi
  scanOptions();            // 热点开之前先扫：这时还没有手机连着，扫描不会让手机断线
  WiFi.softAP(apName.c_str(), AP_PASS);
  dns.start(53, "*", WiFi.softAPIP());   // 任何网址都指到设置页，手机会自动弹出
  web.on("/", HTTP_GET, []() {
    Serial.println("[设置网页] 有人打开了设置页");
    sendForm("");
  });
  web.on("/rescan", HTTP_GET, []() {
    scanOptions();
    web.sendHeader("Location", "/");
    web.send(302, "text/plain", "");
  });
  web.on("/save", HTTP_POST, []() {
    Serial.println("[设置网页] 收到保存");
    handleSave();
  });
  // 其它网址（手机 / 电脑检测「要不要登录」用的）一律转到设置页。
  // ⚠ Windows 会改开 https://www.msn.com，HTTPS 转不过来，只能手动打开 http://192.168.4.1
  web.onNotFound([]() {
    Serial.printf("[设置网页] %s%s → 转到设置页\n", web.hostHeader().c_str(), web.uri().c_str());
    web.sendHeader("Location", "http://192.168.4.1/");
    web.send(302, "text/plain", "");
  });
  web.begin();
  Serial.printf("设置网页已打开：手机连 WiFi「%s」（密码 %s），浏览器打开 http://192.168.4.1\n", apName.c_str(), AP_PASS);
}

void stopPortal() {
  if (!portalOn) return;
  web.stop();
  dns.stop();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  portalOn = false;
  Serial.println("WiFi 已连上，关闭设置网页");
}


// ============================================================
// 问服务端：现在能不能按（每 POLL_MS 一次，以服务端的回答为准）
//   GET /api/guest/button?k=密钥&id=AwardButton-XXXX&rssi=-55&rtt=12&miss=0&up=123&v=2
//   → 200 {"armed":true} / {"armed":false}；403 = 密钥不对；404 = 服务端太旧（1.38 以前）
// 信号（rssi，dBm）、上一次的延迟（rtt，毫秒）、开机以来失败几次（miss）给控制端看
// ============================================================

const char *FW_VER = "2";   // 按钮程序的版本，控制端看得到
const uint16_t HTTP_TIMEOUT_MS = 1500;

// 问状态和揭晓共用一条连接（keep-alive），量到的延迟就是一次请求来回的时间，不含重新连线
WiFiClient net;
HTTPClient http;
unsigned long nextPollAt = 0;
int pollFails = 0;          // 连续失败几次
long lastRtt = -1;          // 上一次的延迟（毫秒），-1 = 还没有
uint32_t missCount = 0;     // 开机以来失败几次

void setArmed(bool a) {
  if (a == armed) return;
  armed = a;
  Serial.println(armed ? "主持人已授权：可以按" : "授权已收回");
}

// 发一个请求，回传 HTTP 状态码（< 0 = 连不上 / 超时），body 收回应内容
int httpCall(bool post, const String &uri, String &body, uint16_t timeoutMs) {
  http.setReuse(true);
  http.setConnectTimeout(1000);
  http.setTimeout(timeoutMs);
  if (!http.begin(net, host, port, uri)) return -1;
  int code;
  if (post) {
    http.addHeader("X-AC", "1");
    code = http.POST("");
  } else {
    code = http.GET();
  }
  body = code > 0 ? http.getString() : "";   // 读完回应，连接才能留着下次用
  http.end();
  return code;
}

// 和服务端断线：灯回到「正在连服务端」，不能按
void serverLost(const char *why) {
  if (status == ST_READY) Serial.printf("和服务端断线（%s），重连中\n", why);
  status = ST_SERVER;
  setArmed(false);
  net.stop();
}

void pollServer() {
  unsigned long now = millis();
  if (now < nextPollAt) return;
  String uri = "/api/guest/button?k=" + key + "&id=" + apName + "&rssi=" + String(WiFi.RSSI()) +
               "&miss=" + String(missCount) + "&up=" + String(now / 1000) + "&v=" + FW_VER;
  if (lastRtt >= 0) uri += "&rtt=" + String(lastRtt);
  String body;
  int code = httpCall(false, uri, body, HTTP_TIMEOUT_MS);
  unsigned long rtt = millis() - now;
  nextPollAt = millis() + POLL_MS;
  if (code == 200) {
    lastRtt = rtt;
    pollFails = 0;
    if (status != ST_READY) Serial.printf("已连上服务端（延迟 %lu ms），等待主持人授权\n", rtt);
    status = ST_READY;
    setArmed(body.indexOf("\"armed\":true") >= 0);
    return;
  }
  if (code == 403) {
    if (status != ST_BADKEY) Serial.println("嘉宾链接错误（403）：插电时按住按钮 3 秒进入设置模式，贴上最新的嘉宾链接");
    status = ST_BADKEY;
    setArmed(false);
    nextPollAt = millis() + 10000;   // 10 秒后再试（主持人可能会改回来）
    return;
  }
  missCount++;
  if (code == 404) {
    if (status != ST_SERVER || pollFails == 0) Serial.println("服务端版本太旧（没有 /api/guest/button）：请把颁奖系统更新到 1.38 以上");
    pollFails = POLL_FAIL_LIMIT;
    serverLost("服务端太旧");
    nextPollAt = millis() + 5000;
    return;
  }
  pollFails++;
  if (status == ST_READY && pollFails < POLL_FAIL_LIMIT) {
    Serial.printf("问服务端失败（%d），第 %d 次\n", code, pollFails);
    nextPollAt = millis() + 200;   // 先快快再问一次
    return;
  }
  if (status == ST_READY || pollFails == POLL_FAIL_LIMIT) Serial.println("连不上服务端：检查服务端有没有开、电脑 IP 有没有变");
  serverLost(code < 0 ? "没有回应" : "服务端回应错误");
  nextPollAt = millis() + 1000;
}


// ============================================================
// 揭晓
// ============================================================

void reveal() {
  if (status != ST_READY) {
    Serial.println("还没连上服务端，这一下不算");
    flash(1, false);
    return;
  }
  String body;
  unsigned long t0 = millis();
  int code = httpCall(true, "/api/guest/reveal?k=" + key, body, 3000);
  Serial.printf("揭晓请求 %lu ms\n", millis() - t0);
  nextPollAt = 0;   // 马上再问一次能不能按（揭晓完服务端会自动收回授权）
  if (code == 200) {
    Serial.println("揭晓成功");
    flash(3, true);
  } else if (code == 409) {
    Serial.println("主持人还没授权（409）");
    flash(1, false);
  } else if (code == 429) {
    Serial.println("按太快了，1 秒内只算一次（429）");
    flash(1, false);
  } else if (code == 403) {
    Serial.println("嘉宾链接错误（403）");
    status = ST_BADKEY;
    setArmed(false);
  } else {
    Serial.printf("揭晓失败：%d\n", code);
    flash(1, false);
  }
}


// ============================================================
// 按钮（消抖 + 按住时间）
// ============================================================

bool rawPressed = false;
bool stablePressed = false;
unsigned long lastChange = 0;
unsigned long pressedAt = 0;
bool fired = false;

void readButton() {
  unsigned long now = millis();
  bool p = digitalRead(BUTTON_PIN) == LOW;
  if (p != rawPressed) {
    rawPressed = p;
    lastChange = now;
  }
  if (now - lastChange >= DEBOUNCE_MS && stablePressed != rawPressed) {
    stablePressed = rawPressed;
    if (stablePressed) {
      pressedAt = now;
      fired = false;
    }
  }
  if (stablePressed && !fired && now - pressedAt >= HOLD_MS) {
    fired = true;   // 一直按着也只算一次，要放开再按
    reveal();
  }
}


// ============================================================
// WiFi
// ============================================================

unsigned long wifiSince = 0;   // 从什么时候开始连不上
volatile bool selfDisconnect = false;   // 自己调用 disconnect() 造成的断线，不用报

// 断线原因（ESP-IDF 的 wifi_err_reason_t）翻成中文
const char *wifiReasonText(uint8_t r) {
  switch (r) {
    case 2: case 15: case 204: return "密码不对，或路由器拒绝（握手超时）";
    case 202: return "密码不对（认证失败）";
    case 201: return "找不到这个 WiFi：名称打错、是 5 GHz、或离太远";
    case 210: case 211: return "找到 WiFi，但加密方式不支持（要 WPA2 / WPA3 个人版）";
    case 212: return "WiFi 信号太弱";
    case 23: return "这是要帐号密码的企业 WiFi，ESP32 连不上";
    case 200: return "收不到路由器信号（信号弱或路由器重启）";
    case 203: case 205: return "路由器拒绝连接（可能人数满了或有 MAC 过滤）";
    case 3: case 8: return "主动断开";
    case 4: return "连接超时";
    default: return "其它原因";
  }
}

const char *wifiStatusText(int s) {
  switch (s) {
    case WL_IDLE_STATUS: return "空闲 / 正在连";
    case WL_NO_SSID_AVAIL: return "找不到这个 WiFi";
    case WL_CONNECTED: return "已连上";
    case WL_CONNECT_FAILED: return "连接失败（多半是密码不对）";
    case WL_CONNECTION_LOST: return "连接中断";
    case WL_DISCONNECTED: return "未连上";
    default: return "其它";
  }
}

void onWifiEvent(WiFiEvent_t e, WiFiEventInfo_t info) {
  if (e == ARDUINO_EVENT_WIFI_AP_STACONNECTED) {
    Serial.printf("[热点] 有设备连上设置热点（现在 %d 台）。浏览器打开 http://192.168.4.1（不是 https）\n", WiFi.softAPgetStationNum());
  } else if (e == ARDUINO_EVENT_WIFI_AP_STADISCONNECTED) {
    Serial.println("[热点] 有设备离开设置热点");
  } else if (e == ARDUINO_EVENT_WIFI_STA_CONNECTED) {
    Serial.println("[WiFi] 已连上路由器，等待分配 IP …");
  } else if (e == ARDUINO_EVENT_WIFI_STA_GOT_IP) {
    Serial.print("[WiFi] 拿到 IP：");
    Serial.println(WiFi.localIP());
  } else if (e == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
    uint8_t r = info.wifi_sta_disconnected.reason;
    if (selfDisconnect && (r == 3 || r == 8)) { selfDisconnect = false; return; }
    Serial.printf("[WiFi] 断线，原因 %u：%s\n", r, wifiReasonText(r));
  }
}

// 开机扫一次附近的 WiFi，看要连的那个在不在、信号多强
void scanWifi() {
  Serial.println("[WiFi] 扫描附近的 WiFi …");
  int n = WiFi.scanNetworks();
  if (n <= 0) {
    Serial.println("[WiFi] 附近一个 WiFi 都没扫到（天线 / 板子有问题？）");
    return;
  }
  bool found = false;
  for (int i = 0; i < n && i < 20; i++) {
    bool me = WiFi.SSID(i) == cfgSsid;
    if (me) found = true;
    Serial.printf("  %s %-24s 信号 %4d dBm  频道 %2d  %s\n", me ? "→" : " ", WiFi.SSID(i).c_str(), WiFi.RSSI(i), WiFi.channel(i),
                  WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "无密码" : WiFi.encryptionType(i) == WIFI_AUTH_WPA2_ENTERPRISE ? "企业版（连不上）" : "有密码");
  }
  WiFi.scanDelete();
  if (found) Serial.printf("[WiFi] 找到「%s」（上面打 → 的那个）\n", cfgSsid.c_str());
  else Serial.printf("[WiFi] ⚠ 附近没有「%s」：检查名称（大小写、空格）；ESP32 看不到 5 GHz 的 WiFi\n", cfgSsid.c_str());
}

// 每 3 秒印一行现况，看得出卡在哪一步
void heartbeat() {
  static unsigned long last = 0;
  if (millis() - last < 3000) return;
  last = millis();
  const char *st = status == ST_SETUP ? "设置模式" : status == ST_WIFI ? "连 WiFi 中" : status == ST_SERVER ? "连服务端中"
                 : status == ST_BADKEY ? "嘉宾链接错误" : "已连上服务端";
  Serial.printf("[现况] %s ｜ WiFi：%s", st, wifiStatusText(WiFi.status()));
  if (WiFi.status() == WL_CONNECTED) Serial.printf("（%s，信号 %d dBm）", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  else if (!setupOnly && wifiSince && !portalOn) Serial.printf("（%lu 秒后打开设置网页）", (PORTAL_AFTER_MS - min(PORTAL_AFTER_MS, millis() - wifiSince)) / 1000);
  if (status == ST_READY) Serial.printf(" ｜ 延迟 %ld ms ｜ %s", lastRtt, armed ? "已授权，可以按" : "等主持人授权");
  if (portalOn) Serial.printf(" ｜ 设置网页开着：手机连「%s」", apName.c_str());
  static unsigned long downSince = 0;
  bool down = digitalRead(BUTTON_PIN) == LOW;
  if (!down) downSince = 0;
  else if (!downSince) downSince = millis();
  Serial.print(down ? " ｜ 按钮：按下" : " ｜ 按钮：松开");
  Serial.println();
  if (downSince && millis() - downSince > 10000)
    Serial.println("[注意] 按钮已经连续按下超过 10 秒：检查接线（四脚按钮要接「对角」的两只脚，接到同一边的两只脚会一直是按下）");
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiSince = 0;
    return;
  }
  if (status != ST_WIFI) {
    Serial.println("WiFi 断了，重连中");
    net.stop();
    setArmed(false);
    pollFails = 0;
    status = ST_WIFI;
  }
  if (wifiSince == 0) wifiSince = millis();
  if (!portalOn && millis() - wifiSince > PORTAL_AFTER_MS) startPortal(false);
  // 设置网页开着时少试几次：重连会让热点短暂断线，手机上的网页容易卡住
  static unsigned long lastBegin = 0;
  unsigned long every = portalOn ? 30000 : 15000;
  if (lastBegin == 0 || millis() - lastBegin > every) {
    lastBegin = millis();
    Serial.printf("[WiFi] 连接「%s」…（密码 %u 位）\n", cfgSsid.c_str(), cfgPass.length());
    selfDisconnect = true;
    WiFi.disconnect();
    WiFi.begin(cfgSsid.c_str(), cfgPass.c_str());
  }
}


// ============================================================

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  ledInit();
  delay(300);
  Serial.println();
  Serial.println("=== 嘉宾实体揭晓按钮 ===");

  uint64_t mac = ESP.getEfuseMac();
  char id[5];
  snprintf(id, sizeof(id), "%04X", (unsigned)((mac >> 32) & 0xFFFF));
  apName = String("AwardButton-") + id;

  WiFi.onEvent(onWifiEvent);   // 设置模式也要：看得到手机有没有连上设置热点
  loadSettings();
  // 插电时按住按钮 3 秒 = 进入设置模式（灯快闪时放开就是正常开机）。
  // 保存设置后程序自己重启（ESP_RST_SW）不检查，免得按钮接线有问题时一直回到设置模式。
  bool held = false;
  if (esp_reset_reason() != ESP_RST_SW && digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("开机时按钮是按下的：继续按住 3 秒进入设置模式，放开 = 正常开机");
    unsigned long t0 = millis();
    while (digitalRead(BUTTON_PIN) == LOW && millis() - t0 < 3000) {
      bool on = (millis() / 100) % 2;
      ledWrite(on);
      rgbWrite(false, on, false);   // 黄灯快闪
      delay(10);
    }
    ledWrite(false);
    rgbWrite(false, false, false);
    held = millis() - t0 >= 3000;
  }
  Serial.printf("按钮（GPIO %d）现在：%s\n", BUTTON_PIN, digitalRead(BUTTON_PIN) == LOW ? "按下" : "松开");
  bool ok = cfgSsid.length() && parseGuestUrl(cfgUrl, host, port, key);
  if (held || !ok) {
    Serial.println(held ? "按住按钮 3 秒：进入设置模式" : "还没设置好（WiFi 或嘉宾链接）：进入设置模式");
    status = ST_SETUP;
    startPortal(true);
    return;
  }
  // 名称前后有空格很难看出来，所以加上「」和长度
  Serial.printf("设置：WiFi「%s」（%u 个字节）；服务端 %s:%u\n", cfgSsid.c_str(), cfgSsid.length(), host.c_str(), port);
  Serial.printf("设置用热点：%s（插电时按住按钮 3 秒可以进入设置模式）\n", apName.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);   // 关掉省电，按下去反应更快
  scanWifi();
}

void loop() {
  if (portalOn) {
    dns.processNextRequest();
    web.handleClient();
  }
  heartbeat();
  if (setupOnly) {   // 设置模式：只等手机来改设置
    updateLed();
    delay(2);
    return;
  }
  ensureWifi();
  if (WiFi.status() == WL_CONNECTED) {
    if (portalOn) stopPortal();
    if (status == ST_WIFI) {
      Serial.print("WiFi 已连上，本机 IP：");
      Serial.println(WiFi.localIP());
      status = ST_SERVER;
    }
    pollServer();   // 链接错误时 10 秒后再试一次
  }
  readButton();
  updateLed();
  delay(1);
}
