const SITE = window.SRP_DATA || {};

// Bumping voteRound in data.js clears every visitor's saved vote and tally the next time they visit.
(function voteReset() {
  const r = String(SITE.voteRound || 0);
  const stored = localStorage.getItem("srp_round") || "0";
  if (stored !== r) {
    localStorage.removeItem("srp_voted");
    localStorage.removeItem("srp_tally");
    localStorage.removeItem("srp_tally2");
  }
  localStorage.setItem("srp_round", r);
})();

(function maintenance() {
  if (!SITE.siteOff || /admin\.html$/i.test(location.pathname) || sessionStorage.getItem("srp_admin")) return;
  document.body.innerHTML = '<div class="offline"><img src="logo.png" alt=""><h1>Site Temporarily Offline</h1><p>Springfield Roleplay Government Voting is currently closed. Please check back later.</p><a class="ownerlink" href="admin.html">Owner Login</a></div>';
  throw new Error("site offline");
})();
(function extras() {
  const h = document.querySelector("header");
  if (h) {
    const a = document.createElement("a");
    a.href = "admin.html";
    a.className = "adminlink";
    a.setAttribute("aria-label", "Admin");
    const s = document.createElement("span");
    s.textContent = "ADMIN";
    a.appendChild(s);
    h.appendChild(a);
  }
  if (SITE.announcement && h) {
    const b = document.createElement("div");
    b.className = "announce";
    b.textContent = SITE.announcement;
    h.after(b);
  }
  const fill = (id, list, empty) => {
    const el = document.getElementById(id);
    if (!el || !list || !list.length) return;
    el.textContent = "";
    const ul = document.createElement("ul");
    list.forEach(n => { const li = document.createElement("li"); li.textContent = n; ul.appendChild(li); });
    el.appendChild(ul);
  };
  fill("senators", SITE.senators);
  fill("reps", SITE.representatives);
})();

const pages = [
  ["index.html", "Home Page"],
  ["policies.html", "Policies"],
  ["senate.html", "SRP Senate"],
  ["house.html", "SRP House of Rep"],
  ["live.html", "Live Election Broadcast", "live"],
  ["vote.html", "Vote"],
  ["register.html", "Register", "cta"]
];

(function buildNav() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  const here = location.pathname.split("/").pop() || "index.html";
  let html = '<button class="burger" aria-label="Menu" onclick="this.parentElement.classList.toggle(\'open\')">&#9776;</button>';
  pages.forEach(([href, label, cls]) => {
    const active = cls !== "main" && href === here && cls !== "cta" && cls !== "live" ? " active" : "";
    const extra = cls === "cta" || cls === "live" ? " " + cls : "";
    html += '<a href="' + href + '" class="' + (active + extra).trim() + '">' + label + "</a>";
  });
  nav.innerHTML = html;
})();

(function reveal() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); } }), { threshold: 0.12 });
  els.forEach(el => io.observe(el));
})();

(function liveEmbed() {
  const box = document.getElementById("stream");
  if (!box) return;
  if (SITE.liveStreamUrl) {
    box.innerHTML = '<div class="video"><iframe src="' + SITE.liveStreamUrl + '" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe></div>';
  }
})();

const COUNTIES = {
  "Fairview Congressional": 3,
  "River City Housing": 2,
  "River City": 2,
  "Bayside": 2,
  "Industrial": 3,
  "Agriculture": 2,
  "Springfield": 2
};

const POLICY_OK = localStorage.getItem("srp_policy") === "1";
const POLICY_MSG = '<div class="closed"><h2>Read the Policies first</h2><p>You must read the Election Rules &amp; Policies and tick "I have read" at the bottom before you can register or vote.</p><a class="btn blue" href="policies.html">Read the Policies</a></div>';

(function policyAgree() {
  const cb = document.getElementById("policyAgree");
  if (!cb) return;
  cb.checked = POLICY_OK;
  const msg = document.getElementById("policyMsg");
  const show = () => { msg.textContent = cb.checked ? "Thank you. You can now register and vote." : ""; };
  show();
  cb.addEventListener("change", () => {
    if (cb.checked) localStorage.setItem("srp_policy", "1"); else localStorage.removeItem("srp_policy");
    show();
  });
})();

(function status() {
  const box = document.getElementById("votebox");
  if (box && !POLICY_OK) {
    box.className = "card closed";
    box.innerHTML = POLICY_MSG;
  } else if (box) {
    if (SITE.votingOpen && SITE.votingUrl) {
      box.innerHTML = '<h2>Voting is OPEN</h2><p>Click below to open your ballot.</p><a class="btn blue" target="_blank" rel="noopener" href="' + SITE.votingUrl + '">Open Ballot</a>';
    } else if (SITE.votingOpen) {
      box.className = "card";
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const reg = JSON.parse(localStorage.getItem("srp_reg") || "null");
      const done = JSON.parse(localStorage.getItem("srp_voted") || "null");
      const thanks = () => '<div class="thanks"><div class="check">&#10003;</div><h2>Thanks for voting!</h2><p>Your vote has been submitted and cannot be changed.</p></div>';
      if (done) {
        box.innerHTML = thanks();
      } else if (!reg) {
        box.className = "card closed";
        box.innerHTML = '<h2>You must register to vote</h2><p>Register first, then come back here to cast your ballot.</p><a class="btn blue" href="register.html">Register Now</a>';
      } else {
        const pos = (SITE.ballot || []).map((p, i) => '<fieldset class="pos"><legend>' + esc(p.title) + ' <em>(vote for ' + (p.pick === 1 ? "one" : p.pick) + ')</em></legend>' +
          p.candidates.map(c => '<label class="opt" style="border-left:8px solid ' + ((SITE.colors || {})[c] || "#888") + '"><input type="' + (p.pick === 1 ? "radio" : "checkbox") + '" name="p' + i + '" value="' + esc(c) + '"><span>' + esc(c) + "</span></label>").join("") + "</fieldset>").join("");
        box.innerHTML = '<div class="paper"><div class="phead"><img src="logo.png" alt=""><div><small>Springfield Roleplay Government</small><h2>' + esc(SITE.ballotTitle || "Official Ballot") + '</h2></div></div><div class="voter">Voting as <b>' + esc(reg.discord || reg.name) + "</b> &middot; " + esc(reg.county) + " District " + esc(reg.district) + '</div><p class="rules">Select <b>one</b> candidate for each office. <b>Once you submit, your vote is final and cannot be changed.</b></p>' +
          '<form id="ballotform"><div class="cols">' + pos + '</div><button class="btn blue" type="submit">Cast My Vote</button></form></div>';
        document.getElementById("ballotform").addEventListener("submit", e => {
          e.preventDefault();
          const lines = [], picks = [];
          for (let i = 0; i < SITE.ballot.length; i++) {
            const p = SITE.ballot[i];
            const picked = [...document.querySelectorAll('input[name="p' + i + '"]:checked')].map(x => x.value);
            if (!picked.length) { alert("Please vote for: " + p.title); return; }
            if (picked.length > p.pick) { alert("Too many choices for: " + p.title); return; }
            picks.push(picked);
            lines.push(p.title + ": " + picked.join(", "));
          }
          if (!confirm("Submit your vote? You cannot change it afterwards.")) return;
          const text = "Voter: " + (reg.discord || reg.name) + "\n" + lines.join("\n");
          localStorage.setItem("srp_voted", JSON.stringify({ at: Date.now(), lines }));
          const tally = JSON.parse(localStorage.getItem("srp_tally2") || "{}");
          const key = reg.county + "|" + reg.district;
          picks.forEach((list, i) => {
            tally[i] = tally[i] || {};
            tally[i][key] = tally[i][key] || {};
            list.forEach(c => { tally[i][key][c] = (tally[i][key][c] || 0) + 1; });
          });
          localStorage.setItem("srp_tally2", JSON.stringify(tally));
          box.className = "card";
          box.innerHTML = thanks();
          if (SITE.contactEmail) location.href = "mailto:" + SITE.contactEmail + "?subject=" + encodeURIComponent("SRP Ballot - " + (reg.discord || reg.name)) + "&body=" + encodeURIComponent(text);
        });
      }
    } else {
      box.className = "card closed";
      box.innerHTML = "<h2>Voting is currently CLOSED</h2><p>Check back on election day. Make sure you are registered first.</p>";
    }
  }
})();

(function liveMap() {
  const box = document.getElementById("mapbox");
  if (!box) return;
  const elections = (SITE.ballot || []).filter(p => p.candidates && p.candidates.length);
  if (SITE.showMap === false || !elections.length) { box.remove(); return; }
  const svg = document.getElementById("map");
  const D = [
    ["Springfield", 2, "SF D2", "290,10 610,42 610,262 402,153 258,72"],
    ["Springfield", 1, "SF D1", "610,42 697,167 697,262 725,297 610,262"],
    ["Fairview Congressional", 1, "FVC D1", "200,42 258,72 235,166 102,148"],
    ["Fairview Congressional", 2, "FVC D2", "102,148 235,166 188,290 102,262"],
    ["Fairview Congressional", 3, "FVC D3", "258,72 402,153 417,230 412,300 380,358 188,290 235,166"],
    ["Agriculture", 1, "Agri D1", "402,153 478,178 610,262 527,370 380,358 412,300 417,230"],
    ["Agriculture", 2, "Agri D2", "610,262 725,297 720,370 745,638 610,638 578,436 527,370"],
    ["River City Housing", 1, "RCH D1", "102,262 380,358 358,420 120,402"],
    ["River City Housing", 2, "RCH D2", "120,402 358,420 365,505 133,505"],
    ["River City", 1, "RC D1", "133,505 265,505 265,638 141,638"],
    ["River City", 2, "RC D2", "265,505 365,505 368,638 265,638"],
    ["Industrial", 1, "IDS D1", "380,358 527,370 578,436 582,484 353,448 358,420"],
    ["Industrial", 2, "IDS D2", "353,448 465,465 475,638 368,638 365,505"],
    ["Industrial", 3, "IDS D3", "465,465 582,484 610,638 475,638"],
    ["Bayside", 1, "BYS D1", "141,638 368,638 368,767 0,755 131,718"],
    ["Bayside", 2, "BYS D2", "368,638 745,638 847,760 847,767 368,767"]
  ];
  const colors = SITE.colors || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tallies = () => JSON.parse(localStorage.getItem("srp_tally2") || "{}");
  let cur = 0, timer;
  const tip = document.createElement("div");
  tip.className = "maptip";
  box.style.position = "relative";
  box.appendChild(tip);

  const draw = () => {
    const el = elections[cur], names = el.candidates, gray = true;
    const tally = tallies()[cur] || {};
    document.getElementById("mtitle").textContent = el.title + (gray ? "" : "");
    document.getElementById("legend").innerHTML = names.map(n => '<span><i style="background:' + (colors[n] || "#888") + '"></i>' + esc(n) + "</span>").join("") + '<span><i style="background:' + "#9aa0a6" + '"></i>No votes</span>';
    let total = 0, out = gray ? "" : '<image href="map.jpg" x="0" y="0" width="847" height="767"></image>';
    D.forEach(d => {
      const t = tally[d[0] + "|" + d[1]] || {};
      const e = Object.entries(t).sort((a, b) => b[1] - a[1]);
      const tie = e.length > 1 && e[0][1] === e[1][1];
      const won = e.length && !tie;
      const fill = won ? (colors[e[0][0]] || "#888") : (gray ? "#9aa0a6" : "#000");
      const op = won ? (gray ? 1 : 0.62) : (gray ? 1 : 0.0);
      e.forEach(x => total += x[1]);
      const pts = d[3].split(" ").map(p => p.split(",").map(Number));
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const txt = gray ? ("#fff") : "#fff";
      out += '<g class="dist" data-k="' + d[0] + "|" + d[1] + '" data-n="' + d[0] + " District " + d[1] + '"><polygon points="' + d[3] + '" fill="' + fill + '" fill-opacity="' + op + '" stroke="' + "#222" + '" stroke-width="2"></polygon><text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="24" font-weight="700" fill="' + txt + '" ' + (gray ? "" : 'stroke="#000" stroke-width="4" paint-order="stroke" ') + 'pointer-events="none">' + d[2].split(" ")[0] + '<tspan x="' + cx + '" dy="26">' + d[2].split(" ")[1] + "</tspan></text></g>";
    });
    svg.innerHTML = out;
    document.getElementById("maptotal").textContent = total + " vote" + (total === 1 ? "" : "s") + " counted";
    document.querySelectorAll("#mdots button").forEach((b, i) => b.classList.toggle("on", i === cur));
  };

  const go = i => { cur = (i + elections.length) % elections.length; draw(); };
  const nav = box.querySelector(".mapnav"), dots = document.getElementById("mdots");
  if (elections.length > 1) {
    dots.innerHTML = elections.map((e, i) => '<button type="button" aria-label="' + esc(e.title) + '"></button>').join("");
    dots.addEventListener("click", ev => { const i = [...dots.children].indexOf(ev.target); if (i >= 0) go(i); });
    document.getElementById("mprev").onclick = () => go(cur - 1);
    document.getElementById("mnext").onclick = () => go(cur + 1);
    const start = () => { clearInterval(timer); timer = setInterval(() => go(cur + 1), 8000); };
    box.addEventListener("mouseenter", () => clearInterval(timer));
    box.addEventListener("mouseleave", start);
    start();
  } else {
    nav.classList.add("single");
  }

  svg.addEventListener("mousemove", ev => {
    const g = ev.target.closest(".dist");
    if (!g) { tip.style.display = "none"; return; }
    const names = elections[cur].candidates;
    const t = (tallies()[cur] || {})[g.dataset.k] || {};
    const sum = Object.values(t).reduce((a, b) => a + b, 0);
    const rows = names.map(n => ({ n, v: t[n] || 0 })).sort((a, b) => b.v - a.v);
    let h = "<b>" + g.dataset.n + "</b><div class=\"tl\">" + esc(elections[cur].title) + "</div>";
    if (!sum) h += '<div class="tl">No votes yet</div>';
    else {
      const lead = rows.length > 1 && rows[0].v === rows[1].v ? "Tied" : rows[0].n + " leading";
      h += '<div class="tl">' + esc(lead) + " &middot; " + sum + " vote" + (sum === 1 ? "" : "s") + "</div>";
      h += rows.map(r => '<div class="tr"><i style="background:' + (colors[r.n] || "#888") + '"></i>' + esc(r.n) + "<span>" + Math.round(r.v / sum * 100) + "% (" + r.v + ")</span></div>").join("");
    }
    tip.innerHTML = h;
    tip.style.display = "block";
    const r = box.getBoundingClientRect();
    tip.style.left = Math.min(ev.clientX - r.left + 16, r.width - 230) + "px";
    tip.style.top = (ev.clientY - r.top + 16) + "px";
  });
  svg.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  draw();
  window.addEventListener("storage", draw);
  setInterval(() => { if (tip.style.display !== "block") draw(); }, 3000);
})();

(function countdown() {
  const el = document.getElementById("countdown");
  if (!el || !SITE.electionOpens) return;
  const m = SITE.electionOpens.match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/);
  if (!m) return;
  const tz = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" }).includes("EDT") ? 4 : 5;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + tz, +m[5]);
  const tick = () => {
    let s = Math.floor((target - Date.now()) / 1000);
    if (s <= 0) { el.innerHTML = '<div class="cd-open">Elections are now open!</div>'; return false; }
    const p = (n, l) => '<div><b>' + String(n).padStart(2, "0") + "</b><span>" + l + "</span></div>";
    el.innerHTML = '<div class="cd-title">Elections open in</div><div class="cd-row">' + p(Math.floor(s / 86400), "Days") + p(Math.floor(s % 86400 / 3600), "Hours") + p(Math.floor(s % 3600 / 60), "Minutes") + p(s % 60, "Seconds") + "</div>";
    return true;
  };
  if (tick()) { const t = setInterval(() => { if (!tick()) clearInterval(t); }, 1000); }
})();

(function registerForm() {
  const f = document.getElementById("regform");
  if (!f) return;
  if (!POLICY_OK) {
    f.parentElement.innerHTML = POLICY_MSG;
    return;
  }
  if (!SITE.registrationOpen) {
    f.parentElement.innerHTML = '<div class="closed"><h2>Registration is currently CLOSED</h2><p>Check back soon. Registration will open before the next election.</p></div>';
    return;
  }
  const county = f.elements.county, district = f.elements.district, summary = document.getElementById("regsummary");
  Object.keys(COUNTIES).forEach(c => county.add(new Option(c, c)));
  const update = () => {
    district.length = 0;
    if (!county.value) { district.add(new Option("Select a county first", "")); district.disabled = true; summary.style.display = "none"; return; }
    district.add(new Option("Select your district", ""));
    for (let i = 1; i <= COUNTIES[county.value]; i++) district.add(new Option(county.value + " District " + i, i));
    district.disabled = false;
    summary.style.display = "none";
  };
  county.addEventListener("change", update);
  f.addEventListener("reset", () => setTimeout(update));
  district.addEventListener("change", () => {
    if (!district.value) { summary.style.display = "none"; return; }
    summary.textContent = "You will be registered in " + county.value + " County, District " + district.value + ".";
    summary.style.display = "block";
  });
  if (SITE.registerFormUrl) {
    f.outerHTML = '<p>Click below to register.</p><a class="btn blue" href="' + SITE.registerFormUrl + '" target="_blank" rel="noopener">Open Registration Form</a>';
    return;
  }
  f.addEventListener("submit", e => {
    e.preventDefault();
    const d = new FormData(f);
    const body = "Username: " + d.get("name") + "\nDiscord: " + d.get("discord") + "\nCounty: " + d.get("county") + "\nDistrict: " + d.get("district") + "\nNotes: " + d.get("notes");
    const ok = document.getElementById("ok");
    localStorage.setItem("srp_reg", JSON.stringify({ name: d.get("name"), discord: d.get("discord"), county: d.get("county"), district: d.get("district") }));
    if (!SITE.contactEmail) {
      f.style.display = "none";
      ok.innerHTML = "You're registered! You can now <a href='vote.html'><b>go vote</b></a>.";
    } else if (SITE.contactEmail) {
      location.href = "mailto:" + SITE.contactEmail + "?subject=" + encodeURIComponent("SRP Voter Registration") + "&body=" + encodeURIComponent(body);
      ok.textContent = "Your email app should open with your registration. Send it to finish registering.";
      f.reset();
    } else {
      ok.textContent = "Registration isn't open yet. Please check back soon.";
    }
    ok.style.display = "block";
  });
})();
