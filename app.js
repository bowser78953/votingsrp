/* Paste your links here. Leave empty until you have them. */
const SITE = {
  registerFormUrl: "",   // e.g. a Google Form link
  liveStreamUrl: "",     // e.g. https://www.youtube.com/embed/VIDEO_ID  or  https://player.twitch.tv/?channel=NAME&parent=votingsrp.onrender.com
  contactEmail: ""       // where registrations are emailed if no form link is set
};

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

(function registerForm() {
  const f = document.getElementById("regform");
  if (!f) return;
  if (SITE.registerFormUrl) {
    f.outerHTML = '<p>Click below to register.</p><a class="btn blue" href="' + SITE.registerFormUrl + '" target="_blank" rel="noopener">Open Registration Form</a>';
    return;
  }
  f.addEventListener("submit", e => {
    e.preventDefault();
    const d = new FormData(f);
    const body = "Roblox/Discord name: " + d.get("name") + "\nDiscord: " + d.get("discord") + "\nVoting for: " + d.get("chamber") + "\nNotes: " + d.get("notes");
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
