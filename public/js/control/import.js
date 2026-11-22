/*
 * 控制端 · 从 Excel / Google Sheets / CSV 批量导入（有表头时按表头名称对应列），以及学会对照表。
 * 提供：parseRows、doImport、modeOf、SOC、socFind、socOf、socMissing、socLoad
 */
"use strict";

function parseRows(text) {
  const tab = text.includes("\t");
  const lines = joinRows(text.split(/\r?\n/), tab ? "\t" : ",", false);   // Excel 里有换行的格子（多行备注）复制出来是 "第一行⏎第二行"，先接回同一行
  const splitCsv = (l) => {
    const out = [];
    let cur = "",
      q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) {
        if (c === '"' && l[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const rows = lines.map((l) =>
    (tab ? l.split("\t").map(unquote) : splitCsv(l)).map((x) => x.trim()),
  );
  // 有表头：按表头名称对应列（列顺序可以随意）
  // 顺序就是优先级：「分类英文」要先于「分类」，「奖项英文 / 副标题」要先于「奖项」
  // 学会的列（学会编号 / 学会名字(中) / 学会名字(英)…）只能对应学会，不会被「编号」「名字」误认成学号、姓名
  // 也认得社团 / 单位 / 部门 / 队伍，和「名单第 4 栏的名称」（socL()，给别的部门用，维护者定 2026-11-22）
  const SOC_W = "学会|學會|社团|社團|单位|單位|部门|部門|队伍|隊伍|society|club|unit|dept" + (/^(班级|学号|姓名|奖项|备注|类型|照片)$/.test(socL()) ? "" : "|" + socL().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const SOC_HEAD = new RegExp(SOC_W, "i");
  const H = [
    ["socName", new RegExp(`(${SOC_W}).*(名|name)`, "i")],
    ["soc", SOC_HEAD],
    // 三个显示设定（要先于「大类」「分类」「学号(编号)」）：值写 显示 / 不显示、列出 / 不列（1.59）
    ["sectionNoList", /(大类|大類|section).*(列出|列表|list)/i],
    ["sectionNoNum", /(大类|大類|section).*(编号|編號|number|\bnum)/i],
    ["groupNoNum", /(分类|分類|类别|類別|group|category).*(编号|編號|number|\bnum)/i],
    ["sectionSub", /(大类|大類|section).*(英文|english|en\b)/i],
    ["section", /大类|大類|section/i],
    [
      "groupSub",
      /(分类|分類|类别|類別|组别|組別|大项|group|category).*(英文|english|en\b)/i,
    ],
    [
      "group",
      /分类|分類|类别|類別|组别|組別|大项|大項|group|category/i,
    ],
    ["mode", /(揭晓|揭曉|公布).*(方式|模式)|^方式$|reveal.?mode|^mode$/i],   // 要先于「奖项」：「奖项揭晓方式」也算这一列
    ["subtitle", /副标题|副標題|英文|subtitle|english/i],
    ["title", /奖项|獎項|award/i],
    ["name", /姓名|名字|^name$/i],
    ["cls", /班级|班別|班别|class/i],
    ["sid", /学号|學號|编号|student.?id|^id$/i],
    ["photo", /照片|相片|photo|image|图片/i],
    ["detail", /备注|備註|说明|note|detail/i],
    ["type", /类型|類型|type|kind/i],
    ["win", /得主|结果|結果|winner|result/i],
  ];
  let map = null;
  const isHead = (row) =>
    row.some((c) => /奖项|獎項|award/i.test(c)) &&
    row.some((c) => /姓名|名字|^name$/i.test(c));
  if (rows.length && isHead(rows[0])) {
    const head = rows.shift();
    map = {};
    head.forEach((c, j) => {
      const hit = H.find(
        ([k, re]) =>
          map[k] == null &&
          re.test(c) &&
          (!SOC_HEAD.test(c) || k.startsWith("soc")),
      );
      if (hit) map[hit[0]] = j;
    });
  }
  const out = [], skipped = [];
  rows
    .map((r) => {
      if (!map) {
        // 没有表头：奖项名称 | 学会 | 姓名 | 班级 | 学号 | 照片文件名 | 备注 | 类型 | 得主
        const [cls = "", sid = "", ...more] = r.slice(3);
        return { title: r[0], name: r[2], rest: [cls, sid, r[1] || "", ...more] };
      }
      const g = (k) => (map[k] != null ? r[map[k]] || "" : "");
      return {
        title: g("title"),
        subtitle: g("subtitle"),
        section: g("section"),
        sectionSub: g("sectionSub"),
        group: g("group"),
        groupSub: g("groupSub"),
        name: g("name"),
        rest: [g("cls"), g("sid"), g("soc") || g("socName"), g("detail")],   // 有学会编号就存编号，没有才存学会名字
        photo: g("photo"),
        type: g("type"),
        win: g("win"),
        mode: g("mode"),
        flags: { sectionNoList: g("sectionNoList"), sectionNoNum: g("sectionNoNum"), groupNoNum: g("groupNoNum") },
      };
    })
    .forEach((r, i) => {
      // 团体常常只填「学会」、姓名留空：用学会的中文名（对照表查得到时）或学会栏原文当名字
      if (!r.name && r.rest[2]) r.name = socFind(r.rest[2])?.zh || r.rest[2];
      if (r.title && r.name) out.push(r);
      else skipped.push(rows[i].filter(Boolean).join(" · ").slice(0, 40));   // 缺奖项名称或姓名：不导入，但要告诉用户
    });
  out.skipped = skipped;
  return out;
}
// 显示设定列：「不显示 / 不列 / 否 / no」→ true（= 关掉）；「显示 / 列出 / 是」→ false；空着 → null（不改）
function flagOf(t) {
  const s = String(t || "").replace(/\s+/g, "");
  if (!s) return null;
  return /不|否|关|關|^(no|off|false|0|×|x)$/i.test(s);
}
// 「揭晓方式」列的文字 → revealMode（不分大小写、忽略空格；看不懂返回 null）
function modeOf(t) {
  const s = String(t || "").replace(/\s+/g, "");
  if (/先一后全|先一後全|firstall/i.test(s)) return "firstall";
  if (/入围|入圍|得主|nominee/i.test(s)) return "nominee";
  if (/一次|全部|同时|同時|^all$/i.test(s)) return "all";
  if (/逐一|逐个|逐個|一个一个|一個一個|^one$/i.test(s)) return "one";
  return null;
}
const impKey = (s) => String(s || "").replace(/^\s*(?:19|20)\d{2}\s*(?:年(?!度))?\s*/, "").replace(/\s+/g, "");   // 同 lib/data.js 的 YEAR_RE
function doImport(replace) {
  const rows = parseRows($("importTxt").value);
  const modeSet = new Map(), chunkSet = new Map(), badMode = new Set();
  let skip = rows.skipped.length
    ? `；跳过 ${rows.skipped.length} 行（没有奖项名称，或姓名和${socL()}都空）：「${rows.skipped.slice(0, 3).join("」「")}」${rows.skipped.length > 3 ? "……" : ""}`
    : "";
  if (!rows.length)
    return toast(`没有可导入的行（至少需要「奖项」和「姓名」两列；团体可以只填「${socL()}」）` + skip, true);
  const awards = replace ? [] : draft.awards;
  let added = 0;
  for (const r of rows) {
    const { name, rest, photo, type, win } = r;
    let [title, subtitle] = r.subtitle
      ? [r.title, r.subtitle]
      : splitZhEn(r.title) || [r.title, ""];
    let [group, groupSub] = r.groupSub
      ? [r.group || "", r.groupSub]
      : splitZhEn(r.group) || [r.group || "", ""];
    const [section, sectionSub] = r.sectionSub
      ? [r.section || "", r.sectionSub]
      : splitZhEn(r.section) || [r.section || "", ""];
    // 找现有的同一个奖项：大类、分类比对时不看开头的年份和空格（用户 2026-11-22：空模版是 2026，明年 Excel 写 2027 也要并进同一个奖项）
    let a = awards.find((x) => x.title === title && impKey(x.group) === impKey(group) && impKey(x.section) === impKey(section));
    if (!a) {
      a = { section, sectionSub, group, groupSub, title, subtitle, revealMode: "one", winners: [] };
      awards.push(a);
    }
    a.winners.push(makeWinner(name, rest, photo, type, win));
    added++;
    for (const [k, v] of Object.entries(r.flags || {})) {   // 分类编号 / 大类列出分类 / 大类编号：哪一行写都可以
      const f = flagOf(v);
      if (f === true) a[k] = true;
      else if (f === false) delete a[k];
    }
    // 「揭晓方式」列：同一奖项填一次就行（填在哪一行都可以）；写错的记下来提示
    if (r.mode) {
      const m = modeOf(r.mode);
      if (m) modeSet.set(a, m);
      else badMode.add(r.mode);
      // 先一后全分组：「先一后全 每5位一组」「先一后全/5」都可以（2 ~ 20；没写数字 = 不分组）
      const k = m === "firstall" ? +(String(r.mode).match(/\d+/) || [])[0] : 0;
      if (k >= 2 && k <= 20) chunkSet.set(a, k);
    }
  }
  for (const a of awards) {
    if (modeSet.has(a)) {   // 表里指定了：照表（分组也照表，没写数字就不分组）
      a.revealMode = modeSet.get(a);
      if (chunkSet.has(a)) a.chunk = chunkSet.get(a);
      else delete a.chunk;
    }
    else if (!a.id) {
      // 没指定的新奖项：标了得主 → 入围揭晓；人多 → 一次全部揭晓
      if (a.winners.some((w) => w.win)) a.revealMode = "nominee";
      else if (a.winners.length > 6) a.revealMode = "all";
    }
  }
  const nomNoWin = awards.filter((a) => modeSet.get(a) === "nominee" && !a.winners.some((w) => w.win)).map((a) => a.title);
  if (badMode.size) skip += `；「揭晓方式」看不懂：「${[...badMode].join("」「")}」（可填 逐一揭晓 / 先一后全 / 一次全部揭晓 / 入围揭晓），这些奖项照自动判断`;
  if (nomNoWin.length) skip += `；入围揭晓但没标得主：「${nomNoWin.join("」「")}」（在「得主」列写「得主」）`;
  draft.awards = awards;
  setDirty(true);
  renderEditor();
  $("importTxt").value = "";
  toast(`已导入 ${added} 位获奖者，记得点「保存到服务器」` + skip, !!skip);
}

$("bImportAppend").onclick = () => doImport(false);
$("bImportReplace").onclick = () => {
  if (confirm("替换全部现有奖项？")) doImport(true);
};

/* ---------- 学会对照表：学会编号 | 学会名字(中) | 学会名字(英) ----------
 * 存在服务端 data/societies.json。名单的「学会」栏写编号，图片导出时查表换成中文、英文两行。
 * 有对照表时先按编号找，找不到再按中文名找（比对忽略空格和大小写）；都查不到就不输出学会，奖项编辑里标黄提示。
 * 维护者定（2026-11-03）。 */
let SOC = [];
const socKey = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();
// 和服务端 lib/societies.js 的 socFind() 同一套规则：编号 → 中文名 → 「A01 学长团」取第一段当编号、后面当中文名
function socFind(v) {
  const t = String(v || "").trim(), k = socKey(t);
  if (!k) return null;
  const sp = t.match(/^(\S+)\s+(.+)$/), head = sp ? socKey(sp[1]) : "", tail = sp ? socKey(sp[2]) : "";
  return (
    SOC.find((x) => socKey(x.code) === k) ||
    SOC.find((x) => socKey(x.zh) === k) ||
    (sp && (SOC.find((x) => socKey(x.code) === head) || SOC.find((x) => socKey(x.zh) === tail))) ||
    null
  );
}
// 一位得奖者的学会 → [中文, 英文]（没有就是空数组）
function socOf(w) {
  if (SOC.length) {
    const s = socFind(w.soc);
    return s ? [s.zh || "", s.en || ""] : [];
  }
  // 没有对照表：照旧把「中文English」拆两行；「学会」栏没填时用备注（1.42 以前的名单）
  const t = w.soc || w.detail || "";
  const m = String(t).match(/^(.*[　-鿿＀-￯])\s*([A-Za-z].*)$/);
  return m ? [m[1].trim(), m[2].trim()] : t ? [t] : [];
}
// 名单里写了、但对照表里查不到的学会（编号或中文名）
const socMissing = (ws) =>
  SOC.length ? [...new Set(ws.filter((w) => w.soc && !socFind(w.soc)).map((w) => w.soc))] : [];
function socParse(text) {
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => (l.includes("\t") ? l.split("\t") : l.split(/[,|]/)).map((x) => x.trim()));
  if (rows.length && /编号|編號|名字|名称|code|name/i.test(rows[0].join(" "))) rows.shift();   // 表头
  return rows
    .map(([code = "", zh = "", en = ""]) => ({ code, zh, en }))   // 没分栏（「A01 学长团 Prefectorial Board」）、只有两栏的，服务端会再拆（lib/societies.js normEntry）
    .filter((x) => x.code);
}
function socShow() {
  $("socCnt").textContent = SOC.length;
  $("socTxt").value = SOC.map((x) => [x.code, x.zh, x.en].join("\t")).join("\n");
}
async function socLoad() {
  try {
    SOC = (await api("GET", "/api/control/societies")).list || [];
  } catch {
    SOC = [];
  }
  socShow();
  renderEditor();
}
$("bSocSave").onclick = async () => {
  const list = socParse($("socTxt").value);
  try {
    SOC = (await api("PUT", "/api/control/societies", { list })).list;
  } catch (e) {
    return toast("保存失败：" + e.message, true);
  }
  socShow();
  renderEditor();
  const miss = draft ? socMissing(draft.awards.flatMap((a) => a.winners)) : [];
  toast(`${socL()}对照表已保存：${SOC.length} 个` + (miss.length ? `；名单里有 ${miss.length} 个编号查不到（奖项编辑里标黄）` : ""), !!miss.length);
  log(`保存${socL()}对照表（${SOC.length} 个）`);
};
