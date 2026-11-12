/*
 * 控制端 · 从 Excel / Google Sheets / CSV 批量导入（有表头时按表头名称对应列），以及学会对照表。
 * 提供：parseRows、doImport、SOC、socFind、socOf、socMissing、socLoad
 */
"use strict";

function parseRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const tab = lines.some((l) => l.includes("\t"));
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
    (tab ? l.split("\t") : splitCsv(l)).map((x) => x.trim()),
  );
  // 有表头：按表头名称对应列（列顺序可以随意）
  // 顺序就是优先级：「分类英文」要先于「分类」，「奖项英文 / 副标题」要先于「奖项」
  // 学会的列（学会编号 / 学会名字(中) / 学会名字(英)…）只能对应学会，不会被「编号」「名字」误认成学号、姓名
  const SOC_HEAD = /学会|學會|society|club/i;
  const H = [
    ["socName", /(学会|學會|society|club).*(名|name)/i],
    ["soc", SOC_HEAD],
    [
      "groupSub",
      /(分类|分類|类别|類別|组别|組別|大项|group|category).*(英文|english|en\b)/i,
    ],
    [
      "group",
      /分类|分類|类别|類別|组别|組別|大项|大項|group|category|section/i,
    ],
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
  return rows
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
        group: g("group"),
        groupSub: g("groupSub"),
        name: g("name"),
        rest: [g("cls"), g("sid"), g("soc") || g("socName"), g("detail")],   // 有学会编号就存编号，没有才存学会名字
        photo: g("photo"),
        type: g("type"),
        win: g("win"),
      };
    })
    .filter((r) => r.title && r.name);
}
function doImport(replace) {
  const rows = parseRows($("importTxt").value);
  if (!rows.length)
    return toast("没有可导入的行（至少需要「奖项」和「姓名」两列）", true);
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
    let a = awards.find((x) => x.title === title && (x.group || "") === group);
    if (!a) {
      a = { group, groupSub, title, subtitle, revealMode: "one", winners: [] };
      awards.push(a);
    }
    a.winners.push(makeWinner(name, rest, photo, type, win));
    added++;
  }
  for (const a of awards)
    if (!a.id) {
      // 新导入的奖项：标了得主 → 入围揭晓；人多 → 一次全部揭晓
      if (a.winners.some((w) => w.win)) a.revealMode = "nominee";
      else if (a.winners.length > 6) a.revealMode = "all";
    }
  draft.awards = awards;
  setDirty(true);
  renderEditor();
  $("importTxt").value = "";
  toast(`已导入 ${added} 位获奖者，记得点「保存到服务器」`);
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
  toast(`学会对照表已保存：${SOC.length} 个` + (miss.length ? `；名单里有 ${miss.length} 个编号查不到（奖项编辑里标黄）` : ""), !!miss.length);
  log(`保存学会对照表（${SOC.length} 个）`);
};
