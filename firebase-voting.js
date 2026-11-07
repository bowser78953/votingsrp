(function sharedBallot() {
  const box = document.getElementById("votebox");
  if (!box) return;

  const notice = document.createElement("p");
  notice.className = "ballot-disclosure";
  notice.textContent = "This is an unofficial roleplay poll. Google sign-in limits one submission per account and contest; it does not verify a person or prevent multiple accounts. Your area is self-reported and locked for this election round. Only aggregate totals are public.";

  const renderState = (kind, eyebrowText, titleText, descriptionText, includeNotice = false) => {
    const state = document.createElement("div");
    state.className = "ballot-state ballot-state-" + kind;
    state.setAttribute("role", kind === "submitted" ? "status" : kind === "error" ? "alert" : "region");
    state.setAttribute("aria-live", kind === "submitted" ? "polite" : kind === "error" ? "assertive" : "off");
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
      const results = document.createElement("a");
      results.className = "ballot-state-link";
      results.href = "live.html";
      results.textContent = "View shared results";
      actions.append(home, results);
      children.push(actions);
    }
    if (includeNotice) children.push(notice);
    box.replaceChildren(...children);
  };

  const showError = (title, message) => {
    box.className = "card ballot-card";
    renderState("error", "SHARED POLL SETUP", title, message, true);
  };

  box.classList.add("ballot-card");
  if (localStorage.getItem("srp_policy") !== "1") {
    box.className = "card closed";
    box.innerHTML = '<div class="closed"><h2>Read the Policies first</h2><p>You must read the Election Rules &amp; Policies and tick "I have read" at the bottom before you can register or vote.</p><a class="btn blue" href="policies.html">Read the Policies</a></div>';
    return;
  }
  if (!SITE.votingOpen) {
    renderState("closed", "VOTING STATUS", "The ballot is not open",
      "Check back during the published voting period. Complete registration before voting opens.");
    return;
  }

  let registration;
  try {
    registration = JSON.parse(localStorage.getItem("srp_reg") || "null");
  } catch (error) {
    showError("Could not read registration", "The saved registration data is invalid. Please register again before voting.");
    return;
  }
  if (!registration || !registration.county || !registration.district) {
    const state = document.createElement("div");
    state.className = "ballot-state ballot-state-registration";
    const copy = document.createElement("div");
    copy.className = "ballot-state-copy";
    const eyebrow = document.createElement("p");
    eyebrow.className = "ballot-state-eyebrow";
    eyebrow.textContent = "VOTER REGISTRATION";
    const title = document.createElement("h2");
    title.textContent = "Register to access your ballot";
    const description = document.createElement("p");
    description.textContent = "Complete registration to select the area for your self-reported poll profile.";
    copy.append(eyebrow, title, description);
    state.appendChild(copy);
    const link = document.createElement("a");
    link.className = "btn blue ballot-state-cta";
    link.href = "register.html";
    link.textContent = "Register Now";
    state.appendChild(link);
    box.replaceChildren(state, notice);
    return;
  }

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

  const firebaseError = error => {
    if (error && error.code === "auth/unauthorized-domain") {
      return "This website domain is not authorized in Firebase Authentication. Add the deployed Render domain and your custom domain under Authentication > Settings > Authorized domains.";
    }
    if (error && error.code === "permission-denied") {
      return "Firestore denied the request. Publish the provided Firestore Rules and check the ballotConfig/current document.";
    }
    if (error && error.code === "auth/operation-not-allowed") {
      return "Google sign-in is not enabled. Turn on the Google provider under Firebase Authentication > Sign-in method.";
    }
    if (error && error.code === "auth/popup-blocked") {
      return "The sign-in popup was blocked. Allow popups for this site and try again.";
    }
    return error && error.message ? error.message : "An unexpected Firebase error occurred.";
  };

  const officeOf = race => {
    if (/^(senate|representative|mayor)$/i.test(String(race.office || ""))) return race.office.toLowerCase();
    const title = String(race.title || "");
    if (/senat/i.test(title)) return "senate";
    if (/representative|congress|house/i.test(title)) return "representative";
    if (/mayor/i.test(title)) return "mayor";
    return "";
  };
  const areaKeyOf = race => {
    const area = String(race.area || "").trim();
    const district = area.match(/^(.+?)\s+District\s+(\d+)$/i);
    if (district) return district[1] + "|" + Number(district[2]);
    return area.replace(/\s+County$/i, "").trim();
  };
  const racesFor = profile => (SITE.ballot || []).map((race, ballotIndex) => ({ ...race, ballotIndex }))
    .filter(race => {
      if (!race || !Array.isArray(race.candidates) || !race.candidates.length) return false;
      const office = officeOf(race);
      const area = String(race.area || "");
      if (office === "representative") {
        const match = area.match(/^(.+?)\s+District\s+(\d+)$/i);
        return match && match[1].toLowerCase() === profile.county.toLowerCase() &&
          Number(match[2]) === Number(profile.district);
      }
      if (office === "senate" || office === "mayor") {
        const county = area.replace(/\s+County$/i, "").trim();
        return county && county.toLowerCase() === profile.county.toLowerCase();
      }
      return false;
    });

  const renderSignIn = (services, errorMessage = "") => {
    box.className = "card ballot-card";
    const state = document.createElement("div");
    state.className = "ballot-state ballot-state-registration";
    const copy = document.createElement("div");
    copy.className = "ballot-state-copy";
    const eyebrow = document.createElement("p");
    eyebrow.className = "ballot-state-eyebrow";
    eyebrow.textContent = "SHARED ROLEPLAY POLL";
    const title = document.createElement("h2");
    title.textContent = "Sign in with Google to continue";
    const description = document.createElement("p");
    description.textContent = "Your Google account can submit one ballot per contest this election round.";
    copy.append(eyebrow, title, description);
    state.appendChild(copy);
    const button = document.createElement("button");
    button.className = "btn blue ballot-state-cta";
    button.type = "button";
    button.textContent = "Continue with Google";
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Opening Google sign-in...";
      try {
        await services.signInWithPopup(services.auth, new services.GoogleAuthProvider());
      } catch (error) {
        renderSignIn(services, firebaseError(error));
      }
    });
    state.appendChild(button);
    const children = [state];
    if (errorMessage) {
      const error = document.createElement("p");
      error.className = "ballot-error";
      error.setAttribute("role", "alert");
      error.textContent = errorMessage;
      children.push(error);
    }
    children.push(notice);
    box.replaceChildren(...children);
  };

  const renderProfilePrompt = (services, user, roundId, errorMessage = "") => {
    box.className = "card ballot-card";
    const state = document.createElement("div");
    state.className = "ballot-state ballot-state-registration";
    const copy = document.createElement("div");
    copy.className = "ballot-state-copy";
    const eyebrow = document.createElement("p");
    eyebrow.className = "ballot-state-eyebrow";
    eyebrow.textContent = "CONFIRM POLL AREA";
    const title = document.createElement("h2");
    title.textContent = "Confirm your registered area";
    const description = document.createElement("p");
    description.textContent = "Your poll area is " + registration.county + " County, District " + registration.district + ". It will be locked to this Google account for this election round. This is self-reported and not verified.";
    copy.append(eyebrow, title, description);
    state.appendChild(copy);
    const button = document.createElement("button");
    button.className = "btn blue ballot-state-cta";
    button.type = "button";
    button.textContent = "Confirm my area";
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Saving area...";
      try {
        await services.setDoc(services.doc(services.db, "elections", roundId, "profiles", user.uid), {
          uid: user.uid,
          county: registration.county,
          district: String(registration.district),
          createdAt: services.serverTimestamp()
        });
      } catch (error) {
        renderProfilePrompt(services, user, roundId, firebaseError(error));
        return;
      }
      await loadUser(services, user, roundId).catch(error => {
        showError("Could not load your shared ballot", firebaseError(error));
      });
    });
    state.appendChild(button);
    const children = [state];
    if (errorMessage) {
      const error = document.createElement("p");
      error.className = "ballot-error";
      error.setAttribute("role", "alert");
      error.textContent = errorMessage;
      children.push(error);
    }
    children.push(notice);
    box.replaceChildren(...children);
  };

  const loadUser = async (services, user, roundId) => {
    const profileRef = services.doc(services.db, "elections", roundId, "profiles", user.uid);
    const profileSnapshot = await services.getDoc(profileRef);
    if (!profileSnapshot.exists()) {
      renderProfilePrompt(services, user, roundId);
      return;
    }
    const profile = profileSnapshot.data();
    const races = racesFor(profile);
    if (races.some(race => Number(race.pick || 1) !== 1)) {
      showError("This ballot is not configured for shared voting",
        "Shared poll submission currently supports one selection per contest. Ask an administrator to configure every contest as pick 1.");
      return;
    }
    const configSnapshot = await services.getDoc(services.doc(services.db, "ballotConfig", "current"));
    if (!configSnapshot.exists()) {
      showError("Ballot configuration is incomplete",
        "The administrator must create ballotConfig/current in Firestore before voting can begin.");
      return;
    }
    const contestConfigs = configSnapshot.data().contests;
    if (!contestConfigs || typeof contestConfigs !== "object" || Array.isArray(contestConfigs)) {
      showError("Ballot configuration is incomplete",
        "The ballotConfig/current document must contain a contests map keyed by each contest's number.");
      return;
    }
    const configs = [];
    for (const race of races) {
      const raceId = String(race.ballotIndex);
      const config = contestConfigs[raceId];
      if (!config) {
        showError("Ballot configuration is incomplete",
          "Add contest " + raceId + " to the contests map in ballotConfig/current before voting can begin.");
        return;
      }
      if (config.office !== officeOf(race) || config.areaKey !== areaKeyOf(race) ||
          Number(config.pick) !== 1 || JSON.stringify(config.candidates) !== JSON.stringify(race.candidates)) {
        showError("Ballot configuration does not match",
          "Contest " + raceId + " in ballotConfig/current does not match the published ballot. Ask an administrator to update it.");
        return;
      }
      configs.push(config);
    }

    const voteRefs = races.map(race => services.doc(
      services.db, "elections", roundId, "votes", user.uid, "contests", String(race.ballotIndex)
    ));
    const votes = await Promise.all(voteRefs.map(reference => services.getDoc(reference)));
    if (votes.some(vote => vote.exists())) {
      renderState("submitted", "SUBMISSION RECORDED", "Ballot already submitted",
        "A ballot for this election round is already recorded for your Google account. The public map shows aggregate totals only.", true);
      return;
    }
    renderBallot(services, user, profile, roundId, races, configs);
  };

  const renderBallot = (services, user, profile, roundId, races, configs) => {
    box.className = "card ballot-card";
    const header = document.createElement("div");
    header.className = "ballot-header";
    const eyebrow = document.createElement("p");
    eyebrow.className = "ballot-eyebrow";
    eyebrow.textContent = "SPRINGFIELD ROLEPLAY GOVERNMENT";
    const title = document.createElement("h2");
    title.className = "ballot-title";
    title.textContent = SITE.ballotTitle || "Election Ballot";
    const subtitle = document.createElement("p");
    subtitle.className = "ballot-subtitle";
    subtitle.textContent = "Review each contest and make your selections carefully.";
    header.append(eyebrow, title, subtitle);
    const form = document.createElement("form");
    form.id = "localBallotForm";
    const voter = document.createElement("p");
    voter.className = "ballot-jurisdiction";
    voter.textContent = "Poll area: " + profile.county + " County, District " + profile.district;
    const rules = document.createElement("p");
    rules.className = "ballot-instructions";
    rules.textContent = "Select one candidate in every contest. Your submission is shared as aggregate totals on the public results map.";
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
      const completed = races.filter(race =>
        form.querySelectorAll('input[name="race-' + race.ballotIndex + '"]:checked').length === 1
      ).length;
      progressLabel.textContent = completed + " of " + races.length + " contests complete";
      progress.setAttribute("aria-valuenow", String(completed));
      progressFill.style.width = (completed / races.length * 100) + "%";
    };
    races.forEach((race, raceIndex) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "ballot-contest";
      const legend = document.createElement("legend");
      const number = document.createElement("span");
      number.className = "contest-number";
      number.textContent = String(raceIndex + 1).padStart(2, "0");
      const contestTitle = document.createElement("span");
      contestTitle.textContent = race.title;
      legend.append(number, contestTitle);
      fieldset.appendChild(legend);
      const requirement = document.createElement("p");
      requirement.className = "contest-requirement";
      requirement.textContent = "Select 1 candidate";
      fieldset.appendChild(requirement);
      race.candidates.forEach(candidate => {
        const label = document.createElement("label");
        label.className = "opt";
        const input = document.createElement("input");
        input.type = "radio";
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
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const selections = races.map((race, index) => ({
          race,
          config: configs[index],
          candidate: form.querySelector('input[name="race-' + race.ballotIndex + '"]:checked')?.value || ""
        }));
        const invalid = selections.find(selection =>
          !selection.candidate || !selection.config.candidates.includes(selection.candidate)
        );
        if (invalid) {
          error.textContent = "Select exactly one candidate for every contest before submitting.";
          error.hidden = false;
          form.querySelector('input[name="race-' + invalid.race.ballotIndex + '"]')?.focus();
          error.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        submit.disabled = true;
        submit.textContent = "Submitting securely...";
        error.hidden = true;
        try {
          await services.runTransaction(services.db, async transaction => {
            const configRef = services.doc(services.db, "ballotConfig", "current");
            const configSnapshot = await transaction.get(configRef);
            if (!configSnapshot.exists()) {
              throw new Error("The shared ballot configuration is missing. Ask an administrator to create ballotConfig/current.");
            }
            const contestConfigs = configSnapshot.data().contests;
            if (!contestConfigs || typeof contestConfigs !== "object" || Array.isArray(contestConfigs)) {
              throw new Error("The shared ballot configuration is invalid. Ask an administrator to check ballotConfig/current.");
            }
            const pending = [];
            for (const selection of selections) {
              const raceId = String(selection.race.ballotIndex);
              const voteRef = services.doc(services.db, "elections", roundId, "votes", user.uid, "contests", raceId);
              const resultRef = services.doc(services.db, "elections", roundId, "results", raceId);
              const voteSnapshot = await transaction.get(voteRef);
              const resultSnapshot = await transaction.get(resultRef);
              pending.push({ selection, voteRef, resultRef, voteSnapshot, resultSnapshot });
            }
            if (pending.some(item => item.voteSnapshot.exists())) {
              throw new Error("Your Google account already has a ballot recorded for this election round.");
            }
            for (const item of pending) {
              const { selection, resultSnapshot } = item;
              const currentConfig = contestConfigs[String(selection.race.ballotIndex)];
              if (!currentConfig ||
                  currentConfig.office !== selection.config.office ||
                  currentConfig.areaKey !== selection.config.areaKey ||
                  Number(currentConfig.pick) !== Number(selection.config.pick) ||
                  JSON.stringify(currentConfig.candidates) !== JSON.stringify(selection.config.candidates)) {
                throw new Error("The published ballot configuration changed while you were voting. Reload the page and review it again.");
              }
              const candidate = selection.candidate;
              const counts = resultSnapshot.exists() ? resultSnapshot.data().counts : {};
              if (!counts || typeof counts !== "object" || Array.isArray(counts) ||
                  Object.values(counts).some(count => !Number.isInteger(count) || count < 0)) {
                throw new Error("The shared result data is invalid. Ask an administrator to review this contest.");
              }
              const areaKey = selection.config.areaKey;
              item.voteData = {
                uid: user.uid,
                raceId: String(selection.race.ballotIndex),
                candidate,
                areaKey,
                submittedAt: services.serverTimestamp()
              };
              item.counts = { ...counts, [candidate]: (counts[candidate] || 0) + 1 };
            }
            for (const item of pending) {
              transaction.set(item.voteRef, item.voteData);
              if (item.resultSnapshot.exists()) {
                transaction.update(item.resultRef, { counts: item.counts });
              } else {
                transaction.set(item.resultRef, {
                  raceId: item.voteData.raceId,
                  areaKey: item.voteData.areaKey,
                  counts: { [item.voteData.candidate]: 1 }
                });
              }
            }
          });
          renderState("submitted", "SUBMISSION RECORDED", "Ballot submitted",
            "Your ballot is recorded for this election round. Only aggregate totals are shared on the public results map.", true);
        } catch (submissionError) {
          submit.disabled = false;
          submit.textContent = "Submit Ballot";
          error.textContent = firebaseError(submissionError);
          error.hidden = false;
        }
      });
    }
    box.replaceChildren(header, form, notice);
  };

  box.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "ballot-instructions";
  loading.textContent = "Connecting to shared poll...";
  box.appendChild(loading);
  waitForFirebase().then(services => {
    const roundId = String(SITE.voteRound || 1);
    services.onAuthStateChanged(services.auth, user => {
      if (!user) {
        renderSignIn(services);
        return;
      }
      loadUser(services, user, roundId).catch(error => {
        showError("Could not load your shared ballot", firebaseError(error));
      });
    }, error => {
      showError("Could not verify Google sign-in", firebaseError(error));
    });
  }).catch(error => {
    showError("Firebase is not available", firebaseError(error));
  });
})();
