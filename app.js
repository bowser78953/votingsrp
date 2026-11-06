const SITE = window.SRP_DATA || {};

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
      const pos = (SITE.ballot || []).map((p, i) => '<fieldset class="pos"><legend>' + esc(p.title) + ' <em>(vote for ' + (p.pick === 1 ? "one" : p.pick) + ')</em></legend>' +
        p.candidates.map(c => '<label><input type="' + (p.pick === 1 ? "radio" : "checkbox") + '" name="p' + i + '" value="' + esc(c) + '"> ' + esc(c) + "</label>").join("") + "</fieldset>").join("");
      box.innerHTML = '<div class="paper"><h2>Official Ballot</h2><p class="rules">Please vote for each position. Vote only for the number of candidates allowed for that position. Votes for more than the allowed number will not count.</p>' +
        '<label class="who">Discord username <input id="voter" required></label><form id="ballotform"><div class="cols">' + pos + '</div><button class="btn blue" type="submit">Submit Ballot</button></form><div id="receipt"></div></div>';
      document.getElementById("ballotform").addEventListener("submit", e => {
        e.preventDefault();
        const who = document.getElementById("voter").value.trim();
        if (!who) { alert("Enter your Discord username."); return; }
        const lines = [];
        for (let i = 0; i < SITE.ballot.length; i++) {
          const p = SITE.ballot[i];
          const picked = [...document.querySelectorAll('input[name="p' + i + '"]:checked')].map(x => x.value);
          if (!picked.length) { alert("Please vote for: " + p.title); return; }
          if (picked.length > p.pick) { alert("Too many choices for: " + p.title); return; }
          lines.push(p.title + ": " + picked.join(", "));
        }
        const text = "Voter: " + who + "\n" + lines.join("\n");
        document.getElementById("receipt").innerHTML = '<div class="closed"><h3>Your ballot</h3><pre>' + esc(text) + "</pre></div>";
        if (SITE.contactEmail) location.href = "mailto:" + SITE.contactEmail + "?subject=" + encodeURIComponent("SRP Ballot - " + who) + "&body=" + encodeURIComponent(text);
      });
    } else {
      box.className = "card closed";
      box.innerHTML = "<h2>Voting is currently CLOSED</h2><p>Check back on election day. Make sure you are registered first.</p>";
    }
  }
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
    if (SITE.contactEmail) {
      location.href = "mailto:" + SITE.contactEmail + "?subject=" + encodeURIComponent("SRP Voter Registration") + "&body=" + encodeURIComponent(body);
      ok.textContent = "Your email app should open with your registration. Send it to finish registering.";
      f.reset();
    } else {
      ok.textContent = "Registration isn't open yet. Please check back soon.";
    }
    ok.style.display = "block";
  });
})();
