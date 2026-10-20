# 嘉宾实体揭晓按钮（Raspberry Pi Pico + CircuitPython，测试版）
#
# 普通 Pico 没有 WiFi，所以插 USB 到一台电脑，由电脑上的 bridge.js 代它连服务端：
#   Pico  → 电脑：按下按钮时送一行 "KEY:DOWN"
#   电脑 → Pico：每秒送一行灯号 "L:..."，Pico 照着亮灯
# 灯号和 ESP32 版（esp32-guest-button）一样，测试好了换 ESP32 就能直接用 WiFi。
#
# 用法：把这个文件复制到 CIRCUITPY 盘，覆盖原本的 code.py（原本的 MIDI 版在 Keypad/code.py 有一份）。

import time
import sys
import board
import digitalio
import supervisor


# ============================================================
# 硬件设置（按实际接线改）
# ============================================================

# 默认用原本 9 键键盘的第 1 个键（MA）和它的灯，不用重新接线
# 单键盒：按钮一脚接这个脚位、另一脚接 GND；灯 = 脚位 → 220Ω → LED 正极，负极接 GND
BUTTON_PIN = board.GP18
LED_PIN = board.GP1

# 按住多久才算按下（秒）。0 = 一按就揭晓；怕误触可以改成 0.5
HOLD_TIME = 0

# 消抖时间（秒）
DEBOUNCE_TIME = 0.03

# 多久没收到电脑的灯号，就当作 bridge 没在跑（快闪）
LINK_TIMEOUT = 3.0


# ============================================================
# 初始化
# ============================================================

button = digitalio.DigitalInOut(BUTTON_PIN)
button.direction = digitalio.Direction.INPUT
button.pull = digitalio.Pull.UP   # 松开 = HIGH，按下 = LOW

led = digitalio.DigitalInOut(LED_PIN)
led.direction = digitalio.Direction.OUTPUT
led.value = False


# ============================================================
# 灯号（和 ESP32 版一样）
#   快闪          正在连服务端 / bridge 没在跑
#   灭            已连上，等待授权
#   常亮          主持人已授权，可以按
#   闪 3 下       刚揭晓成功
#   短闪 1 下     按了但没授权 / 太快
#   闪 2 下停一下  嘉宾链接错误
# ============================================================

state = "WAIT"        # 电脑送来的状态：WAIT / IDLE / ARMED / BAD
last_link = -100.0    # 最后一次收到电脑灯号的时间
flash_start = 0.0
flash_until = 0.0


def flash(times):
    global flash_start, flash_until
    flash_start = time.monotonic()
    flash_until = flash_start + times * 0.2


def update_led(now):
    if now < flash_until:
        led.value = ((now - flash_start) % 0.2) < 0.1
        return
    s = state if now - last_link < LINK_TIMEOUT else "WAIT"
    if s == "ARMED":
        led.value = True
    elif s == "IDLE":
        led.value = False
    elif s == "BAD":
        t = now % 1.5
        led.value = t < 0.12 or 0.24 <= t < 0.36
    else:
        led.value = (now % 0.3) < 0.15


# ============================================================
# 读电脑送来的灯号（不卡住主循环）
# ============================================================

line_buf = ""


def handle_line(line):
    global state, last_link
    if not line.startswith("L:"):
        return
    cmd = line[2:]
    last_link = time.monotonic()
    if cmd in ("WAIT", "IDLE", "ARMED", "BAD"):
        state = cmd
    elif cmd == "OK":
        flash(3)
    elif cmd == "NO":
        flash(1)


def read_serial():
    global line_buf
    n = supervisor.runtime.serial_bytes_available
    if not n:
        return
    line_buf += sys.stdin.read(n)
    while "\n" in line_buf:
        line, line_buf = line_buf.split("\n", 1)
        handle_line(line.strip())
    if len(line_buf) > 100:   # 收到乱码，丢掉
        line_buf = ""


# ============================================================
# 主循环：按钮消抖 + 按住时间
# ============================================================

raw = False
stable = False
last_change = 0.0
pressed_at = 0.0
fired = False

print("KEY:HELLO")

while True:
    now = time.monotonic()
    read_serial()

    p = not button.value
    if p != raw:
        raw = p
        last_change = now
    if now - last_change >= DEBOUNCE_TIME and stable != raw:
        stable = raw
        if stable:
            pressed_at = now
            fired = False
    if stable and not fired and now - pressed_at >= HOLD_TIME:
        fired = True   # 一直按着也只算一次，要放开再按
        if now - last_link < LINK_TIMEOUT:
            print("KEY:DOWN")
        else:
            flash(1)   # bridge 没在跑，这一下不算

    update_led(now)
    time.sleep(0.001)
