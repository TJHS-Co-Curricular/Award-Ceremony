import board
import digitalio
import time
import usb_midi
import adafruit_midi
from adafruit_midi.note_on import NoteOn
from adafruit_midi.note_off import NoteOff


# ============================================================
# USB 初始化等待
# ============================================================

# 等待电脑完成 USB / MIDI 设备识别
# 这样开机跑马灯也能正常显示
time.sleep(2.0)


# ============================================================
# 硬件引脚定义
# ============================================================

# 9 个按键
switch_pins = [
    board.GP18,  # 1 - MA
    board.GP17,  # 2 - Full
    board.GP16,  # 3 - Highlight
    board.GP15,  # 4 - Solo
    board.GP10,  # 5 - Up
    board.GP6,   # 6 - Prev
    board.GP11,  # 7 - Set
    board.GP13,  # 8 - Next
    board.GP14   # 9 - Down
]

# 9 个 LED
led_pins = [
    board.GP1,   # 1
    board.GP19,  # 2
    board.GP20,  # 3
    board.GP4,   # 4
    board.GP9,   # 5
    board.GP5,   # 6
    board.GP8,   # 7
    board.GP12,  # 8
    board.GP7    # 9
]


# ============================================================
# MIDI Note 映射
# ============================================================

midi_notes = [
    1,  # 1: 独立按键 -> MA
    2,  # 2: 顶部排 -> Full
    3,  # 3: 顶部排 -> Highlight
    4,  # 4: 顶部排 -> Solo
    5,  # 5: 十字上 -> Up
    6,  # 6: 十字左 -> Prev
    7,  # 7: 十字中 -> Set
    8,  # 8: 十字右 -> Next
    9   # 9: 十字下 -> Down
]


# ============================================================
# 按键初始化
# ============================================================

switches = []

for pin in switch_pins:

    sw = digitalio.DigitalInOut(pin)

    # GPIO 输入
    sw.direction = digitalio.Direction.INPUT

    # 使用内部上拉
    # 按键：
    #   松开 = HIGH
    #   按下 = LOW
    sw.pull = digitalio.Pull.UP

    switches.append(sw)


# ============================================================
# LED 初始化
# ============================================================

leds = []

for pin in led_pins:

    led = digitalio.DigitalInOut(pin)

    # GPIO 输出
    led.direction = digitalio.Direction.OUTPUT

    # 开机默认关闭
    led.value = False

    leds.append(led)


# ============================================================
# USB MIDI 初始化
# ============================================================

# MIDI Channel 使用 0-based：
#
# out_channel=0 = MIDI Channel 1
# out_channel=1 = MIDI Channel 2
#
# 这里保持 MIDI Channel 1

midi = adafruit_midi.MIDI(
    midi_out=usb_midi.ports[1],
    out_channel=0
)


# ============================================================
# 参数
# ============================================================

# 开机跑马灯：单颗 LED 点亮的时间
MARQUEE_ON_TIME = 1.0

# 开机跑马灯每一步之间的时间
STEP_DELAY = 0.15

# 按键消抖时间
# 30 ms 对机械按键比较安全
DEBOUNCE_TIME = 0.03

# 方向键（Up / Prev / Set / Next / Down）按一下闪烁的时间
# 这几个键在 MA2 Wing 上是瞬时动作，不是开关，所以按一下就短亮一下即可
BUTTON_FLASH_TIME = 1.0

# 哪几个按键要做成 MA2 Wing 那种「常亮开关」效果
# index 对应 switch_pins / led_pins / midi_notes 的顺序：
#   0 = MA, 1 = Full, 2 = Highlight, 3 = Solo
# 这四个键在真实 MA2 Wing 上就是按一下切换开/关，灯常亮直到再按一次
TOGGLE_KEY_INDEXES = (0, 1, 2, 3)


# ============================================================
# LED 定时关闭控制
# ============================================================

# 保存每颗 LED 的关闭时间
#
# None = 不需要自动关闭
# 时间值 = 到这个时间后关闭
#
# 用于：开机跑马灯 + 方向键（Up/Prev/Set/Next/Down）的短暂闪烁
# MA/Full/Highlight/Solo 这四个开关键不用这个机制，它们由 led_state 直接控制

led_off_at = [None] * len(leds)


def update_leds(now):
    """
    检查所有 LED 是否到了自动关闭时间。
    """

    for i, off_time in enumerate(led_off_at):

        if off_time is not None:

            if now >= off_time:

                leds[i].value = False

                led_off_at[i] = None


# ============================================================
# 开机跑马灯
# ============================================================

for i in range(len(leds)):

    now = time.monotonic()

    # 当前 LED 打开
    leds[i].value = True

    # 设置自动关闭时间
    led_off_at[i] = now + MARQUEE_ON_TIME

    # 等待下一颗 LED 的时间
    step_end = now + STEP_DELAY

    while time.monotonic() < step_end:

        update_leds(time.monotonic())

        time.sleep(0.01)


# 等待所有跑马灯 LED 熄灭
while any(t is not None for t in led_off_at):

    now = time.monotonic()

    update_leds(now)

    time.sleep(0.01)


# ============================================================
# 按键状态初始化
# ============================================================

# raw_state
#
# 当前 GPIO 原始读取结果
#
# False = 松开
# True  = 按下

raw_state = [False] * len(switches)


# stable_state
#
# 经过消抖确认之后的稳定状态
#
# False = 松开
# True  = 按下

stable_state = [False] * len(switches)


# 每个按键最后一次发生原始状态变化的时间
last_change = [0.0] * len(switches)


# ============================================================
# LED 状态（MA2 风格：切换保持）
# ============================================================

# led_state
#
# 只给 TOGGLE_KEY_INDEXES 里的按键用（MA / Full / Highlight / Solo）
#
# False = 灭
# True  = 亮
#
# 和 MA2 Wing 上的这几个键一样：
# 按一下切换到"亮"，一直保持，直到再按一下才切回"灭"

led_state = [False] * len(leds)


# ============================================================
# 正常按键主循环
# ============================================================

while True:

    now = time.monotonic()

    # --------------------------------------------------------
    # 扫描 9 个按键
    # --------------------------------------------------------

    for i, sw in enumerate(switches):

        # GPIO 使用内部上拉：
        #
        # 松开 = HIGH = sw.value True
        # 按下 = LOW = sw.value False
        #
        # 所以这里反转
        pressed = not sw.value


        # ----------------------------------------------------
        # 检查原始状态是否发生变化
        # ----------------------------------------------------

        if pressed != raw_state[i]:

            # 保存新的原始状态
            raw_state[i] = pressed

            # 记录状态变化发生的时间
            last_change[i] = now


        # ----------------------------------------------------
        # 消抖确认
        # ----------------------------------------------------

        # 原始状态持续稳定超过 30 ms
        if (now - last_change[i]) >= DEBOUNCE_TIME:

            # 确认稳定状态真的发生改变
            if stable_state[i] != raw_state[i]:

                # 更新稳定状态
                stable_state[i] = raw_state[i]


                # =================================================
                # 按下
                # =================================================

                if stable_state[i]:

                    if i in TOGGLE_KEY_INDEXES:

                        # MA2 Wing 风格切换（MA / Full / Highlight / Solo）：
                        # 灭 -> 亮，或者 亮 -> 灭
                        # 不会自动熄灭，要再按一次才会变化
                        led_state[i] = not led_state[i]
                        leds[i].value = led_state[i]

                    else:

                        # 方向键：短亮一下就好，不需要保持
                        leds[i].value = True
                        led_off_at[i] = now + BUTTON_FLASH_TIME


                    # 发送 MIDI Note On
                    #
                    # Note:
                    #   1 ~ 9
                    #
                    # Velocity:
                    #   127
                    #
                    midi.send(
                        NoteOn(
                            midi_notes[i],
                            127
                        )
                    )


                # =================================================
                # 松开
                # =================================================

                else:

                    # 松开手指不影响 LED：
                    # 开关键保持切换后的状态；方向键则由上面设置的
                    # led_off_at 定时熄灭，这里不用管

                    # 发送 MIDI Note Off
                    #
                    # Velocity:
                    #   0
                    #
                    midi.send(
                        NoteOff(
                            midi_notes[i],
                            0
                        )
                    )


    # --------------------------------------------------------
    # 更新方向键的定时熄灭
    # --------------------------------------------------------

    update_leds(now)


    # --------------------------------------------------------
    # 很短的扫描间隔
    # --------------------------------------------------------

    time.sleep(0.001)