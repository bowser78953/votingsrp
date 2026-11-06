const SITE = window.SRP_DATA || {};

(function extras() {
  const h = document.querySelector("header");
  if (h) {
    const a = document.createElement("a");
    a.href = "admin.html";
    a.className = "adminlink";
    a.textContent = "\uD83D\uDD12 Admin";
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
  ["index.html", "Main Page", "main"],
  ["live.html", "Live Election Broadcast", "live"],
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

(function registerForm() {
  const f = document.getElementById("regform");
  if (!f) return;
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
