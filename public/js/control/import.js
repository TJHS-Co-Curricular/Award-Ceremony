/*
 * 控制端 · 从 Excel / Google Sheets / CSV 批量导入（有表头时按表头名称对应列）。
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
  const H = [
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
      const hit = H.find(([k, re]) => map[k] == null && re.test(c));
      if (hit) map[hit[0]] = j;
    });
  }
  return rows
    .map((r) => {
      if (!map) return { title: r[0], name: r[1], rest: r.slice(2) };
      const g = (k) => (map[k] != null ? r[map[k]] || "" : "");
      return {
        title: g("title"),
        subtitle: g("subtitle"),
        group: g("group"),
        groupSub: g("groupSub"),
        name: g("name"),
        rest: [g("cls"), g("sid"), g("detail")],
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
