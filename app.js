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
const usesCountyMap = (race, index = 0) => /^(county|counties|districts|big|2|two)$/i.test(String(race.map || "")) ||
  (!race.map && (index === 1 || /senat|mayor/i.test(String(race.title || ""))));
const resultAreaKey = race => {
  const area = String(race.area || "").trim();
  const district = area.match(/^(.+?)\s+District\s+(\d+)$/i);
  if (district) return district[1] + "|" + Number(district[2]);
  return area.replace(/\s+County$/i, "").trim();
};
const waitForFirebase = () => {
  if (window.SRP_FIREBASE) return Promise.resolve(window.SRP_FIREBASE);
  if (window.SRP_FIREBASE_ERROR) return Promise.reject(window.SRP_FIREBASE_ERROR);
  if (window.SRP_FIREBASE_READY) return window.SRP_FIREBASE_READY;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Firebase did not finish loading.")), 15000);
    window.addEventListener("srp-firebase-ready", () => {
      clearTimeout(timeout);
      resolve(window.SRP_FIREBASE);
    }, { once: true });
    window.addEventListener("srp-firebase-error", () => {
      clearTimeout(timeout);
      reject(window.SRP_FIREBASE_ERROR || new Error("Firebase failed to load."));
    }, { once: true });
  });
};

// Bumping voteRound in data.js clears local registration and starts a separate shared-results round.
(function voteReset() {
  const r = String(SITE.voteRound || 0);
  const stored = localStorage.getItem("srp_round") || "0";
  if (stored !== r) {
    localStorage.removeItem("srp_voted");
    localStorage.removeItem("srp_tally");
    localStorage.removeItem("srp_tally2");
    localStorage.removeItem("srp_reg");
    localStorage.removeItem("srp_reg_approved");
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

(function homeElectionSnapshot() {
  const message = document.getElementById("homeElectionMessage");
  if (!message) return;
  const state = document.getElementById("homeElectionState");
  const races = document.getElementById("homeRaceList");
  const ballot = (SITE.ballot || []).filter(race => race && race.title && Array.isArray(race.candidates) && race.candidates.length);

  if (SITE.votingOpen) {
    state.textContent = ballot.length ? "BALLOT OPEN" : "NO CONTESTS PUBLISHED";
    message.textContent = ballot.length
      ? "The election ballot is open for published races. Review the contests for your registered area."
      : "The ballot is open, but no contests have been published yet.";
  } else if (SITE.registrationOpen) {
    state.textContent = "REGISTRATION OPEN";
    message.textContent = "Voter registration is currently marked open. Eligibility must still be confirmed by election officials.";
  } else {
    state.textContent = ballot.length ? "ELECTION INFORMATION" : "DATES NOT ANNOUNCED";
    message.textContent = SITE.announcement && !/tbd/i.test(SITE.announcement)
      ? String(SITE.announcement)
      : "No election dates have been announced. Check the official schedule and notices for updates.";
  }
  state.classList.toggle("is-open", !!SITE.votingOpen || !!SITE.registrationOpen);

  if (!ballot.length) {
    const empty = document.createElement("p");
    empty.className = "home-no-races";
    empty.textContent = "No ballot races have been published yet.";
    races.appendChild(empty);
    return;
  }
  ballot.forEach(race => {
    const item = document.createElement("div");
    item.className = "home-race";
    const title = document.createElement("strong");
    title.textContent = race.title;
    const candidates = document.createElement("span");
    candidates.textContent = race.candidates.slice().sort((a, b) => String(a).localeCompare(String(b))).join(" · ");
    item.append(title, candidates);
    races.appendChild(item);
  });
})();

(function homeChambers() {
  const render = (id, detailsId, members, seatCount) => {
    const root = document.getElementById(id);
    if (!root) return;
    const details = document.getElementById(detailsId);
    const entries = (Array.isArray(members) ? members : []).map(entry => {
      const text = String(entry || "").trim();
      const separator = text.indexOf(":");
      const area = separator >= 0 ? text.slice(0, separator).trim() : "";
      const holder = (separator >= 0 ? text.slice(separator + 1) : text).trim();
      return { area, holder: /^(enrol+ment in progress|election in progress|vacant|n\/a)$/i.test(holder) ? "" : holder };
    }).filter(entry => entry.area || entry.holder);
    const rows = seatCount === 14 ? [8, 6] : [9, 7];
    let index = 0;
    rows.forEach((count, row) => {
      const radius = row === 0 ? 44 : 27;
      for (let position = 0; position < count; position++, index++) {
        const member = entries[index];
        const description = member
          ? [member.area, member.holder || "Election in progress"].filter(Boolean).join(": ")
          : "Election in progress";
        const angle = Math.PI - (Math.PI * position / (count - 1));
        const seat = document.createElement("button");
        seat.type = "button";
        seat.className = "chamber-seat" + (member && member.holder ? " occupied" : " unfilled");
        seat.style.left = (50 + radius * Math.cos(angle)) + "%";
        seat.style.top = (91 - radius * 1.65 * Math.sin(angle)) + "%";
        seat.setAttribute("aria-label", description);
        const show = () => {
          root.querySelectorAll(".chamber-seat").forEach(item => item.classList.toggle("selected", item === seat));
          const label = document.createElement("span");
          label.textContent = member && member.area ? member.area.toUpperCase() : "SEAT DETAILS";
          const name = document.createElement("strong");
          name.textContent = member && member.holder ? member.holder : "Election in progress";
          details.replaceChildren(label, name);
        };
        seat.addEventListener("mouseenter", show);
        seat.addEventListener("focus", show);
        seat.addEventListener("click", show);
        root.appendChild(seat);
      }
    });
    if (entries.length > seatCount) {
      const warning = document.createElement("p");
      warning.className = "warn";
      warning.textContent = "The member list has more entries than available seats. Please update the list in the admin dashboard.";
      root.after(warning);
    }
  };
  render("senateSeats", "senateSeatDetails", SITE.senators, 14);
  render("houseSeats", "houseSeatDetails", SITE.representatives, 16);
})();

(function homeProjections() {
  const root = document.getElementById("projectionList");
  if (!root) return;
  const status = document.getElementById("projectionStatus");
  const races = (SITE.ballot || []).map((race, index) => ({ ...race, ballotIndex: index }))
    .filter(race => ["senate", "representative"].includes(String(race.office || "").toLowerCase()) &&
      race.title && race.area && Array.isArray(race.candidates) && race.candidates.length);
  if (SITE.showMap === false) {
    status.textContent = "Projections are unavailable while the results map is hidden.";
    return;
  }
  if (!races.length) {
    status.textContent = "No Senate or House races are currently published.";
    return;
  }
  const unavailable = message => {
    root.replaceChildren();
    status.textContent = message;
  };
  waitForFirebase().then(services => {
    const ref = services.collection(services.db, "elections", String(SITE.voteRound || 1), "results");
    services.onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache) {
        unavailable("Waiting for current shared results; cached results may be outdated.");
        return;
      }
      const results = new Map();
      snapshot.forEach(doc => results.set(doc.id, doc.data()));
      root.replaceChildren();
      status.textContent = "Based on the current vote leader in each race. Not a certified result.";
      races.forEach(race => {
        const result = results.get(String(race.ballotIndex));
        const candidates = [...new Set(race.candidates)];
        const counts = result && result.counts;
        const valid = !result || (result.areaKey === resultAreaKey(race) && counts &&
          typeof counts === "object" && !Array.isArray(counts) &&
          Object.entries(counts).every(([name, count]) => candidates.includes(name) && Number.isSafeInteger(count) && count >= 0));
        let summary;
        if (!valid) summary = "Results don't match this race.";
        else {
          const totals = candidates.map(name => ({ name, count: result ? counts[name] || 0 : 0 }));
          const highest = Math.max(...totals.map(item => item.count));
          const leaders = totals.filter(item => item.count === highest);
          if (!highest) summary = "No votes yet";
          else if (leaders.length > 1) summary = "Tied — no projection";
          else if (/^(n\/a|none|vacant)$/i.test(leaders[0].name.trim())) summary = "Placeholder leading — no projection";
          else summary = leaders[0].name + " leading · " + highest + " vote" + (highest === 1 ? "" : "s");
        }
        const card = document.createElement("article");
        card.className = "projection-card";
        const title = document.createElement("strong");
        title.textContent = race.title;
        const value = document.createElement("span");
        value.textContent = summary;
        card.append(title, value);
        root.appendChild(card);
      });
    }, error => unavailable("Shared results unavailable (" + (error.code || "Firebase error") + ")."));
  }).catch(error => unavailable("Shared results unavailable (" + error.message + ")."));
})();

const pages = [
  ["index.html", "Home Page"],
  ["election-info.html", "Election Info"],
  ["campaigns.html", "Campaigns"],
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

(function campaignsPage() {
  const list = document.getElementById("campaignsList");
  if (!list) return;
  const schedule = SITE.electionSchedule || {};
  const start = easternDate(schedule.campaigningOpens);
  const end = easternDate(schedule.campaigningCloses);
  const now = new Date();
  const active = SITE.campaignOpen === true && start && end && start <= now && now <= end;
  const status = document.getElementById("campaignStatus");
  if (!active) {
    status.textContent = "Campaign statements are currently closed.";
    return;
  }
  const campaigns = (Array.isArray(SITE.campaigns) ? SITE.campaigns : [])
    .filter(campaign => campaign && campaign.name && campaign.office && campaign.statement);
  if (!campaigns.length) {
    status.textContent = "No campaigns have been published yet.";
    return;
  }
  status.hidden = true;
  campaigns.slice().sort((a, b) => String(a.office).localeCompare(String(b.office)) || String(a.name).localeCompare(String(b.name))).forEach(campaign => {
    const card = document.createElement("article");
    card.className = "campaign-card";
    const photoUrl = httpsUrl(campaign.photoUrl);
    if (photoUrl) {
      const photo = document.createElement("img");
      photo.className = "campaign-photo";
      photo.src = photoUrl;
      photo.alt = "Photo of " + campaign.name;
      photo.loading = "lazy";
      photo.referrerPolicy = "no-referrer";
      card.appendChild(photo);
    }
    const content = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = campaign.name;
    const office = document.createElement("p");
    office.className = "campaign-office";
    office.textContent = campaign.office;
    const statement = document.createElement("p");
    statement.className = "campaign-statement";
    statement.textContent = campaign.statement;
    content.append(heading, office, statement);
    card.appendChild(content);
    list.appendChild(card);
  });
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
  const candidateRegistrationOpen = SITE.registrationOpen === true && contactEmail;
  const registrationAvailable = true;
  const votingAvailable = (SITE.ballot || []).some(race => race && race.title && Array.isArray(race.candidates) && race.candidates.length);
  const phases = [
    { title: "Voter registration", active: SITE.registrationOpen === true, available: registrationAvailable, start: schedule.registrationOpens, end: schedule.registrationCloses },
    { title: "Candidate registration", active: SITE.registrationOpen === true, available: contactEmail, start: schedule.registrationOpens, end: schedule.registrationCloses },
    { title: "Candidate campaigning", active: !!campaignActive, available: true, start: schedule.campaigningOpens, end: schedule.campaigningCloses },
    { title: "Election ballot", active: SITE.votingOpen === true, available: votingAvailable, start: schedule.votingOpens, end: schedule.votingCloses }
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
  const applicationDialog = document.getElementById("candidateApplicationDialog");
  const applicationMessage = document.getElementById("candidateApplicationMessage");
  const openApplication = document.getElementById("openCandidateApplication");
  const closeApplicationDialog = () => applicationDialog.close();
  if (candidateRegistrationOpen) {
    openApplication.disabled = false;
    openApplication.textContent = "Open Application & Election Planning Form";
    openApplication.addEventListener("click", () => applicationDialog.showModal());
  } else {
    openApplication.disabled = true;
    openApplication.textContent = SITE.registrationOpen === true ? "Candidate Applications Unavailable" : "Candidate Applications Closed";
  }
  document.getElementById("closeCandidateApplication").addEventListener("click", closeApplicationDialog);
  document.getElementById("cancelCandidateApplication").addEventListener("click", closeApplicationDialog);
  applicationDialog.addEventListener("click", event => {
    if (event.target === applicationDialog) closeApplicationDialog();
  });
  application.addEventListener("submit", event => {
    event.preventDefault();
    if (!candidateRegistrationOpen) return;
    if (!application.reportValidity()) return;
    const fields = new FormData(application);
    const name = String(fields.get("name") || "").trim();
    const office = String(fields.get("office") || "").trim();
    const experience = String(fields.get("experience") || "").trim();
    const goals = String(fields.get("goals") || "").trim();
    const suggestions = String(fields.get("suggestions") || "").trim();
    if (!name || !office || !experience || !goals) return;
    const subject = (SITE.registrationOpen === true ? "SRP Candidate Application - " : "SRP Election Planning Inquiry - ") + office;
    const body = [
      "In-game username: " + name,
      "Position of interest: " + office,
      "",
      "SRP experience or qualifications:",
      experience,
      "",
      "What I hope to work on:",
      goals,
      "",
      "Election setup suggestions:",
      suggestions || "None provided",
      "",
      "I have read and agree to follow the SRP Election Rules & Policies.",
      SITE.registrationOpen === true
        ? "I understand this application is not approval to run. Election Officials must review eligibility."
        : "I understand candidate registration is closed and this is an election-planning inquiry, not an official application."
    ].join("\n");
    applicationMessage.textContent = "Your email app should open a draft addressed to bbowsersrp@gmail.com. Review it and press Send; this website does not send or save the form.";
    window.location.href = "mailto:bbowsersrp@gmail.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  });

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
    const office = String(election.office || (/senat/i.test(election.title) ? "senate" : /representative|congress|house/i.test(election.title) ? "representative" : /mayor/i.test(election.title) ? "mayor" : ""));
    const area = election.area ? " for " + election.area : "";
    details.textContent = "Select " + pick + (pick === 1 ? " candidate" : " candidates") + " when voting is open." +
      (office ? " " + office[0].toUpperCase() + office.slice(1) + area + " appears on the " + (office === "representative" ? "district" : "county") + " map." : "");
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
  if (!box) return;
  if (box.hasAttribute("data-shared-voting")) return;
  const heading = document.createElement("h2");
  const message = document.createElement("p");
  const notice = document.createElement("p");
  notice.className = "ballot-disclosure";
  notice.textContent = "Submission notice: This ballot is saved only in this browser. It is not sent to election officials and does not count as an official vote.";
  box.classList.add("ballot-card");
  const renderBallotState = (kind, eyebrowText, titleText, descriptionText, showDisclosure = false) => {
    const state = document.createElement("div");
    state.className = "ballot-state ballot-state-" + kind;
    state.setAttribute("role", kind === "submitted" ? "status" : "region");
    state.setAttribute("aria-live", kind === "submitted" ? "polite" : "off");
    const icon = document.createElement("span");
    icon.className = "ballot-state-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = kind === "submitted" ? "✓" : "!";
    const copy = document.createElement("div");
    copy.className = "ballot-state-copy";
    const eyebrow = document.createElement("p");
    eyebrow.className = "ballot-state-eyebrow";
    eyebrow.textContent = eyebrowText;
    const title = document.createElement("h2");
    title.textContent = titleText;
    const description = document.createElement("p");
    description.textContent = descriptionText;
    copy.append(eyebrow, title, description);
    state.append(icon, copy);
    const children = [state];
    if (kind === "submitted") {
      const actions = document.createElement("div");
      actions.className = "ballot-state-actions";
      const home = document.createElement("a");
      home.className = "btn blue";
      home.href = "index.html";
      home.textContent = "Return to Home";
      const information = document.createElement("a");
      information.className = "ballot-state-link";
      information.href = "election-info.html";
      information.textContent = "Election information";
      actions.append(home, information);
      children.push(actions);
    }
    if (showDisclosure) children.push(notice);
    box.replaceChildren(...children);
  };
  if (!POLICY_OK) {
    box.className = "card closed";
    box.innerHTML = POLICY_MSG;
    return;
  }
  if (!SITE.votingOpen) {
    renderBallotState("closed", "VOTING STATUS", "The ballot is not open",
      "Check back during the published voting period. Complete registration before voting opens.");
    return;
  }
  let registration;
  try {
    registration = JSON.parse(localStorage.getItem("srp_reg") || "null");
  } catch (error) {
    throw new Error("Could not read the saved local registration.", { cause: error });
  }
  if (!registration || !registration.county || !registration.district) {
    box.className = "card ballot-card";
    const state = document.createElement("div");
    state.className = "ballot-state ballot-state-registration";
    const copy = document.createElement("div");
    copy.className = "ballot-state-copy";
    const eyebrow = document.createElement("p");
    eyebrow.className = "ballot-state-eyebrow";
    eyebrow.textContent = "VOTER REGISTRATION";
    heading.textContent = "Register to access your ballot";
    message.textContent = "Complete registration to see the contests for your county and district.";
    copy.append(eyebrow, heading, message);
    state.appendChild(copy);
    const link = document.createElement("a");
    link.className = "btn blue";
    link.classList.add("ballot-state-cta");
    link.href = "register.html";
    link.textContent = "Register Now";
    state.appendChild(link);
    box.replaceChildren(state, notice);
    return;
  }
  renderBallot();

  function renderBallot() {
    const races = (SITE.ballot || []).map((race, ballotIndex) => ({ ...race, ballotIndex }))
      .filter(race => {
        if (!race || !Array.isArray(race.candidates) || !race.candidates.length) return false;
        const office = String(race.office || (/senat/i.test(race.title) ? "senate" :
          /representative|congress|house/i.test(race.title) ? "representative" : /mayor/i.test(race.title) ? "mayor" : "")).toLowerCase();
        const area = String(race.area || "");
        if (office === "representative") {
          const match = area.match(/^(.+?)\s+District\s+(\d+)$/i);
          return match && match[1].toLowerCase() === registration.county.toLowerCase() &&
            Number(match[2]) === Number(registration.district);
        }
        if (office === "senate" || office === "mayor") {
          const county = area.replace(/\s+County$/i, "").trim();
          return county && county.toLowerCase() === registration.county.toLowerCase();
        }
        return false;
      });
    box.className = "card ballot-card";
    if (localStorage.getItem("srp_voted")) {
      renderBallotState("submitted", "SUBMISSION SAVED ON THIS DEVICE", "Ballot submitted",
        "Your selections are saved in this browser for this election round.", true);
      return;
    }
    heading.textContent = SITE.ballotTitle || "Election Ballot";
    heading.className = "ballot-title";
    const ballotHeader = document.createElement("div");
    ballotHeader.className = "ballot-header";
    const eyebrow = document.createElement("p");
    eyebrow.className = "ballot-eyebrow";
    eyebrow.textContent = "SPRINGFIELD ROLEPLAY GOVERNMENT";
    const subtitle = document.createElement("p");
    subtitle.className = "ballot-subtitle";
    subtitle.textContent = "Review each contest and make your selections carefully.";
    ballotHeader.append(eyebrow, heading, subtitle);
    const form = document.createElement("form");
    form.id = "localBallotForm";
    const voter = document.createElement("p");
    voter.className = "ballot-jurisdiction";
    voter.textContent = "Voting area: " + registration.county + " County, District " + registration.district;
    const rules = document.createElement("p");
    rules.className = "ballot-instructions";
    rules.textContent = "Select the required number of candidates in every contest. You can review your choices before submitting.";
    form.append(voter, rules);
    const progressWrap = document.createElement("div");
    progressWrap.className = "ballot-progress-wrap";
    const progressLabel = document.createElement("span");
    progressLabel.className = "ballot-progress-label";
    progressLabel.setAttribute("aria-live", "polite");
    const progress = document.createElement("div");
    progress.className = "ballot-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Completed ballot contests");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", String(races.length));
    const progressFill = document.createElement("span");
    progress.appendChild(progressFill);
    progressWrap.append(progressLabel, progress);
    form.appendChild(progressWrap);
    const error = document.createElement("p");
    error.className = "ballot-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    form.appendChild(error);
    const updateProgress = () => {
      const completed = races.filter(race => {
        const pick = Number.isInteger(Number(race.pick)) && Number(race.pick) > 0 ? Number(race.pick) : 1;
        return form.querySelectorAll('input[name="race-' + race.ballotIndex + '"]:checked').length === pick;
      }).length;
      progressLabel.textContent = completed + " of " + races.length + " contests complete";
      progress.setAttribute("aria-valuenow", String(completed));
      progressFill.style.width = (completed / races.length * 100) + "%";
    };
    races.forEach((race, raceIndex) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "ballot-contest";
      const legend = document.createElement("legend");
      const pick = Number.isInteger(Number(race.pick)) && Number(race.pick) > 0 ? Number(race.pick) : 1;
      const contestNumber = document.createElement("span");
      contestNumber.className = "contest-number";
      contestNumber.textContent = String(raceIndex + 1).padStart(2, "0");
      const contestTitle = document.createElement("span");
      contestTitle.textContent = race.title;
      legend.append(contestNumber, contestTitle);
      fieldset.appendChild(legend);
      const requirement = document.createElement("p");
      requirement.className = "contest-requirement";
      requirement.textContent = "Select " + pick + " candidate" + (pick === 1 ? "" : "s");
      fieldset.appendChild(requirement);
      race.candidates.forEach(candidate => {
        const label = document.createElement("label");
        label.className = "opt";
        const input = document.createElement("input");
        input.type = pick === 1 ? "radio" : "checkbox";
        input.name = "race-" + race.ballotIndex;
        input.value = candidate;
        const color = (SITE.colors || {})[candidate];
        if (color) input.style.accentColor = color;
        const text = document.createElement("span");
        text.textContent = candidate;
        label.append(input, text);
        fieldset.appendChild(label);
      });
      form.appendChild(fieldset);
    });
    form.addEventListener("change", () => {
      error.hidden = true;
      updateProgress();
    });
    if (!races.length) {
      const empty = document.createElement("p");
      empty.className = "ballot-empty";
      empty.textContent = "No contests have been published for your county and district.";
      progressWrap.hidden = true;
      form.appendChild(empty);
    } else {
      const submit = document.createElement("button");
      submit.className = "btn blue ballot-submit";
      submit.type = "submit";
      submit.textContent = "Submit Ballot";
      const actions = document.createElement("div");
      actions.className = "ballot-actions";
      actions.appendChild(submit);
      form.appendChild(actions);
      updateProgress();
      form.addEventListener("submit", event => {
        event.preventDefault();
        const selections = races.map(race => {
          const pick = Number.isInteger(Number(race.pick)) && Number(race.pick) > 0 ? Number(race.pick) : 1;
          return {
            race,
            pick,
            candidates: [...form.querySelectorAll('input[name="race-' + race.ballotIndex + '"]:checked')].map(input => input.value)
          };
        });
        const invalid = selections.find(selection => selection.candidates.length !== selection.pick);
        if (invalid) {
          error.textContent = "Complete every contest before submitting. Select exactly " +
            invalid.pick + " candidate" + (invalid.pick === 1 ? "" : "s") + " for " + invalid.race.title + ".";
          error.hidden = false;
          invalid.race && form.querySelector('input[name="race-' + invalid.race.ballotIndex + '"]')?.focus();
          error.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        const tally = JSON.parse(localStorage.getItem("srp_tally2") || "{}");
        const areaKey = registration.county + "|" + registration.district;
        selections.forEach(({ race, candidates }) => {
          tally[race.ballotIndex] = tally[race.ballotIndex] || {};
          tally[race.ballotIndex][areaKey] = tally[race.ballotIndex][areaKey] || {};
          candidates.forEach(candidate => {
            const areaTally = tally[race.ballotIndex][areaKey];
            areaTally[candidate] = (areaTally[candidate] || 0) + 1;
          });
        });
        localStorage.setItem("srp_tally2", JSON.stringify(tally));
        localStorage.setItem("srp_voted", JSON.stringify({ at: Date.now(), areaKey }));
        renderBallotState("submitted", "SUBMISSION SAVED ON THIS DEVICE", "Ballot submitted",
          "Your selections are saved in this browser for this election round.", true);
      });
    }
    box.replaceChildren(ballotHeader, form, notice);
  }
})();

(function liveMap() {
  const box = document.getElementById("mapbox");
  if (!box) return;
  const elections = (SITE.ballot || []).map((race, index) => ({ ...race, ballotIndex: index }))
    .filter(race => race.candidates && race.candidates.length);
  if (SITE.showMap === false) { box.remove(); return; }
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
  const colors = SITE.colors || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let sharedTallies = {};
  let sharedResultsStatus = "Connecting to shared results";
  let sharedResultsReady = false;
  const tallies = () => sharedTallies;
  const offices = [
    { key: "senate", label: "Senate", geography: "county" },
    { key: "representative", label: "Representatives", geography: "district" },
    { key: "mayor", label: "Mayors", geography: "county" }
  ];
  const officeOf = race => {
    if (/^(senate|representative|mayor)$/i.test(String(race.office || ""))) return race.office.toLowerCase();
    const title = String(race.title || "");
    if (/senat/i.test(title)) return "senate";
    if (/representative|congress|house/i.test(title)) return "representative";
    if (/mayor/i.test(title)) return "mayor";
    return "";
  };
  const normalizeCounty = value => String(value || "").replace(/\s+County$/i, "").trim().toLowerCase();
  const countyNames = B.map(area => area[0]).sort((a, b) => b.length - a.length);
  const areaOf = race => {
    if (race.area) {
      const districtMatch = String(race.area).match(/^(.+?)\s+District\s+(\d+)$/i);
      if (districtMatch) return { type: "district", key: districtMatch[1] + "|" + Number(districtMatch[2]) };
      return { type: "county", key: normalizeCounty(race.area) };
    }
    const title = String(race.title || "");
    if (officeOf(race) === "representative") {
      const district = D.find(area => {
        const label = area[2];
        const parts = label.match(/^(.*?)\s+D(\d+)$/);
        return title.toLowerCase().includes((area[0] + " district " + area[1]).toLowerCase()) ||
          (parts && title.toLowerCase().includes(parts[1].toLowerCase() + " d" + parts[2]));
      });
      return district ? { type: "district", key: district[0] + "|" + district[1] } : null;
    }
    const county = countyNames.find(name => title.toLowerCase().includes(name.toLowerCase()));
    return county ? { type: "county", key: normalizeCounty(county) } : null;
  };
  let cur = 0;
  let selectedRegion = null;
  const details = document.getElementById("mapDetails");
  document.getElementById("closeMapDetails").addEventListener("click", () => details.close());
  details.addEventListener("close", () => { selectedRegion = null; });

  const resultsFor = (race, area) => {
    const all = tallies()[race.ballotIndex] || {};
    if (area.type === "district") return all[area.key] || {};
    const countyName = B.find(item => normalizeCounty(item[0]) === area.key);
    const result = {};
    if (countyName) Object.keys(all).filter(key => key.split("|")[0] === countyName[0])
      .forEach(key => Object.entries(all[key]).forEach(([name, count]) => { result[name] = (result[name] || 0) + count; }));
    return result;
  };
  const updateDetails = () => {
    if (!selectedRegion) return;
    const race = elections.find(item => String(item.ballotIndex) === selectedRegion.raceId);
    const area = race ? areaOf(race) : null;
    const counts = race && area ? resultsFor(race, area) : {};
    const names = race ? [...new Set(race.candidates)] : [];
    const total = names.reduce((sum, name) => sum + (counts[name] || 0), 0);
    const highest = names.reduce((max, name) => Math.max(max, counts[name] || 0), 0);
    const leaders = names.filter(name => highest > 0 && (counts[name] || 0) === highest);
    document.getElementById("mapDetailsTitle").textContent = selectedRegion.name;
    document.getElementById("mapDetailsRace").textContent = race ? race.title : "No contest published for this area.";
    const status = document.getElementById("mapDetailsStatus");
    if (!race) status.textContent = "No candidates are listed for this area.";
    else if (!sharedResultsReady) status.textContent = sharedResultsStatus + ".";
    else if (!total) status.textContent = "No votes yet.";
    else if (leaders.length > 1) status.textContent = "Tied: " + leaders.join(", ") + " · " + total + " votes.";
    else status.textContent = "Leading: " + leaders[0] + " · " + total + " vote" + (total === 1 ? "" : "s") + ".";
    const list = document.getElementById("mapDetailsCandidates");
    list.replaceChildren();
    names.forEach(name => {
      const item = document.createElement("li");
      const swatch = document.createElement("span");
      swatch.className = "map-candidate-color";
      swatch.style.backgroundColor = colors[name] || "#888";
      const label = document.createElement("span");
      label.textContent = name;
      const count = document.createElement("strong");
      const votes = counts[name] || 0;
      count.textContent = sharedResultsReady ? votes + " vote" + (votes === 1 ? "" : "s") : "Results unavailable";
      item.append(swatch, label, count);
      list.appendChild(item);
    });
  };
  const draw = () => {
    const office = offices[cur];
    const groupRaces = elections.filter(race => officeOf(race) === office.key);
    const countyMap = office.geography === "county";
    const regions = countyMap ? B.map(area => ({
      area: { type: "county", key: normalizeCounty(area[0]) },
      label: area[1],
      points: area[2],
      x: area[3],
      y: area[4]
    })) : D.map(area => {
      const labelParts = area[2].split(" ");
      return {
        area: { type: "district", key: area[0] + "|" + area[1] },
        label: area[2],
        fullName: area[0] + " District " + area[1],
        points: area[3],
        x: area[3].split(" ").map(point => Number(point.split(",")[0])).reduce((sum, x) => sum + x, 0) / area[3].split(" ").length,
        y: area[3].split(" ").map(point => Number(point.split(",")[1])).reduce((sum, y) => sum + y, 0) / area[3].split(" ").length,
        labelParts
      };
    });
    const mapName = countyMap ? "county" : "district";
    document.getElementById("mtitle").textContent = office.label + " — " + (countyMap ? "County" : "District") + " Map Results";
    svg.setAttribute("aria-label", "Unofficial shared poll results for " + office.label + " by " + mapName);
    let total = 0;
    const out = regions.map(region => {
      const race = groupRaces.find(item => {
        const area = areaOf(item);
        return area && area.type === region.area.type && area.key === region.area.key;
      });
      const tally = race ? resultsFor(race, region.area) : {};
      const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      const tie = entries.length > 1 && entries[0][1] === entries[1][1];
      const won = entries.length > 0 && !tie;
      entries.forEach(([, count]) => { total += count; });
      const fill = won ? (colors[entries[0][0]] || "#888") : "#d3d7dc";
      const label = region.label;
      const lines = countyMap ? [label, "County"] : region.labelParts;
      const fontSize = countyMap ? 19 : 24;
      const lineHeight = countyMap ? 24 : 26;
      const data = race ? race.ballotIndex : "";
      const regionName = countyMap ? label + " County" : region.fullName;
      return '<g class="dist" role="button" tabindex="0" aria-label="' + esc(regionName + " results") + '" data-race="' + data + '" data-n="' + esc(regionName) + '">' +
        '<polygon points="' + region.points + '" fill="' + fill + '" stroke="#222" stroke-width="2"></polygon>' +
        '<text x="' + region.x + '" y="' + region.y + '" text-anchor="middle" font-size="' + fontSize + '" font-weight="700" fill="' + (won ? "#fff" : "#222") + '" pointer-events="none">' +
        esc(lines[0]) + '<tspan x="' + region.x + '" dy="' + lineHeight + '">' + esc(lines[1] || "") + "</tspan></text></g>";
    }).join("");
    svg.innerHTML = out;
    document.getElementById("maptotal").textContent = groupRaces.length
      ? sharedResultsStatus + (sharedResultsReady ? ": " + total + " vote" + (total === 1 ? "" : "s") : "") + ". Unverified roleplay poll; not an official count."
      : "No " + office.label.toLowerCase() + " contests are published. Areas are gray; no results are displayed.";
    document.querySelectorAll("#mdots button").forEach((button, index) => {
      button.classList.toggle("on", index === cur);
      button.setAttribute("aria-selected", String(index === cur));
    });
    updateDetails();
  };

  const go = i => { if (details.open) details.close(); selectedRegion = null; cur = (i + offices.length) % offices.length; draw(); };
  const nav = box.querySelector(".mapnav"), dots = document.getElementById("mdots");
  dots.innerHTML = offices.map((office, index) => '<button type="button" role="tab" aria-label="' + office.label + ' map" aria-selected="' + (index === cur) + '">' + office.label + "</button>").join("");
  dots.addEventListener("click", ev => {
    const index = [...dots.children].indexOf(ev.target.closest("button"));
    if (index >= 0) go(index);
  });
  document.getElementById("mprev").onclick = () => go(cur - 1);
  document.getElementById("mnext").onclick = () => go(cur + 1);
  waitForFirebase().then(services => {
    const resultCollection = services.collection(
      services.db, "elections", String(SITE.voteRound || 1), "results"
    );
    services.onSnapshot(resultCollection, snapshot => {
      const next = {};
      snapshot.forEach(resultDocument => {
        const race = elections.find(item => String(item.ballotIndex) === resultDocument.id);
        if (!race) return;
        const result = resultDocument.data();
        if (!result || result.areaKey !== resultAreaKey(race) ||
            !result.counts || typeof result.counts !== "object" || Array.isArray(result.counts)) return;
        next[race.ballotIndex] = { [result.areaKey]: result.counts };
      });
      sharedTallies = next;
      sharedResultsReady = true;
      sharedResultsStatus = "Shared unofficial roleplay poll";
      draw();
    }, error => {
      sharedResultsReady = false;
      sharedTallies = {};
      sharedResultsStatus = "Shared results unavailable (" +
        (error && error.code ? error.code : "Firebase error") + "). Check Firebase setup and Firestore Rules";
      draw();
    });
  }).catch(error => {
    sharedResultsReady = false;
    sharedResultsStatus = "Shared results unavailable (" +
      (error && error.message ? error.message : "Firebase error") + ")";
    draw();
  });
  const openRegion = region => {
    selectedRegion = { raceId: region.dataset.race, name: region.dataset.n };
    updateDetails();
    if (!details.open) details.showModal();
  };
  svg.addEventListener("click", event => {
    const region = event.target.closest(".dist");
    if (region) openRegion(region);
  });
  svg.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const region = event.target.closest(".dist");
    if (region) { event.preventDefault(); openRegion(region); }
  });
  draw();
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
  const county = f.elements.county, district = f.elements.district, summary = document.getElementById("regsummary");
  const submit = f.querySelector('[type="submit"]');
  const ok = document.getElementById("ok");
  const lockRegistration = () => {
    f.querySelectorAll("input, select, textarea").forEach(field => { field.disabled = true; });
    submit.disabled = true;
    submit.textContent = "Registration Submitted";
  };
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
    summary.textContent = "Selected area: " + county.value + " County, District " + district.value + ".";
    summary.style.display = "block";
  });
  let savedRegistration;
  try {
    savedRegistration = JSON.parse(localStorage.getItem("srp_reg") || "null");
  } catch (error) {
    throw new Error("Could not read the saved local registration.", { cause: error });
  }
  if (!SITE.registrationOpen && !savedRegistration) {
    f.parentElement.innerHTML = '<div class="closed"><h2>Registration is currently CLOSED</h2><p>Check back before the next election round.</p></div>';
    return;
  }
  if (savedRegistration) {
    f.elements.name.value = savedRegistration.name || "";
    f.elements.discord.value = savedRegistration.discord || "";
    f.elements.notes.value = savedRegistration.notes || "";
    if (COUNTIES[savedRegistration.county] && Number(savedRegistration.district) >= 1 &&
        Number(savedRegistration.district) <= COUNTIES[savedRegistration.county]) {
      county.value = savedRegistration.county;
      update();
      district.value = String(savedRegistration.district);
      summary.textContent = "Registered area: " + county.value + " County, District " + district.value + ". Submitted registrations cannot be changed this round.";
      summary.style.display = "block";
    }
    lockRegistration();
    ok.textContent = "Registration submitted. Your details are read-only for this election round.";
    ok.style.display = "block";
  }
  f.addEventListener("submit", e => {
    e.preventDefault();
    const d = new FormData(f);
    const registration = {
      name: String(d.get("name") || "").trim(),
      discord: String(d.get("discord") || "").trim(),
      county: String(d.get("county") || ""),
      district: String(d.get("district") || ""),
      notes: String(d.get("notes") || "").trim()
    };
    localStorage.setItem("srp_reg", JSON.stringify(registration));
    localStorage.removeItem("srp_reg_approved");
    lockRegistration();
    summary.textContent = "Registered area: " + registration.county + " County, District " + registration.district + ". Submitted registrations cannot be changed this round.";
    summary.style.display = "block";
    ok.textContent = "Registration complete and saved in this browser. Your details are read-only for this election round.";
    ok.style.display = "block";
  });
})();
