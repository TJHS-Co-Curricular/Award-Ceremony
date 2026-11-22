/*
 * 控制端 · 奖项编辑：草稿、活动标题、每个奖项的卡片（分类、名称、揭晓方式、获奖者文字框）、保存。
 * 获奖者每行一位：姓名 | 班级 | 学号 | 学会 | 照片 | 备注 | 类型 | 得主（照片、类型、得主可放任意位置）。
 * 提供：loadDraft()、setDirty(d)、renderEditor()、makeWinner(...)、joinRows(lines, sep, guess)、unquote(cell)
 */
"use strict";

function loadDraft() {
  draft = { event: clone(V.event), awards: clone(V.awards) };
  setDirty(false);
  renderEditor();
}
function setDirty(d) {
  dirty = d;
  $("dirtyTxt").textContent = d ? "● 有未保存的修改" : "已保存";
  $("dirtyTxt").className = d ? "dirty" : "muted";
}
const IS_PHOTO = (x) => /\.(jpe?g|png|webp|gif)$/i.test(x);
const WIN_MARK = /^(得主|winner|★|🏆)$/i,
  WIN_YES = /^(得主|winner|★|🏆|是|y|yes|1|✓|√|v)$/i;
const TYPE_TEAM = /^(团体|團體|团队|團隊|社团|集体|teams?|group)$/i,
  TYPE_PERSON = /^(个人|個人|person|individual)$/i;
// 把一行的各栏变成获奖者：照片按扩展名识别、类型按关键字（团体 / 个人）识别，都可放任意位置；其余依次是 班级、学号、学会、备注
function makeWinner(name, rest, photo = "", type = "", win = "") {
  const r = [...rest];
  for (let k = r.length - 1; k >= 0; k--)
    if (WIN_MARK.test(r[k])) {
      win = win || r[k];
      r.splice(k, 1);
      break;
    }
  for (let k = r.length - 1; k >= 0; k--)
    if (TYPE_TEAM.test(r[k]) || TYPE_PERSON.test(r[k])) {
      type = type || r[k];
      r.splice(k, 1);
      break;
    }
  while (r.length && r[r.length - 1] === "") r.pop();
  if (!photo) {
    let k = r.findIndex(IS_PHOTO);
    if (k === 4) k = -1;   // 第 5 栏（照片栏之后）是备注：备注只写图片文件名 = 备注图片，不当照片（1.58）
    if (k >= 0) photo = r.splice(k, 1)[0];
    else if (r.length >= 5) r.splice(3, 1); // 班级、学号、学会之后是照片栏；留空时去掉这一栏，备注才不会错位
  }
  const [cls = "", sid = "", soc = "", detail = ""] = r;
  const w = { name };
  if (cls) w.cls = cls;
  if (sid) w.sid = sid;
  if (soc) w.soc = soc;
  if (detail) w.detail = detail;
  if (photo) w.photo = photo;
  if (TYPE_TEAM.test(type)) w.type = "team";
  if (WIN_YES.test(win)) w.win = true;
  return w;
}
/* 一格里有换行（多行备注）：
 * 1. 用双引号包起来（和从 Excel 复制有换行的格子一样）："第一行
 *    第二行"。引号里的 " 写成 ""。
 * 2. 直接贴上、没有引号：下一行开头一段（第一个 | 之前）超过 30 个字，不像名字，就当成上一行备注的续行，
 *    那一行后面的 | 栏位也接回上一行（例：「…文字 |  |  | 团体」的「团体」属于上一位）。
 * 名字只有一行、短，所以不会被误接。 */
const NOTE_CONT = 30;
function joinRows(lines, sep = "|", guess = true) {   // guess = false：只认引号（批量导入：Excel 有换行的格子一定带引号）
  const out = [];
  let open = false;   // 上一行的引号还没关
  for (const l of lines) {
    const head = l.split(sep)[0].trim();
    if (out.length && (open || (guess && head.length > NOTE_CONT && !l.trim().startsWith('"')))) out[out.length - 1] += "\n" + l;
    else { if (!l.trim()) continue; out.push(l); }
    open = out.length > 0 && (out[out.length - 1].match(/"/g) || []).length % 2 === 1;
  }
  return out;
}
// 去掉格子外面的双引号，"" 还原成 "
const unquote = (c) => {
  const t = c.trim();
  return t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"' ? t.slice(1, -1).replace(/""/g, '"').trim() : t;
};
const winnersToText = (ws) =>
  ws
    .map((w) =>
      [
        w.name,
        w.cls || "",
        w.sid || "",
        w.soc || "",
        w.photo || "",
        /\n/.test(w.detail || "") ? '"' + w.detail.replace(/"/g, '""') + '"' : w.detail || "",   // 多行备注用引号包起来，读回来才不会拆成好几位
        w.type === "team" ? "团体" : "",
        w.win ? "得主" : "",
      ]
        .join(" | ")
        .replace(/( \| )+$/, ""),
    )
    .join("\n");
function textToWinners(t) {
  return joinRows(t.split(/\r?\n/))
    .map((l) => l.split("|").map(unquote))
    .filter((p) => p[0])
    .map(([name, ...rest]) => makeWinner(name, rest));
}
function renderEditor() {
  if (!draft) return;
  $("evTitle").value = draft.event.title;
  $("evSub").value = draft.event.subtitle || "";
  $("evYear").value = draft.event.year || "";
  $("evSocLabel").value = draft.event.socLabel || "";
  socLApply();
  $("evTitleSize").value = draft.event.titleSize || 100;
  $("evSubSize").value = draft.event.subSize || 100;
  for (const [id, k] of EV_INFO) $(id).value = draft.event[k] || "";
  $("evInfoOn").checked = draft.event.infoOn !== false;
  $("evGroupIntro").checked = draft.event.groupIntro !== false;
  $("evPhotoKicker").checked = draft.event.photoKicker !== false;
  exFillSel();
  renderFontUI();
  const groups = [...new Set(draft.awards.map((a) => a.group).filter(Boolean))];
  const dl =
    $("groupList") ||
    document.body.appendChild(el("datalist", { id: "groupList" }));
  dl.replaceChildren(...groups.map((g) => el("option", { value: g })));
  const secs = [...new Set(draft.awards.map((a) => a.section).filter(Boolean))];
  ($("sectionList") || document.body.appendChild(el("datalist", { id: "sectionList" })))
    .replaceChildren(...secs.map((g) => el("option", { value: g })));
  const box = $("elist");
  box.textContent = "";
  draft.awards.forEach((a, i) => {
    const n = draft.awards.length;
    const move = (d) => {
      const j = i + d;
      if (j < 0 || j >= n) return;
      [draft.awards[i], draft.awards[j]] = [draft.awards[j], draft.awards[i]];
      setDirty(true);
      renderEditor();
    };
    const ta = el("textarea", {
      rows: Math.min(14, Math.max(3, a.winners.length + 1)),
      placeholder:
        `姓名 | 班级 | 学号 | ${socL()} | 照片.jpg | 备注 | 类型（团体 / 个人） | 得主`,
      class: "secret",
    });
    ta.value = winnersToText(a.winners);
    const warn = el("span", {
      class: "tag",
      style: "border-color:var(--warn);color:#ffc98a",
    });
    const swarn = el("span", {
      class: "tag",
      style: "border-color:var(--warn);color:#ffc98a",
    });
    const check = () => {
      // 入围揭晓：必须刚好标 1 位「得主」
      const k = a.winners.filter((w) => w.win).length;
      warn.textContent =
        k === 0
          ? "⚠ 还没标「得主」，会按逐一揭晓处理"
          : k > 1
            ? `⚠ 标了 ${k} 位得主，只算第一位`
            : "";
      warn.classList.toggle("hidden", a.revealMode !== "nominee" || k === 1);
      const miss = socMissing(a.winners);   // 学会对照表里查不到的编号（导出图片时不印学会）
      swarn.textContent = miss.length ? `⚠ ${socL()}查不到：${miss.join("、")}` : "";
      swarn.classList.toggle("hidden", !miss.length);
    };
    ta.addEventListener("input", () => {
      a.winners = textToWinners(ta.value);
      cnt.textContent = `${a.winners.length} 位`;
      check();
      setDirty(true);
      enavSoon();
    });
    const cnt = el("span", { class: "tag" }, `${a.winners.length} 位`);
    const ins = {};
    const inp = (key, ph, max = 160) => {
      const x = el("input", { placeholder: ph, maxlength: max });
      x.value = a[key] || "";
      ins[key] = x;
      x.addEventListener("input", () => {
        a[key] = x.value;
        setDirty(true);
        enavSoon();   // 左边目录跟着改名
      });
      const pair = { title: "subtitle", group: "groupSub", section: "sectionSub" }[key];
      if (pair)
        x.addEventListener("change", () => {
          // 「团体网站比赛Societies' Website Competition」→ 自动拆成中文 + 英文
          const sp = splitZhEn(x.value);
          if (sp && !a[pair]) {
            a[key] = x.value = sp[0];
            a[pair] = ins[pair].value = sp[1];
            setDirty(true);
          }
          if ((key === "group" || key === "section") && a[key] && !a[pair]) {
            // 选了已有分类 / 大类：带出它的英文
            const o = draft.awards.find(
              (y) => y !== a && y[key] === a[key] && y[pair],
            );
            if (o) {
              a[pair] = ins[pair].value = o[pair];
              setDirty(true);
            }
          }
        });
      return x;
    };
    const mode = el(
      "select",
      {},
      ...Object.entries(MODE_NAME).map(([v, t]) =>
        el("option", { value: v }, t),
      ),
    );
    mode.value = a.revealMode;
    // 先一后全：每几位一组（组里逐一出现 → 这一组的合集 → 下一组；用户定 2026-11-17）
    const chunk = el(
      "select",
      { style: "width:auto" },
      el("option", { value: "" }, "不分组（最后全部一起出现）"),
      ...[3, 4, 5, 6, 8, 10].map((k) => el("option", { value: k }, `每 ${k} 位一组`)),
    );
    chunk.value = a.chunk || "";
    chunk.onchange = () => {
      if (+chunk.value) a.chunk = +chunk.value;
      else delete a.chunk;
      setDirty(true);
    };
    const chunkRow = el(
      "label",
      {
        style:
          "display:flex;gap:8px;align-items:center;margin:-2px 0 10px;font-size:13px;color:var(--muted)",
      },
      "先一后全分组：",
      chunk,
      el("span", {}, "（例：15 位、每 5 位一组 → 01–05 逐一出现 → 01–05 合集 → 06–10 逐一出现 → 06–10 合集 ……）"),
    );
    chunkRow.classList.toggle("hidden", a.revealMode !== "firstall");
    mode.onchange = () => {
      a.revealMode = mode.value;
      chunkRow.classList.toggle("hidden", a.revealMode !== "firstall");
      check();
      setDirty(true);
      enavSoon();
    };
    check();
    box.append(
      el(
        "div",
        { class: "ecard", id: "ec" + i },   // id：左边目录（editor-nav.js）跳过来用
        el(
          "div",
          { class: "head" },
          el("span", { class: "no" }, `#${i + 1}`),
          cnt,
          warn,
          swarn,
          el("span", { class: "sp" }),
          el(
            "button",
            { onclick: () => move(-1), disabled: i === 0 ? "" : null },
            "↑",
          ),
          el(
            "button",
            { onclick: () => move(1), disabled: i === n - 1 ? "" : null },
            "↓",
          ),
          el(
            "button",
            {
              onclick: () => {
                if (confirm(`删除奖项「${a.title}」？`)) {
                  draft.awards.splice(i, 1);
                  setDirty(true);
                  renderEditor();
                }
              },
              style: "color:#ff9c9c",
            },
            "删除",
          ),
        ),
        el(
          "div",
          { class: "grid2", style: "margin-bottom:10px" },
          el(
            "label",
            { class: "f" },
            el("span", {}, "大类（可空；分类上面一层，相邻且同名的归为一个大类）"),
            (() => {
              const x = inp("section", "例如：年终成果汇报竞赛奖", 60);
              x.setAttribute("list", "sectionList");
              return x;
            })(),
          ),
          el(
            "label",
            { class: "f" },
            el("span", {}, "大类英文（可空）"),
            inp("sectionSub", "例如：YEAR-END REPORT COMPETITIONS", 120),
          ),
        ),
        (() => {
          // 大类画面的两个选项：整个大类一起改（相邻同名的奖项）
          const box = (key, text, tip) => {
            const x = el("input", { type: "checkbox", style: "width:auto" });
            x.checked = !a[key];
            x.disabled = !a.section;
            x.onchange = () => {
              const L = draft.awards;
              let s = i,
                e = i;
              while (s > 0 && L[s - 1].section === a.section) s--;
              while (e < L.length - 1 && L[e + 1].section === a.section) e++;
              for (let k = s; k <= e; k++) {
                if (x.checked) delete L[k][key];
                else L[k][key] = true;
              }
              setDirty(true);
              renderEditor();
            };
            return el("label", { style: "display:flex;gap:6px;align-items:center;cursor:pointer", title: tip }, x, text);
          };
          return el(
            "div",
            { style: "display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;margin:-2px 0 10px;font-size:13px;color:var(--muted)" },
            box("sectionNoList", "大类画面列出下面的分类", "大类画面上，大类名称下面列出里面的分类（或奖项）"),
            a.sectionNoList ? null : box("sectionNoNum", "分类前显示编号（01 / 02 / 03）", "大类画面里，每个分类前面的 01 / 02 / 03"),
            a.section ? null : el("span", {}, "（要先填大类）"),
          );
        })(),
        el(
          "div",
          { class: "grid2", style: "margin-bottom:10px" },
          el(
            "label",
            { class: "f" },
            el("span", {}, "分类（可空；相邻且同名的奖项归为一类）"),
            (() => {
              const x = inp("group", "例如：成果汇报竞赛", 60);
              x.setAttribute("list", "groupList");
              return x;
            })(),
          ),
          el(
            "label",
            { class: "f" },
            el("span", {}, "分类英文（可空）"),
            inp("groupSub", "例如：ANNUAL REPORT COMPETITIONS", 120),
          ),
        ),
        (() => {
          // 这一类的「01 / 02 / 03」编号：整组一起改（相邻同名的奖项）
          const x = el("input", { type: "checkbox", style: "width:auto" });
          x.checked = !a.groupNoNum;
          x.onchange = () => {
            const L = draft.awards;
            let s = i,
              e = i;
            if (a.group) {
              while (s > 0 && L[s - 1].group === a.group) s--;
              while (e < L.length - 1 && L[e + 1].group === a.group) e++;
            }
            for (let k = s; k <= e; k++) {
              if (x.checked) delete L[k].groupNoNum;
              else L[k].groupNoNum = true;
            }
            setDirty(true);
            renderEditor();
          };
          return el(
            "label",
            {
              style:
                "display:flex;gap:8px;align-items:center;margin:-2px 0 10px;font-size:13px;color:var(--muted);cursor:pointer",
              title:
                "分类标题画面的 01 / 02 / 03，以及奖项画面上方的「奖项 02」",
            },
            x,
            "这个分类显示奖项编号（01 / 02 / 03）",
            a.group ? null : el("span", {}, "（要先填分类）"),
          );
        })(),
        el(
          "div",
          { class: "row3" },
          el(
            "label",
            { class: "f" },
            el("span", {}, "奖项名称"),
            inp("title", "例如：学业优异奖（可直接贴「中文English」）", 120),
          ),
          el(
            "label",
            { class: "f" },
            el("span", {}, "副标题（可空）"),
            inp("subtitle", "例如：Academic Excellence"),
          ),
          el("label", { class: "f" }, el("span", {}, "揭晓方式"), mode),
        ),
        chunkRow,
        el("label", { class: "f" }, el("span", {}, "获奖者（每行一位）"), ta),
      ),
    );
  });
  if (!draft.awards.length)
    box.append(
      el(
        "p",
        { class: "muted" },
        "还没有奖项，点上方「新增奖项」或用批量导入。",
      ),
    );
  enavRender();   // 左边目录（editor-nav.js）
}
$("evTitle").addEventListener("input", (e) => {
  draft.event.title = e.target.value;
  setDirty(true);
});
$("evYear").addEventListener("input", (e) => {   // 年份：保存时服务端套到每个大类、分类名称前面（lib/data.js 的 withYear）
  draft.event.year = e.target.value.trim();
  setDirty(true);
});
$("evSocLabel").addEventListener("input", (e) => {   // 名单第 4 栏的名称（只改给人看的字，资料字段 soc 不变）
  draft.event.socLabel = e.target.value.trim();
  setDirty(true);
  socLApply();
});
$("evSub").addEventListener("input", (e) => {
  draft.event.subtitle = e.target.value;
  setDirty(true);
});
const EV_INFO = [["evDate", "date"], ["evTime", "time"], ["evVenue", "venue"], ["evNote", "note"]];   // 待机画面下方的活动资料
for (const [id, k] of EV_INFO)
  $(id).addEventListener("input", (e) => {
    draft.event[k] = e.target.value;
    setDirty(true);
  });
for (const [id, k] of [["evTitleSize", "titleSize"], ["evSubSize", "subSize"]])   // 活动名称 / 副标题大小（%），服务端保存时限制在 50 ~ 200
  $(id).addEventListener("input", (e) => {
    draft.event[k] = +e.target.value || 100;
    setDirty(true);
  });
$("evInfoOn").addEventListener("change", (e) => {
  draft.event.infoOn = e.target.checked;
  setDirty(true);
});
$("evGroupIntro").addEventListener("change", (e) => {
  draft.event.groupIntro = e.target.checked;
  setDirty(true);
});
$("evPhotoKicker").addEventListener("change", (e) => {
  draft.event.photoKicker = e.target.checked;
  setDirty(true);
});
$("bAdd").onclick = () => {
  const last = draft.awards[draft.awards.length - 1] || {};
  draft.awards.push({
    section: last.section || "",
    sectionSub: last.sectionSub || "",
    group: last.group || "",
    groupSub: last.groupSub || "",
    title: "新奖项",
    subtitle: "",
    revealMode: "one",
    winners: [],
  });
  setDirty(true);
  renderEditor();
  enavGo(draft.awards.length - 1);
};
$("bRevert").onclick = () => {
  if (!dirty || confirm("放弃所有未保存的修改？")) loadDraft();
};
$("bSave").onclick = async () => {
  const live = V.state.mode === "title" || V.state.mode === "reveal";
  if (live && !confirm("颁奖正在进行中，保存会立即影响现场画面。继续？"))
    return;
  try {
    const r = await api("PUT", "/api/control/data", draft);
    V.awards = r.data.awards;
    V.event = r.data.event;
    loadDraft();
    render();
    toast("已保存");
    log("保存奖项数据");
    refreshPhotos();
  } catch (err) {
    toast(err.message, true);
  }
};
