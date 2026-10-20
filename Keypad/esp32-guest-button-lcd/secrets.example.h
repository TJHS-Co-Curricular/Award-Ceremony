// （可以不用这个文件）设置一般用手机网页改：插电时按住按钮 → 手机连「AwardButton-XXXX」→ 打开 http://192.168.4.1
//
// 想在烧录时就先写好默认值：复制这个文件，改名为 secrets.h（同一个文件夹），再填下面三项。
// 只在 ESP32「还没用网页设置过」时才会用到；网页保存过之后，以网页的为准。
// ⚠ secrets.h 含 WiFi 密码和嘉宾密钥，已在 .gitignore 里排除，不会进 git。

// 现场 WiFi（只支持 2.4 GHz、普通密码的 WiFi；要输入帐号的学校 WiFi 连不上）
#define WIFI_SSID "现场WiFi名称"
#define WIFI_PASS "WiFi密码"

// 嘉宾链接：控制端右侧「嘉宾揭晓」→「复制」，整条贴在这里
#define GUEST_URL "http://192.168.1.10/guest?k=0000000000000000"
