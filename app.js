const SITE = window.SRP_DATA || {};

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

(function status() {
  const hero = document.querySelector(".hero:not(.small)");
  if (hero) {
    const d = document.createElement("div");
    d.innerHTML = '<span class="badge ' + (SITE.registrationOpen ? "on" : "off") + '">REGISTRATION ' + (SITE.registrationOpen ? "OPEN" : "CLOSED") + '</span><span class="badge ' + (SITE.votingOpen ? "on" : "off") + '">VOTING ' + (SITE.votingOpen ? "OPEN" : "CLOSED") + "</span>";
    hero.insertBefore(d, hero.firstChild);
  }
  const box = document.getElementById("votebox");
  if (box) {
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
          const lines = [];
          for (let i = 0; i < SITE.ballot.length; i++) {
            const p = SITE.ballot[i];
            const picked = [...document.querySelectorAll('input[name="p' + i + '"]:checked')].map(x => x.value);
            if (!picked.length) { alert("Please vote for: " + p.title); return; }
            if (picked.length > p.pick) { alert("Too many choices for: " + p.title); return; }
            lines.push(p.title + ": " + picked.join(", "));
          }
          if (!confirm("Submit your vote? You cannot change it afterwards.")) return;
          const text = "Voter: " + (reg.discord || reg.name) + "\n" + lines.join("\n");
          localStorage.setItem("srp_voted", JSON.stringify({ at: Date.now(), lines }));
          const pres = document.querySelector('input[name="p0"]:checked').value;
          const tally = JSON.parse(localStorage.getItem("srp_tally") || "{}");
          const key = reg.county + "|" + reg.district;
          tally[key] = tally[key] || {};
          tally[key][pres] = (tally[key][pres] || 0) + 1;
          localStorage.setItem("srp_tally", JSON.stringify(tally));
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
  const svg = document.getElementById("map");
  if (!svg) return;
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
  const names = ((SITE.ballot || [])[0] || { candidates: [] }).candidates;
  document.getElementById("legend").innerHTML = names.map(n => '<span><i style="background:' + (colors[n] || "#888") + '"></i>' + n + "</span>").join("") + '<span><i style="background:#dfe6f3"></i>No votes</span>';
  const draw = () => {
    const tally = JSON.parse(localStorage.getItem("srp_tally") || "{}");
    let total = 0, out = "";
    D.forEach(d => {
      const t = tally[d[0] + "|" + d[1]] || {};
      const e = Object.entries(t).sort((a, b) => b[1] - a[1]);
      const tie = e.length > 1 && e[0][1] === e[1][1];
      const fill = e.length && !tie ? (colors[e[0][0]] || "#888") : "#dfe6f3";
      e.forEach(x => total += x[1]);
      const pts = d[3].split(" ").map(p => p.split(",").map(Number));
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      out += '<g class="dist" data-k="' + d[0] + "|" + d[1] + '" data-n="' + d[0] + " District " + d[1] + '"><polygon points="' + d[3] + '" fill="' + fill + '" stroke="#222" stroke-width="2"></polygon><text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="24" font-weight="700" fill="' + (e.length && !tie ? "#fff" : "#1b2a4a") + '" pointer-events="none">' + d[2].split(" ")[0] + '<tspan x="' + cx + '" dy="26">' + d[2].split(" ")[1] + "</tspan></text></g>";
    });
    svg.innerHTML = out;
    document.getElementById("maptotal").textContent = total + " vote" + (total === 1 ? "" : "s") + " counted";
  };
  const box = document.getElementById("mapbox"), tip = document.createElement("div");
  tip.className = "maptip";
  box.style.position = "relative";
  box.appendChild(tip);
  svg.addEventListener("mousemove", ev => {
    const g = ev.target.closest(".dist");
    if (!g) { tip.style.display = "none"; return; }
    const t = (JSON.parse(localStorage.getItem("srp_tally") || "{}"))[g.dataset.k] || {};
    const sum = Object.values(t).reduce((a, b) => a + b, 0);
    const rows = names.map(n => ({ n, v: t[n] || 0 })).sort((a, b) => b.v - a.v);
    let h = "<b>" + g.dataset.n + "</b>";
    if (!sum) h += '<div class="tl">No votes yet</div>';
    else {
      const lead = rows[0].v === rows[1].v ? "Tied" : rows[0].n + " leading";
      h += '<div class="tl">' + lead + " &middot; " + sum + " vote" + (sum === 1 ? "" : "s") + "</div>";
      h += rows.map(r => '<div class="tr"><i style="background:' + (colors[r.n] || "#888") + '"></i>' + r.n + "<span>" + Math.round(r.v / sum * 100) + "% (" + r.v + ")</span></div>").join("");
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

(function registerForm() {
  const f = document.getElementById("regform");
  if (!f) return;
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
