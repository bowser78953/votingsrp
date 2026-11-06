const SITE = window.SRP_DATA || {};
const httpsUrl = value => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};
const easternDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const check = new Date(Date.UTC(+y, +m - 1, +d));
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31 || +h > 23 || +min > 59 ||
      check.getUTCFullYear() !== +y || check.getUTCMonth() !== +m - 1 || check.getUTCDate() !== +d) return null;
  const noon = new Date(Date.UTC(+y, +m - 1, +d, 12));
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "short" }).format(noon);
  const offset = zone.includes("EDT") ? 4 : 5;
  return new Date(Date.UTC(+y, +m - 1, +d, +h + offset, +min));
};

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
  ["election-info.html", "Election Info"],
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

(function electionInfo() {
  const root = document.getElementById("electionOffices");
  if (!root) return;

  const schedule = Object.assign({ votingOpens: SITE.electionOpens }, SITE.electionSchedule || {});
  const timeline = document.getElementById("electionTimeline");
  const campaignStart = easternDate(schedule.campaigningOpens);
  const campaignEnd = easternDate(schedule.campaigningCloses);
  const campaignActive = SITE.campaignOpen === true && campaignStart && campaignEnd &&
    campaignStart <= new Date() && new Date() <= campaignEnd;
  const contactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(SITE.contactEmail || ""));
  const registrationAvailable = !!httpsUrl(SITE.registerFormUrl) || contactEmail;
  const votingAvailable = !!httpsUrl(SITE.votingUrl);
  const phases = [
    { title: "Voter registration", active: SITE.registrationOpen === true, available: registrationAvailable, start: schedule.registrationOpens, end: schedule.registrationCloses },
    { title: "Candidate registration", active: SITE.registrationOpen === true, available: contactEmail, start: schedule.registrationOpens, end: schedule.registrationCloses },
    { title: "Candidate campaigning", active: !!campaignActive, available: true, start: schedule.campaigningOpens, end: schedule.campaigningCloses },
    { title: "Voting", active: SITE.votingOpen === true, available: votingAvailable, start: schedule.votingOpens, end: schedule.votingCloses }
  ];
  phases.forEach(phase => {
    const row = document.createElement("div");
    row.className = "timeline-row";
    const title = document.createElement("strong");
    title.textContent = phase.title;
    const state = document.createElement("span");
    const status = !phase.active ? "CLOSED" : phase.available ? "OPEN" : "UNAVAILABLE";
    state.className = "election-state " + (status === "OPEN" ? "state-open" : status === "CLOSED" ? "state-closed" : "state-warning");
    state.textContent = status;
    const dates = document.createElement("span");
    dates.className = "timeline-dates";
    dates.textContent = phase.start || phase.end
      ? (phase.start || "Not announced") + " to " + (phase.end || "Not announced") + " (Eastern)"
      : "Dates not announced";
    row.append(title, state, dates);
    timeline.appendChild(row);
  });

  if (SITE.announcement) {
    const announcement = document.getElementById("officialAnnouncement");
    announcement.textContent = "Official announcement: " + SITE.announcement;
    announcement.classList.remove("hidden");
  }

  const profilesRoot = document.getElementById("candidateProfiles");
  const profiles = Array.isArray(SITE.candidateProfiles) ? SITE.candidateProfiles : [];
  const visibleProfiles = campaignActive ? profiles.filter(profile => profile && profile.name && profile.office) : [];
  document.getElementById("noCandidateProfiles").classList.toggle("hidden", visibleProfiles.length > 0);
  visibleProfiles.slice().sort((a, b) => String(a.office).localeCompare(String(b.office)) || String(a.name).localeCompare(String(b.name))).forEach(profile => {
    const card = document.createElement("article");
    card.className = "candidate-profile";
    const heading = document.createElement("h3");
    heading.textContent = profile.name + " — " + profile.office;
    card.appendChild(heading);
    [["Experience and qualifications", profile.experience], ["SRP campaign statement", profile.statement]].forEach(([label, value]) => {
      if (!value) return;
      const section = document.createElement("div");
      const subheading = document.createElement("h4");
      subheading.textContent = label;
      const text = document.createElement("p");
      text.textContent = value;
      section.append(subheading, text);
      card.appendChild(section);
    });
    profilesRoot.appendChild(card);
  });

  const application = document.getElementById("candidateApplication");
  const applicationStatus = document.getElementById("candidateApplicationStatus");
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(SITE.contactEmail || "")) ? SITE.contactEmail : "";
  if (SITE.registrationOpen !== true || !email) {
    application.classList.add("hidden");
    applicationStatus.textContent = SITE.registrationOpen !== true
      ? "Candidate registration is closed."
      : "Candidate application email is not configured. Contact election administration through its official channel.";
    applicationStatus.classList.remove("hidden");
  } else {
    application.addEventListener("submit", event => {
      event.preventDefault();
      const fields = new FormData(application);
      const name = String(fields.get("name") || "").trim();
      const office = String(fields.get("office") || "").trim();
      const experience = String(fields.get("experience") || "").trim();
      const statement = String(fields.get("statement") || "").trim();
      if (!name || !office || !experience || !statement) return;
      const subject = "SRP Candidate Application - " + office;
      const body = [
        "In-game username: " + name,
        "Office: " + office,
        "",
        "Relevant SRP experience and qualifications:",
        experience,
        "",
        "Proposed SRP campaign statement:",
        statement,
        "",
        "I have read and agree to follow the SRP Election Rules & Policies.",
        "I understand this application is not approval to run. Election Officials must review eligibility and approve any public candidate profile."
      ].join("\n");
      document.getElementById("candidateApplicationMessage").textContent =
        "Your email app should open. Send the draft to submit your application; nothing is sent or saved by this website.";
      window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  }

  const resultsStatus = document.getElementById("officialResultsStatus");
  const resultsUrl = httpsUrl(SITE.officialResultsUrl);
  if (resultsUrl) {
    resultsStatus.textContent = "Certified result notice:";
    const link = document.createElement("a");
    link.href = resultsUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open the official election announcement";
    resultsStatus.append(" ", link);
  } else {
    resultsStatus.textContent = "No certified result announcement has been linked. Results belong in an official SRP channel only after ballot verification.";
  }

  const elections = (SITE.ballot || []).filter(e => e && e.title && Array.isArray(e.candidates) && e.candidates.length);
  document.getElementById("noPublishedBallot").classList.toggle("hidden", elections.length > 0);
  elections.forEach(election => {
    const section = document.createElement("section");
    section.className = "election-office";
    const heading = document.createElement("h3");
    heading.textContent = election.title;
    const details = document.createElement("p");
    const pick = Number.isInteger(Number(election.pick)) && Number(election.pick) > 0 ? Number(election.pick) : 1;
    details.textContent = "Select " + pick + (pick === 1 ? " candidate" : " candidates") + " when voting is open.";
    const candidates = document.createElement("ul");
    candidates.className = "candidate-list";
    [...election.candidates].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" })).forEach(name => {
      const item = document.createElement("li");
      item.textContent = name;
      candidates.appendChild(item);
    });
    section.append(heading, details, candidates);
    root.appendChild(section);
  });
})();

(function reveal() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); } }), { threshold: 0.12 });
  els.forEach(el => io.observe(el));
})();

(function liveEmbed() {
  const box = document.getElementById("stream");
  if (!box) return;
  const streamUrl = httpsUrl(SITE.liveStreamUrl);
  if (!streamUrl) return;
  const wrapper = document.createElement("div");
  wrapper.className = "video";
  const iframe = document.createElement("iframe");
  iframe.src = streamUrl;
  iframe.allowFullscreen = true;
  iframe.allow = "autoplay; encrypted-media; picture-in-picture";
  wrapper.appendChild(iframe);
  box.replaceChildren(wrapper);
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
    const ballotUrl = httpsUrl(SITE.votingUrl);
    if (SITE.votingOpen && ballotUrl) {
      box.className = "card";
      const heading = document.createElement("h2");
      heading.textContent = "Voting is OPEN";
      const message = document.createElement("p");
      message.textContent = "Use the official ballot. This site does not store or email your vote.";
      const link = document.createElement("a");
      link.className = "btn blue";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.href = ballotUrl;
      link.textContent = "Open Official Ballot";
      box.replaceChildren(heading, message, link);
    } else if (SITE.votingOpen) {
      box.className = "card closed";
      box.innerHTML = '<h2>Official ballot not available</h2><p>Voting is marked open, but election administration has not published a secure official ballot link. No vote can be submitted on this static website.</p><a class="more" href="election-info.html">Check election announcements</a>';
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
  const B = [
    ["Springfield", "Springfield", "290,10 610,42 697,167 697,262 725,297 610,262 478,178 402,153 258,72", 497, 98],
    ["Fairview Congressional", "Fairview", "200,42 258,72 402,153 417,230 412,300 380,358 102,262 102,148", 237, 162],
    ["Agriculture", "Agriculture", "402,153 478,178 610,262 725,297 720,370 745,638 610,638 578,436 527,370 380,358 412,300 417,230", 592, 318],
    ["River City Housing", "River City Housing", "102,262 380,358 358,420 365,505 133,505 120,402", 245, 392],
    ["River City", "River City", "133,505 365,505 368,638 141,638", 250, 563],
    ["Industrial", "Industrial", "380,358 527,370 578,436 610,638 368,638 365,505 353,448 358,420", 473, 443],
    ["Bayside", "Bayside", "141,638 745,638 847,760 847,767 368,767 0,755 131,718", 430, 676]
  ];
  const isBig = (el, i) => /big|district|^\s*(type\s*)?(2|two)\s*$/i.test(String(el.map || "")) || (!el.map && i === 1);
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
    document.getElementById("mtitle").textContent = el.title + " — Local Preview";
    document.getElementById("legend").innerHTML = names.map(n => '<span><i style="background:' + (colors[n] || "#888") + '"></i>' + esc(n) + "</span>").join("") + '<span><i style="background:' + "#d3d7dc" + '"></i>No votes</span>';
    let total = 0, out = gray ? "" : '<image href="map.jpg" x="0" y="0" width="847" height="767"></image>';
    D.forEach(d => {
      const t = tally[d[0] + "|" + d[1]] || {};
      const e = Object.entries(t).sort((a, b) => b[1] - a[1]);
      const tie = e.length > 1 && e[0][1] === e[1][1];
      const won = e.length && !tie;
      const fill = won ? (colors[e[0][0]] || "#888") : (gray ? "#d3d7dc" : "#000");
      const op = won ? (gray ? 1 : 0.62) : (gray ? 1 : 0.0);
      e.forEach(x => total += x[1]);
      const pts = d[3].split(" ").map(p => p.split(",").map(Number));
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const txt = won ? "#fff" : "#222";
      out += '<g class="dist" data-k="' + d[0] + "|" + d[1] + '" data-n="' + d[0] + " District " + d[1] + '"><polygon points="' + d[3] + '" fill="' + fill + '" fill-opacity="' + op + '" stroke="' + "#222" + '" stroke-width="2"></polygon><text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="24" font-weight="700" fill="' + txt + '" ' + 'stroke="none" ' + 'pointer-events="none">' + d[2].split(" ")[0] + '<tspan x="' + cx + '" dy="26">' + d[2].split(" ")[1] + "</tspan></text></g>";
    });
    if (isBig(el, cur)) {
      out = ""; total = 0;
      B.forEach(b => {
        const t = {};
        Object.keys(tally).filter(k => k.split("|")[0] === b[0]).forEach(k => Object.entries(tally[k]).forEach(([n, v]) => t[n] = (t[n] || 0) + v));
        const e = Object.entries(t).sort((x, y) => y[1] - x[1]);
        const won = e.length && !(e.length > 1 && e[0][1] === e[1][1]);
        e.forEach(x => total += x[1]);
        out += '<g class="dist" data-k="' + b[0] + '" data-n="' + b[1] + ' District"><polygon points="' + b[2] + '" fill="' + (won ? (colors[e[0][0]] || "#888") : "#d3d7dc") + '" stroke="#222" stroke-width="2"></polygon><text x="' + b[3] + '" y="' + b[4] + '" text-anchor="middle" font-size="22" font-weight="700" fill="' + (won ? "#fff" : "#222") + '" pointer-events="none">' + b[1] + '<tspan x="' + b[3] + '" dy="25">District</tspan></text></g>';
      });
    }
    svg.innerHTML = out;
    document.getElementById("maptotal").textContent = "Local browser preview: " + total + " vote" + (total === 1 ? "" : "s") + " on this device; not an official count.";
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
    const all = tallies()[cur] || {};
    let t = all[g.dataset.k] || {};
    if (isBig(elections[cur], cur)) {
      t = {};
      Object.keys(all).filter(k => k.split("|")[0] === g.dataset.k).forEach(k => Object.entries(all[k]).forEach(([n, v]) => t[n] = (t[n] || 0) + v));
    }
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
  const opens = (SITE.electionSchedule || {}).votingOpens || SITE.electionOpens;
  const target = easternDate(opens);
  if (!el || !target) return;
  const tick = () => {
    let s = Math.floor((target.getTime() - Date.now()) / 1000);
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
  const registrationUrl = httpsUrl(SITE.registerFormUrl);
  if (registrationUrl) {
    const message = document.createElement("p");
    message.textContent = "Complete the official registration form. Your eligibility is not confirmed until election officials review it.";
    const link = document.createElement("a");
    link.className = "btn blue";
    link.href = registrationUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open Official Registration Form";
    f.replaceWith(message, link);
    return;
  }
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(SITE.contactEmail || "")) ? SITE.contactEmail : "";
  if (!email) {
    f.replaceWith(Object.assign(document.createElement("p"), {
      className: "notice",
      textContent: "No official registration method is configured. Contact election administration through its designated official channel."
    }));
    return;
  }
  f.addEventListener("submit", e => {
    e.preventDefault();
    const d = new FormData(f);
    const body = "Username: " + d.get("name") + "\nDiscord: " + d.get("discord") + "\nCounty: " + d.get("county") + "\nDistrict: " + d.get("district") + "\nNotes: " + d.get("notes");
    const ok = document.getElementById("ok");
    location.href = "mailto:" + email + "?subject=" + encodeURIComponent("SRP Voter Registration Request") + "&body=" + encodeURIComponent(body);
    ok.textContent = "If your email app opens, send the draft to submit your request. This website does not save it; wait for election officials to confirm your eligibility.";
    f.reset();
    ok.style.display = "block";
  });
})();
