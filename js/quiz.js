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

  const quickQuestionBank = [
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
      id: "newGoal",
      when: (answers) => answers.experience === "new",
      prompt: "What do you want from your first dive step?",
      options: [
        { value: "cert", title: "Start certification", copy: "Build confidence and core skills." },
        { value: "discovery", title: "Talk through options first", copy: "I want guidance before committing." },
        { value: "travelPrep", title: "Get ready for a trip", copy: "I want to prep for planned travel." }
      ]
    },
    {
      id: "certifiedGoal",
      when: (answers) => answers.experience === "certified",
      prompt: "What is your next move as a certified diver?",
      options: [
        { value: "travel", title: "Plan travel diving", copy: "I want trip-ready progression." },
        { value: "specialty", title: "Build a specialty path", copy: "I want focused skill progression." },
        { value: "guided", title: "More local dive days", copy: "I want more reps and confidence." },
        { value: "unsure", title: "Not sure yet", copy: "Help me choose the best option." }
      ]
    },
    {
      id: "rustyGoal",
      when: (answers) => answers.experience === "rusty",
      prompt: "What feels most important right now?",
      options: [
        { value: "refresh", title: "Skill refresher first", copy: "Rebuild comfort and control." },
        { value: "guided", title: "Guided local dives", copy: "Get active again with support." },
        { value: "travel", title: "Get trip-ready soon", copy: "Tune up and prep for travel." }
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
      id: "newBarrier",
      when: (answers) => answers.experience === "new",
      prompt: "What is your biggest blocker to starting?",
      options: [
        { value: "confidence", title: "Confidence in the water", copy: "I want patient coaching." },
        { value: "time", title: "Schedule and timing", copy: "I need a realistic timeline." },
        { value: "cost", title: "Understanding cost and value", copy: "I want clear options first." }
      ]
    },
    {
      id: "certifiedFocus",
      when: (answers) => answers.experience === "certified",
      prompt: "What focus area would improve your dives most?",
      options: [
        { value: "navigation", title: "Navigation and control", copy: "Move smarter and safer underwater." },
        { value: "buoyancy", title: "Buoyancy and trim", copy: "Improve efficiency and confidence." },
        { value: "photo", title: "Photo and video skills", copy: "Capture dives while staying stable." }
      ]
    },
    {
      id: "coaching",
      prompt: "What coaching style works best for you?",
      options: [
        { value: "small", title: "Small group coaching", copy: "Learn with close instructor support." },
        { value: "private", title: "Private focus", copy: "I prefer one-on-one pace." },
        { value: "either", title: "Either works", copy: "I am flexible on format." }
      ]
    }
  ];

  const builderQuestionBank = [
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
      id: "newStart",
      when: (answers) => answers.experience === "new",
      prompt: "What kind of start sounds right for you?",
      options: [
        { value: "openwater", title: "Open Water certification", copy: "Start with a complete training path." },
        { value: "discovery", title: "Talk first, then schedule", copy: "I want a clear plan before committing." },
        { value: "tripReady", title: "Certify for an upcoming trip", copy: "I need a timeline that matches travel." }
      ]
    },
    {
      id: "certPath",
      when: (answers) => answers.experience === "ow" || answers.experience === "advanced",
      prompt: "What progression feels best next?",
      options: [
        { value: "advanced", title: "Advanced progression", copy: "Expand depth, navigation, and confidence." },
        { value: "specialty", title: "Specialty training", copy: "Focus on wreck, drysuit, nitrox, or photo." },
        { value: "travelPrep", title: "Travel readiness", copy: "Train around your destination plans." }
      ]
    },
    {
      id: "rustyReset",
      when: (answers) => answers.experience === "rusty",
      prompt: "What reset path would help most?",
      options: [
        { value: "refresher", title: "Skill refresher", copy: "Rebuild confidence and comfort first." },
        { value: "guided", title: "Guided dive days", copy: "Get active again with supported reps." },
        { value: "hybrid", title: "Refresh plus travel prep", copy: "Tune up and then prep for a trip." }
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
      id: "confidenceBlocker",
      when: (answers) => answers.comfort === "low",
      prompt: "What would help your confidence most?",
      options: [
        { value: "pool", title: "Pool and fundamentals", copy: "Start controlled and structured." },
        { value: "quarry", title: "Guided local open water", copy: "Build confidence in real conditions." },
        { value: "smallGroup", title: "Smaller coaching environment", copy: "I learn best with close support." }
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
      id: "travel",
      prompt: "What travel goal sounds most like you?",
      options: [
        { value: "none", title: "No travel yet", copy: "I want local reps first." },
        { value: "warm", title: "Warm-water trip soon", copy: "I want to prep for vacation diving." },
        { value: "expedition", title: "Big adventure trip", copy: "I want a milestone dive trip." }
      ]
    },
    {
      id: "travelWindow",
      when: (answers) => answers.travel === "warm" || answers.travel === "expedition",
      prompt: "When is that trip window?",
      options: [
        { value: "soon", title: "Within 3 months", copy: "Fast timeline and focused prep." },
        { value: "halfYear", title: "Within 6 months", copy: "Steady progression before travel." },
        { value: "later", title: "More than 6 months", copy: "Long runway for a full path." }
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

  function getQuestionBank(mode) {
    return mode === "builder" ? builderQuestionBank : quickQuestionBank;
  }

  function buildActiveQuestions(mode, answers) {
    return getQuestionBank(mode).filter((question) => !question.when || question.when(answers));
  }

  function refreshQuestionSet() {
    const active = buildActiveQuestions(state.mode, state.answers);
    const allowed = new Set(active.map((q) => q.id));
    Object.keys(state.answers).forEach((key) => {
      if (!allowed.has(key)) delete state.answers[key];
    });
    state.questions = active;
    if (state.index > state.questions.length - 1) {
      state.index = Math.max(0, state.questions.length - 1);
    }
  }

  function openQuiz(mode, triggerEl) {
    state.mode = mode === "builder" ? "builder" : "quick";
    state.index = 0;
    state.answers = {};
    state.questions = [];
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
    refreshQuestionSet();
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

  function resolveQuickGoal(answers) {
    return answers.newGoal || answers.certifiedGoal || answers.rustyGoal || "";
  }

  function labelForAnswer(questionId, value) {
    const question = [...quickQuestionBank, ...builderQuestionBank].find((item) => item.id === questionId);
    if (!question) return value || "";
    const option = question.options.find((item) => item.value === value);
    return option ? option.title : value || "";
  }

  function buildHighlights(answers) {
    const keys = ["experience", "timeline", "interest", "focus", "travel", "comfort", "coaching"];
    return keys
      .map((key) => {
        const value = answers[key];
        if (!value) return "";
        return labelForAnswer(key, value);
      })
      .filter(Boolean)
      .slice(0, 4);
  }

  function buildExecutionPlan(routeType, answers) {
    const timeline = answers.timeline || "quarter";
    const coaching = answers.coaching || "either";
    const comfort = answers.comfort || "medium";
    const travel = answers.travel || "";
    const immediate = timeline === "now" || timeline === "soon" ? "within 24 hours" : "this week";

    if (routeType === "cert") {
      return [
        {
          phase: `Now (${immediate})`,
          text: "Pick your Open Water start window and submit a training inquiry."
        },
        {
          phase: "This week",
          text:
            coaching === "private"
              ? "Lock a private-focused training plan with clear milestones."
              : "Lock your class timeline and first skills session."
        },
        {
          phase: "Next 30 days",
          text:
            comfort === "cautious"
              ? "Complete fundamentals + confidence reps, then schedule open-water progression."
              : "Complete core milestones and prep your next progression step."
        }
      ];
    }

    if (routeType === "refresh") {
      return [
        {
          phase: `Now (${immediate})`,
          text: "Request a refresher or guided-dive reset based on your current comfort level."
        },
        {
          phase: "This week",
          text: "Schedule targeted local reps to rebuild control, trim, and confidence."
        },
        {
          phase: "Next 30 days",
          text:
            travel === "warm" || travel === "expedition"
              ? "Transition from refresher into trip-prep coaching."
              : "Move into advanced or specialty progression once consistency is back."
        }
      ];
    }

    if (routeType === "travel") {
      return [
        {
          phase: `Now (${immediate})`,
          text: "Choose your target trip window and confirm your current skill baseline."
        },
        {
          phase: "This week",
          text: "Build a trip-prep plan: local reps, focused skills, and gear priorities."
        },
        {
          phase: "Next 30 days",
          text: "Execute your prep dives and finalize travel-readiness milestones."
        }
      ];
    }

    return [
      {
        phase: `Now (${immediate})`,
        text: "Submit a discovery request so DMZ can map your best-fit path."
      },
      {
        phase: "This week",
        text: "Review training, refresher, and travel options matched to your goals."
      },
      {
        phase: "Next 30 days",
        text: "Start the recommended lane with clear milestones and next-step checkpoints."
      }
    ];
  }

  function buildSupportCta(routeType, mode, pathSlug, answers) {
    const summary = `Mode: ${mode}; Path: ${pathSlug}; Experience: ${answers.experience || "n/a"}; Timeline: ${
      answers.timeline || "n/a"
    }.`;
    const common = {
      quiz_mode: mode,
      quiz_path: pathSlug,
      source: "dive-path-quiz",
      message: summary
    };

    if (routeType === "cert") {
      return {
        label: "Talk Through My Plan",
        href: buildHref("pages/contact/index.html", { ...common, interest: "training" }, "#dive-now")
      };
    }

    if (routeType === "refresh") {
      return {
        label: "View Skill Refresh",
        href: buildHref("pages/training/skill-refresh/index.html", common)
      };
    }

    if (routeType === "travel") {
      return {
        label: "Talk Through Travel Prep",
        href: buildHref("pages/contact/index.html", { ...common, interest: "travel" }, "#dive-now")
      };
    }

    return {
      label: "See Training Options",
      href: buildHref("pages/training/index.html", common)
    };
  }

  function quickResult() {
    const answers = state.answers;
    const experience = answers.experience;
    const goal = resolveQuickGoal(answers);
    const timeline = answers.timeline;
    const comfort = answers.comfort;

    let routeType = "contact";
    if (experience === "new" || goal === "cert") {
      routeType = "cert";
    } else if (experience === "rusty" || goal === "refresh" || goal === "guided") {
      routeType = "refresh";
    } else if (goal === "travel" || goal === "travelPrep") {
      routeType = "travel";
    } else if (goal === "specialty") {
      routeType = "contact";
    }

    if (timeline === "exploring" || goal === "discovery" || goal === "unsure") {
      routeType = "contact";
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

    const routeSlug = slugify(`${routeType}-${startMap[routeType]}-${goal || "general"}`);
    const ctaHref = buildCta(routeType, "quick", routeSlug, answers);
    const supportCta = buildSupportCta(routeType, "quick", routeSlug, answers);
    const confidence = routeType === "contact" ? "Guided fit path" : "Strong match";
    const highlights = buildHighlights(answers);
    const execution = buildExecutionPlan(routeType, answers);

    return {
      routeType,
      title: "Your Dive Path",
      intro: "Based on your answers, this is your best next move.",
      start: startMap[routeType],
      next,
      thenStep,
      future,
      ctaHref,
      primaryLabel: "Start This Path",
      supportCta,
      confidence,
      highlights,
      execution
    };
  }

  function builderResult() {
    const answers = state.answers;
    const scores = { cert: 0, refresh: 0, travel: 0, contact: 0 };

    if (answers.experience === "new") scores.cert += 5;
    if (answers.experience === "rusty") scores.refresh += 4;
    if (answers.experience === "advanced") scores.travel += 2;
    if (answers.experience === "ow") scores.travel += 1;

    if (answers.newStart === "openwater") scores.cert += 3;
    if (answers.newStart === "discovery") scores.contact += 3;
    if (answers.newStart === "tripReady") scores.travel += 2;

    if (answers.certPath === "advanced" || answers.certPath === "specialty") scores.travel += 2;
    if (answers.certPath === "travelPrep") scores.travel += 3;

    if (answers.rustyReset === "refresher" || answers.rustyReset === "guided") scores.refresh += 3;
    if (answers.rustyReset === "hybrid") {
      scores.refresh += 2;
      scores.travel += 1;
    }

    if (answers.comfort === "low") scores.refresh += 2;
    if (answers.comfort === "high") scores.travel += 1;

    if (answers.travel === "warm" || answers.travel === "expedition") scores.travel += 3;
    if (answers.travel === "none") scores.cert += 1;

    if (answers.timeline === "now") {
      scores.cert += 1;
      scores.refresh += 1;
    }
    if (answers.timeline === "later") scores.contact += 1;

    if (answers.gear === "yes") {
      scores.cert += 1;
      scores.travel += 1;
    }

    if (answers.focus === "confidence") scores.refresh += 1;
    if (answers.focus === "adventure") scores.travel += 1;
    if (answers.focus === "navigation") scores.travel += 1;

    if (answers.newStart === "discovery") scores.contact += 2;

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

    const routeSlug = slugify(
      `${routeType}-${answers.interest || "general"}-${answers.focus || "balanced"}-${answers.timeline || "flex"}`
    );
    const ctaHref = buildCta(routeType, "builder", routeSlug, answers);
    const supportCta = buildSupportCta(routeType, "builder", routeSlug, answers);
    const confidence = routeType === "contact" ? "Needs consult fit" : "Strong match";
    const highlights = buildHighlights(answers);
    const execution = buildExecutionPlan(routeType, answers);

    return {
      routeType,
      title: "Your Dive Path",
      intro: "This path is built from your interests, comfort level, and timeline.",
      start: startMap[routeType],
      next,
      thenStep,
      future,
      ctaHref,
      primaryLabel: "Start This Path",
      supportCta,
      confidence,
      highlights,
      execution
    };
  }

  function buildCta(routeType, mode, pathSlug, answers) {
    const baseParams = {
      quiz_mode: mode,
      quiz_path: pathSlug,
      source: "dive-path-quiz",
      route: routeType,
      experience: answers.experience || "",
      timeline: answers.timeline || "",
      comfort: answers.comfort || "",
      interest: answers.interest || ""
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
    const highlightHtml = result.highlights
      .map((item) => `<li>${item}</li>`)
      .join("");
    const executionHtml = result.execution
      .map((item) => `<li><strong>${item.phase}:</strong> ${item.text}</li>`)
      .join("");

    bodyEl.innerHTML = `
      <section class="dive-quiz-result">
        <h3>${result.title}</h3>
        <p>${result.intro}</p>
        <p class="dive-quiz-confidence"><strong>Match:</strong> ${result.confidence}</p>
        <ul class="dive-quiz-highlights">${highlightHtml}</ul>
        <ul class="dive-quiz-result-list">
          <li><strong>Start:</strong> ${result.start}</li>
          <li><strong>Next:</strong> ${result.next}</li>
          <li><strong>Then:</strong> ${result.thenStep}</li>
          <li><strong>Future:</strong> ${result.future}</li>
        </ul>
        <div class="dive-quiz-plan">
          <h4>Execution Plan</h4>
          <ul class="dive-quiz-plan-list">${executionHtml}</ul>
        </div>
        <div class="dive-quiz-result-actions">
          <a class="btn primary dive-quiz-result-cta" href="${result.ctaHref}">${result.primaryLabel}</a>
          <p class="dive-quiz-cta-note">Takes about 2 minutes. We will follow up with your next best step.</p>
          <a class="dive-quiz-result-cta-secondary" href="${result.supportCta.href}">${result.supportCta.label}</a>
          <button type="button" class="dive-quiz-retake-link" data-retake-quiz>Retake Quiz</button>
        </div>
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

  const params = new URLSearchParams(window.location.search);
  const openQuizMode = params.get("openQuiz");
  if (openQuizMode === "quick" || openQuizMode === "builder") {
    openQuiz(openQuizMode, modeButtons[0] || null);
  }

  closeButton.addEventListener("click", closeQuiz);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeQuiz();
  });

  bodyEl.addEventListener("click", (event) => {
    const optionButton = event.target.closest("[data-option-value]");
    if (optionButton) {
      refreshQuestionSet();
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
    refreshQuestionSet();
    if (state.index >= state.questions.length - 1) {
      renderResult();
      return;
    }
    state.index += 1;
    renderQuestion();
  });
})();
