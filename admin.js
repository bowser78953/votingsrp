(function () {
  const $ = id => document.getElementById(id);
  const DRAFT = "srp_draft";
  let data = Object.assign(JSON.parse(JSON.stringify(window.SRP_DATA)), JSON.parse(localStorage.getItem(DRAFT) || "{}"));
  delete data.siteOnline;
  // The live admin list always comes from the published data.js, so removed admins can't linger in a draft.
  data.admins = JSON.parse(JSON.stringify(window.SRP_DATA.admins));
  if (localStorage.getItem(DRAFT + "_admins")) data.admins = JSON.parse(localStorage.getItem(DRAFT + "_admins"));

  const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map(b => b.toString(16).padStart(2, "0")).join("");
  const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, "0")).join("");
  const save = () => { localStorage.setItem(DRAFT, JSON.stringify(data)); localStorage.setItem(DRAFT + "_admins", JSON.stringify(data.admins)); renderOut(); };
  let session = JSON.parse(sessionStorage.getItem("srp_admin") || "null");

  function show() {
    $("login").classList.toggle("hidden", !!session);
    $("panel").classList.toggle("hidden", !session);
    if (!session) return;
    $("who").textContent = session.user;
    $("role").textContent = session.role;
    $("adminstab").classList.toggle("hidden", session.role !== "owner");
    ["announcement", "registerFormUrl", "liveStreamUrl", "contactEmail", "votingUrl"].forEach(k => $(k).value = data[k] || "");
    ["registrationOpen", "votingOpen"].forEach(k => $(k).checked = !!data[k]);
    $("siteOnline").checked = !data.siteOff;
    $("showMap").checked = data.showMap !== false;
    $("roundInfo").textContent = "Vote round: " + (data.voteRound || 0);
    flagText();
    renderAdmins();
    renderOut();
  }
  function flagText() {
    $("regState").textContent = data.registrationOpen ? "OPEN" : "CLOSED";
    $("voteState").textContent = data.votingOpen ? "OPEN" : "CLOSED";
    $("siteState").textContent = !data.siteOff ? "ONLINE" : "OFFLINE";
    $("mapState").textContent = data.showMap !== false ? "SHOWN" : "HIDDEN";
  }

  $("loginform").addEventListener("submit", async e => {
    e.preventDefault();
    const u = $("u").value.trim().toLowerCase();
    const a = window.SRP_DATA.admins.concat(data.admins).find(x => x.user.toLowerCase() === u);
    const ok = a && (await sha(a.salt + $("p").value)) === a.hash;
    $("loginerr").classList.toggle("hidden", !!ok);
    if (!ok) return;
    session = { user: a.user, role: a.role };
    sessionStorage.setItem("srp_admin", JSON.stringify(session));
    $("p").value = "";
    show();
  });

  $("logout").addEventListener("click", () => { sessionStorage.removeItem("srp_admin"); session = null; show(); });

  $("tabs").addEventListener("click", e => {
    const t = e.target.dataset.t;
    if (!t) return;
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b === e.target));
    document.querySelectorAll("[data-p]").forEach(p => p.classList.toggle("hidden", p.dataset.p !== t));
    if (t === "publish") renderOut();
  });

  ["announcement", "registerFormUrl", "liveStreamUrl", "contactEmail", "votingUrl"].forEach(k => $(k).addEventListener("input", () => { data[k] = $(k).value.trim(); save(); }));
  ["registrationOpen", "votingOpen"].forEach(k => $(k).addEventListener("change", () => { data[k] = $(k).checked; flagText(); save(); }));
  $("siteOnline").addEventListener("change", () => { data.siteOff = !$("siteOnline").checked; flagText(); save(); });
  $("showMap").addEventListener("change", () => { data.showMap = $("showMap").checked; flagText(); save(); });
  $("resetVotes").addEventListener("click", () => {
    if (!confirm("Reset ALL votes? Everyone can vote again and the map clears. This takes effect after you publish.")) return;
    data.voteRound = (data.voteRound || 0) + 1;
    $("roundInfo").textContent = "Vote round: " + data.voteRound + " (publish to apply)";
    save();
  });

  function renderAdmins() {
    const t = $("adminlist");
    t.innerHTML = "<tr><th>Username</th><th>Role</th><th></th></tr>";
    data.admins.forEach((a, i) => {
      const tr = document.createElement("tr");
      [a.user, a.role].forEach(v => { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
      const td = document.createElement("td");
      if (a.role !== "owner") {
        const b = document.createElement("button");
        b.className = "btn ghost"; b.style.cssText = "color:#b00020;border-color:#b00020;padding:4px 14px;margin:0";
        b.textContent = "Remove";
        b.onclick = () => { data.admins.splice(i, 1); save(); renderAdmins(); };
        td.appendChild(b);
      }
      tr.appendChild(td);
      t.appendChild(tr);
    });
  }

  $("newadmin").addEventListener("submit", async e => {
    e.preventDefault();
    const user = $("nu").value.trim();
    if (data.admins.some(a => a.user.toLowerCase() === user.toLowerCase())) { alert("That username already exists."); return; }
    const salt = rand();
    data.admins.push({ user, role: "admin", salt, hash: await sha(salt + $("np").value) });
    alert("Account created for " + user + ". Give them the username and password, then publish the changes so it works on their device.");
    e.target.reset();
    save();
    renderAdmins();
  });

  function fileText() {
    return "window.SRP_DATA = " + JSON.stringify(data, null, 2) + ";\n";
  }
  function renderOut() { $("out").value = fileText(); }

  $("dl").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([fileText()], { type: "text/javascript" }));
    a.download = "data.js";
    a.click();
  });
  $("copy").addEventListener("click", () => { navigator.clipboard.writeText(fileText()); alert("Copied."); });

  const lines = s => s.split("\n").map(x => x.trim()).filter(Boolean);
  function fillLists() {
    $("electionOpens").value = data.electionOpens || "";
    $("ballotTitle").value = data.ballotTitle || "";
    $("ballotText").value = (data.ballot || []).map(b => b.title + " | " + (b.pick || 1) + " | " + b.candidates.join(", ")).join("\n");
    $("colorsText").value = Object.entries(data.colors || {}).map(([k, v]) => k + ": " + v).join("\n");
    $("senatorsText").value = (data.senators || []).join("\n");
    $("repsText").value = (data.representatives || []).join("\n");
    $("ghToken").value = localStorage.getItem("srp_gh") || "";
  }
  fillLists();
  ["electionOpens", "ballotTitle"].forEach(k => $(k).addEventListener("input", () => { data[k] = $(k).value.trim(); save(); }));
  $("ballotText").addEventListener("input", () => {
    data.ballot = lines($("ballotText").value).map(l => {
      const p = l.split("|").map(x => x.trim());
      return { title: p[0], pick: parseInt(p[1], 10) || 1, candidates: (p[2] || "").split(",").map(x => x.trim()).filter(Boolean) };
    });
    save();
  });
  $("colorsText").addEventListener("input", () => {
    data.colors = {};
    lines($("colorsText").value).forEach(l => { const i = l.lastIndexOf(":"); if (i > 0) data.colors[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    save();
  });
  $("senatorsText").addEventListener("input", () => { data.senators = lines($("senatorsText").value); save(); });
  $("repsText").addEventListener("input", () => { data.representatives = lines($("repsText").value); save(); });
  $("ghToken").addEventListener("input", () => localStorage.setItem("srp_gh", $("ghToken").value.trim()));

  $("discard").addEventListener("click", () => {
    if (!confirm("Throw away unpublished changes and reload the live settings?")) return;
    localStorage.removeItem(DRAFT); localStorage.removeItem(DRAFT + "_admins");
    location.reload();
  });

  const msg = (t, bad) => { const m = $("pubmsg"); m.textContent = t; m.classList.remove("hidden"); m.style.background = bad ? "" : "#e6f4ea"; };
  $("pub").addEventListener("click", async () => {
    const token = $("ghToken").value.trim();
    if (!token) { msg("Paste your GitHub token first.", true); return; }
    if (!confirm("Publish these changes to the live site?")) return;
    const url = "https://api.github.com/repos/bowser78953/votingsrp/contents/data.js";
    const h = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" };
    try {
      msg("Publishing...");
      const cur = await fetch(url, { headers: h });
      if (!cur.ok) throw new Error("Could not read data.js (" + cur.status + "). Check the token.");
      const sha = (await cur.json()).sha;
      const bytes = new TextEncoder().encode(fileText());
      let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b));
      const res = await fetch(url, { method: "PUT", headers: h, body: JSON.stringify({ message: "Update data.js from admin panel", content: btoa(bin), sha, branch: "main" }) });
      if (!res.ok) throw new Error("Publish failed (" + res.status + "). The token needs Contents: read & write.");
      msg("Published! The live site updates in 1-2 minutes.");
    } catch (err) { msg(err.message, true); }
  });

  show();
})();
