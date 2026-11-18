/*
 * 控制端 · 把目前的奖项设定导出成 Excel（.xlsx）。
 * 列和「批量导入」、docs/Example.xlsx 一样（大类 … 得主，15 列）+ 三列显示设定（分类编号、大类列出分类、大类编号），导出的文件复制后贴回「批量导入」就能还原。
 * 用「奖项编辑」的草稿（含还没保存的修改）。xlsx 自己用 makeZip() 组（js/shared/zip.js），不加第三方库。
 * 提供：exportAwardsXlsx()
 * 需要：core.js（draft、toast、log）、zip.js（makeZip）
 */
"use strict";

// 最后三列是显示设定（import.js 的 flagOf() 读）：分类 / 大类的 01 02 编号、大类画面列不列分类
const XLSX_HEAD = ["大类", "大类英文", "分类", "分类英文", "奖项", "副标题", "揭晓方式", "学会", "姓名", "班级", "学号", "照片", "备注", "类型", "得主", "分类编号", "大类列出分类", "大类编号"];
const XLSX_W = [20, 26, 20, 26, 20, 24, 18, 12, 16, 12, 12, 14, 30, 8, 8, 10, 13, 10];   // 列宽（字符）

// revealMode → 「揭晓方式」列的文字（和 import.js 的 modeOf() 对得上）
function modeText(a) {
  const m = a.revealMode;
  if (m === "firstall") return a.chunk >= 2 ? `先一后全 每${a.chunk}位一组` : "先一后全";
  return { all: "一次全部揭晓", nominee: "入围揭晓" }[m] || "逐一揭晓";
}

function exportAwardsXlsx() {
  const awards = draft?.awards || [];
  if (!awards.length) return toast("还没有奖项", true);
  const rows = [XLSX_HEAD];
  for (const a of awards) {
    const head = [a.section || "", a.sectionSub || "", a.group || "", a.groupSub || "", a.title || "", a.subtitle || "", modeText(a)];
    const flags = [   // 没有分类 / 大类的奖项留空
      a.group ? (a.groupNoNum ? "不显示" : "显示") : "",
      a.section ? (a.sectionNoList ? "不列" : "列出") : "",
      a.section ? (a.sectionNoNum ? "不显示" : "显示") : "",
    ];
    // 没有得奖者的奖项也写一行（只有奖项资料；再导入时会被跳过，并提示）
    for (const w of a.winners.length ? a.winners : [{}])
      rows.push([...head, w.soc || "", w.name || "", w.cls || "", w.sid || "", w.photo || "", w.detail || "", w.type === "team" ? "团体" : "", w.win ? "得主" : "", ...flags]);
  }
  const blob = xlsxBlob(rows);
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  const file = `奖项设定_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = file;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  const people = awards.reduce((t, a) => t + a.winners.length, 0);
  toast(`已导出 ${awards.length} 个奖项、${people} 位得奖者`);
  log(`导出奖项设定 Excel（${awards.length} 个奖项，${people} 位）`);
}

// 最简单的 xlsx：一张表、全部文字（inlineStr，学号前面的 0 不会不见），第一行粗体底色并冻结
function xlsxBlob(rows) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");   // XML 不接受的控制字符
  const col = (i) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : "") + String.fromCharCode(65 + (i % 26));
  const sheetRows = rows.map((r, y) =>
    `<row r="${y + 1}">` +
    r.map((v, x) => v === "" ? "" : `<c r="${col(x)}${y + 1}" t="inlineStr"${y === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join("") +
    "</row>").join("");
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const RNS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const PR = "http://schemas.openxmlformats.org/package/2006/relationships";
  const OD = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = {
    "[Content_Types].xml": `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `${X}<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${OD}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `${X}<workbook ${NS} ${RNS}><sheets><sheet name="奖项" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `${X}<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${OD}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${OD}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `${X}<styleSheet ${NS}><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E3B5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": `${X}<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${XLSX_W.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  const enc = new TextEncoder();
  const zip = makeZip(Object.entries(files).map(([name, s]) => ({ name, data: enc.encode(s) })));
  return new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

$("bExportXlsx").onclick = exportAwardsXlsx;
