(() => {
  const modal = document.getElementById("dive-quiz-modal");
  if (!modal) return;

  const modeButtons = document.querySelectorAll("[data-open-quiz]");
  const closeButton = modal.querySelector("[data-close-quiz]");
  const bodyEl = document.getElementById("dive-quiz-body");
  const modeLabel = document.getElementById("dive-quiz-mode-label");
  const progressEl = document.getElementById("dive-quiz-progress");
  const actionsEl = document.getElementById("dive-quiz-actions");
  const backButton = document.getElementById("dive-quiz-back");
  const nextButton = document.getElementById("dive-quiz-next");
  const card = modal.querySelector(".dive-quiz-card");

  const quickQuestions = [
    {
      id: "experience",
      prompt: "What is your diving status right now?",
      options: [
        { value: "new", title: "I am brand new", copy: "I need to get certified." },
        { value: "certified", title: "I am certified and active", copy: "I am ready for more dives." },
        { value: "rusty", title: "I am certified but rusty", copy: "I want to rebuild confidence." }
      ]
    },
    {
      id: "goal",
      prompt: "What sounds best right now?",
      options: [
        { value: "cert", title: "Start certification", copy: "Build core skills from day one." },
        { value: "refresh", title: "Refresher and guided dives", copy: "Get comfortable again fast." },
        { value: "travel", title: "Travel planning", copy: "I want a destination-focused path." },
        { value: "unsure", title: "Not sure yet", copy: "Help me choose the right path." }
      ]
    },
    {
      id: "timeline",
      prompt: "When do you want to begin?",
      options: [
        { value: "soon", title: "As soon as possible", copy: "I want dates now." },
        { value: "month", title: "Within 1 to 3 months", copy: "I can plan ahead." },
        { value: "exploring", title: "Just exploring", copy: "I want to understand options first." }
      ]
    },
    {
      id: "comfort",
      prompt: "How are you feeling about the water right now?",
      options: [
        { value: "cautious", title: "Cautious", copy: "I want extra support and coaching." },
        { value: "ready", title: "Ready", copy: "I am excited to jump in." }
      ]
    },
    {
      id: "coaching",
      prompt: "What style works best for you?",
      options: [
        { value: "small", title: "Small group coaching", copy: "Learn with close instructor support." },
        { value: "private", title: "Private focus", copy: "I prefer one-on-one pace." },
        { value: "either", title: "Either works", copy: "I am flexible on format." }
      ]
    }
  ];

  const builderQuestions = [
    {
      id: "experience",
      prompt: "Where are you in your dive journey?",
      options: [
        { value: "new", title: "Brand new", copy: "No certification yet." },
        { value: "ow", title: "Open Water certified", copy: "Ready for next skills." },
        { value: "advanced", title: "Advanced or higher", copy: "Looking to specialize or travel more." },
        { value: "rusty", title: "Certified but rusty", copy: "Need a clean restart." }
      ]
    },
    {
      id: "interest",
      prompt: "What type of diving pulls you in most?",
      options: [
        { value: "reef", title: "Reef and marine life", copy: "Color, fish, and relaxed depth." },
        { value: "wreck", title: "Wreck diving", copy: "Structure, history, and navigation." },
        { value: "cold", title: "Cold-water and local", copy: "Great Lakes and quarry confidence." },
        { value: "photo", title: "Photo and content", copy: "Capture dives and improve control." }
      ]
    },
    {
      id: "comfort",
      prompt: "How confident do you feel in the water today?",
      options: [
        { value: "low", title: "Low confidence", copy: "I want gradual coaching." },
        { value: "medium", title: "Moderate confidence", copy: "I am improving and want reps." },
        { value: "high", title: "High confidence", copy: "I am ready for challenge." }
      ]
    },
    {
      id: "timeline",
      prompt: "What is your target timeline?",
      options: [
        { value: "now", title: "Now", copy: "I want to start this month." },
        { value: "quarter", title: "Next 1 to 3 months", copy: "I am planning with intention." },
        { value: "later", title: "Later this year", copy: "I want a long-term plan." }
      ]
    },
    {
      id: "gear",
      prompt: "How interested are you in gear setup guidance?",
      options: [
        { value: "yes", title: "Very interested", copy: "I want practical setup advice." },
        { value: "some", title: "Some interest", copy: "Only what I need right now." },
        { value: "no", title: "Not a priority", copy: "I can rent or keep it simple." }
      ]
    },
    {
      id: "travel",
      prompt: "What travel goal sounds most like you?",
      options: [
        { value: "none", title: "No travel yet", copy: "I want local reps first." },
        { value: "warm", title: "Warm-water trip soon", copy: "I want to prep for vacation diving." },
        { value: "expedition", title: "Big adventure trip", copy: "I want a milestone dive trip." }
      ]
    },
    {
      id: "trainingGoal",
      prompt: "What training path sounds best right now?",
      options: [
        { value: "openwater", title: "Open Water", copy: "Start from the foundation." },
        { value: "advanced", title: "Advanced progression", copy: "Level up with real-world reps." },
        { value: "refresher", title: "Skill refresh", copy: "Rebuild control before adding depth." },
        { value: "unsure", title: "Need guidance", copy: "Help me choose the right route." }
      ]
    },
    {
      id: "frequency",
      prompt: "How often do you want to dive this year?",
      options: [
        { value: "seasonal", title: "A few focused trips", copy: "Quality over quantity." },
        { value: "monthly", title: "Monthly or more", copy: "I want strong progression." },
        { value: "occasional", title: "Occasional local dives", copy: "Keep it flexible and fun." }
      ]
    },
    {
      id: "team",
      prompt: "Who are you usually diving with?",
      options: [
        { value: "solo", title: "Mostly solo", copy: "I need a guided route and buddy options." },
        { value: "buddy", title: "With a buddy", copy: "We want a plan we can do together." },
        { value: "group", title: "With family or friends", copy: "I want a team-friendly pathway." }
      ]
    },
    {
      id: "focus",
      prompt: "What skill focus matters most next?",
      options: [
        { value: "confidence", title: "Confidence and control", copy: "Buoyancy, air use, and comfort." },
        { value: "navigation", title: "Navigation and awareness", copy: "Move smarter and safer underwater." },
        { value: "photo", title: "Photo and content skills", copy: "Stable movement and framing." },
        { value: "adventure", title: "Adventure readiness", copy: "Be prepared for bigger dives." }
      ]
    }
  ];

  const state = {
    mode: null,
    index: 0,
    answers: {},
    questions: [],
    lastFocused: null,
    keyHandlerBound: false
  };

  function openQuiz(mode, triggerEl) {
    state.mode = mode === "builder" ? "builder" : "quick";
    state.index = 0;
    state.answers = {};
    state.questions = state.mode === "builder" ? builderQuestions : quickQuestions;
    state.lastFocused = triggerEl || document.activeElement;

    modeLabel.textContent = state.mode === "builder" ? "Dive Path Builder" : "Quick Recommendation";
    actionsEl.hidden = false;
    backButton.hidden = true;
    nextButton.disabled = true;
    nextButton.textContent = "Next";
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("quiz-open");
    renderQuestion();

    if (!state.keyHandlerBound) {
      document.addEventListener("keydown", onKeydown);
      state.keyHandlerBound = true;
    }
  }

  function closeQuiz() {
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("quiz-open");
    if (state.keyHandlerBound) {
      document.removeEventListener("keydown", onKeydown);
      state.keyHandlerBound = false;
    }
    if (state.lastFocused && typeof state.lastFocused.focus === "function") {
      state.lastFocused.focus();
    }
  }

  function onKeydown(event) {
    if (modal.getAttribute("aria-hidden") === "true") return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeQuiz();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = card.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderQuestion() {
    const question = state.questions[state.index];
    if (!question) return;

    progressEl.textContent = `Question ${state.index + 1} of ${state.questions.length}`;
    backButton.hidden = state.index === 0;
    nextButton.disabled = !state.answers[question.id];
    nextButton.textContent = state.index === state.questions.length - 1 ? "View Result" : "Next";

    const optionsHtml = question.options
      .map((option) => {
        const selected = state.answers[question.id] === option.value;
        const selectedClass = selected ? " is-selected" : "";
        return `
          <button type="button" class="dive-quiz-option${selectedClass}" data-option-value="${option.value}">
            <span class="dive-quiz-option-title">${option.title}</span>
            <span class="dive-quiz-option-copy">${option.copy}</span>
          </button>
        `;
      })
      .join("");

    bodyEl.innerHTML = `
      <section class="dive-quiz-question" data-question-id="${question.id}">
        <h3 class="dive-quiz-question-title">${question.prompt}</h3>
        <div class="dive-quiz-options">${optionsHtml}</div>
      </section>
    `;

    const focusTarget =
      bodyEl.querySelector(".dive-quiz-option.is-selected") || bodyEl.querySelector(".dive-quiz-option");
    if (focusTarget) focusTarget.focus();
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function maxKey(scores) {
    return Object.keys(scores).reduce((best, key) => (scores[key] > scores[best] ? key : best), "cert");
  }

  function buildHref(basePath, params, hash) {
    const query = new URLSearchParams(params);
    const queryString = query.toString();
    return `${basePath}${queryString ? `?${queryString}` : ""}${hash || ""}`;
  }

  function quickResult() {
    const answers = state.answers;
    const experience = answers.experience;
    const goal = answers.goal;
    const timeline = answers.timeline;
    const comfort = answers.comfort;

    let routeType = "contact";
    if (experience === "new" || goal === "cert") {
      routeType = "cert";
    } else if (experience === "rusty" || goal === "refresh") {
      routeType = "refresh";
    } else if (goal === "travel" && experience !== "new") {
      routeType = "travel";
    } else if (goal === "unsure" || timeline === "exploring") {
      routeType = "contact";
    } else if (comfort === "ready") {
      routeType = "travel";
    }

    const startMap = {
      cert: "Open Water Certification",
      refresh: "Skill Refresh and local guided dives",
      travel: "Trip-ready coaching and destination planning",
      contact: "Training discovery consultation"
    };

    const next = routeType === "cert"
      ? "Pool and quarry skills to lock in confidence"
      : "Targeted local dives with personal coaching";
    const thenStep = routeType === "travel"
      ? "Destination trip prep and travel planning"
      : "Specialty or travel progression based on your goals";
    const future = comfort === "cautious"
      ? "Build repeat reps, then step into advanced goals"
      : "Step into advanced goals with a clear training timeline";

    const routeSlug = slugify(`${routeType}-${startMap[routeType]}`);
    const ctaHref = buildCta(routeType, "quick", routeSlug);

    return {
      routeType,
      title: "Your Dive Path",
      intro: "Based on your answers, this is your best next move.",
      start: startMap[routeType],
      next,
      thenStep,
      future,
      ctaHref
    };
  }

  function builderResult() {
    const answers = state.answers;
    const scores = { cert: 0, refresh: 0, travel: 0, contact: 0 };

    if (answers.experience === "new") scores.cert += 4;
    if (answers.experience === "rusty") scores.refresh += 4;
    if (answers.experience === "advanced") scores.travel += 2;
    if (answers.experience === "ow") scores.travel += 1;

    if (answers.trainingGoal === "openwater") scores.cert += 3;
    if (answers.trainingGoal === "refresher") scores.refresh += 3;
    if (answers.trainingGoal === "advanced") scores.travel += 2;
    if (answers.trainingGoal === "unsure") scores.contact += 3;

    if (answers.timeline === "now") {
      scores.cert += 1;
      scores.refresh += 1;
    }
    if (answers.timeline === "later") scores.contact += 1;

    if (answers.travel === "warm" || answers.travel === "expedition") scores.travel += 3;
    if (answers.travel === "none") scores.cert += 1;

    if (answers.comfort === "low") scores.refresh += 2;
    if (answers.comfort === "high") scores.travel += 1;

    if (answers.gear === "yes") {
      scores.cert += 1;
      scores.travel += 1;
    }

    if (answers.focus === "confidence") scores.refresh += 1;
    if (answers.focus === "adventure") scores.travel += 1;

    const routeType = maxKey(scores);
    const specialtyMap = {
      reef: "Buoyancy and marine life dive focus",
      wreck: "Wreck and navigation progression",
      cold: "Cold-water and drysuit preparation",
      photo: "Underwater imaging and trim control"
    };
    const specialty = specialtyMap[answers.interest] || "Specialty progression based on your goals";

    const startMap = {
      cert: "Open Water Certification",
      refresh: "Skill Refresh and confidence rebuild",
      travel: "Trip-ready coaching and destination planning",
      contact: "Discovery consult to map your best route"
    };

    const next = answers.team === "solo"
      ? "Guided local dives to build consistency with support"
      : "Local reps with your dive team to lock in habits";
    const thenStep = answers.travel === "none"
      ? `${specialty} before major travel`
      : `${specialty} plus destination prep`;
    const future = answers.frequency === "monthly"
      ? "Advanced pathway with repeat dives and specialty milestones"
      : "Steady progression toward advanced goals at your pace";

    const routeSlug = slugify(`${routeType}-${answers.interest}-${answers.focus}-${answers.timeline}`);
    const ctaHref = buildCta(routeType, "builder", routeSlug);

    return {
      routeType,
      title: "Your Dive Path",
      intro: "This path is built from your interests, comfort level, and timeline.",
      start: startMap[routeType],
      next,
      thenStep,
      future,
      ctaHref
    };
  }

  function buildCta(routeType, mode, pathSlug) {
    const baseParams = {
      quiz_mode: mode,
      quiz_path: pathSlug,
      source: "dive-path-quiz"
    };
    if (routeType === "cert") {
      return buildHref("pages/training/open-water/index.html", baseParams);
    }
    if (routeType === "refresh") {
      return buildHref(
        "pages/contact/index.html",
        { ...baseParams, interest: "training", course: "sdi-refresher" },
        "#dive-now"
      );
    }
    if (routeType === "travel") {
      return buildHref("pages/travel/index.html", baseParams);
    }
    return buildHref("pages/contact/index.html", { ...baseParams, interest: "custom" }, "#dive-now");
  }

  function renderResult() {
    const result = state.mode === "builder" ? builderResult() : quickResult();
    progressEl.textContent = "Result ready";
    actionsEl.hidden = true;

    bodyEl.innerHTML = `
      <section class="dive-quiz-result">
        <h3>${result.title}</h3>
        <p>${result.intro}</p>
        <ul class="dive-quiz-result-list">
          <li><strong>Start:</strong> ${result.start}</li>
          <li><strong>Next:</strong> ${result.next}</li>
          <li><strong>Then:</strong> ${result.thenStep}</li>
          <li><strong>Future:</strong> ${result.future}</li>
        </ul>
        <a class="btn primary dive-quiz-result-cta" href="${result.ctaHref}">Start This Path</a>
        <button type="button" class="btn secondary" data-retake-quiz>Retake Quiz</button>
        <div class="dive-quiz-email-placeholder">Email capture can be added here later without changing quiz logic.</div>
        <p class="dive-quiz-result-note">Your path is practical and flexible. DMZ can tune it with you after contact.</p>
        <p class="dive-quiz-meta">Route: ${result.routeType} | Mode: ${state.mode}</p>
      </section>
    `;

    const cta = bodyEl.querySelector(".dive-quiz-result-cta");
    if (cta) cta.focus();
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => openQuiz(button.getAttribute("data-open-quiz"), button));
  });

  closeButton.addEventListener("click", closeQuiz);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeQuiz();
  });

  bodyEl.addEventListener("click", (event) => {
    const optionButton = event.target.closest("[data-option-value]");
    if (optionButton) {
      const question = state.questions[state.index];
      if (!question) return;
      state.answers[question.id] = optionButton.getAttribute("data-option-value");
      renderQuestion();
      return;
    }

    const retakeButton = event.target.closest("[data-retake-quiz]");
    if (retakeButton) {
      openQuiz(state.mode, retakeButton);
    }
  });

  backButton.addEventListener("click", () => {
    if (state.index === 0) return;
    state.index -= 1;
    renderQuestion();
  });

  nextButton.addEventListener("click", () => {
    if (state.index >= state.questions.length - 1) {
      renderResult();
      return;
    }
    state.index += 1;
    renderQuestion();
  });
})();
