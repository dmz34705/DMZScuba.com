(() => {
  if (!document.body.classList.contains("training-home-page")) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

  const setNumber = (element, property, value) => {
    element.style.setProperty(property, Number(value).toFixed(4));
  };

  function initReveal() {
    const items = [...document.querySelectorAll("[data-training-reveal]")];
    if (!items.length) return;

    items.forEach((item) => item.classList.add("training-reveal"));
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -7% 0px" }
    );

    items.forEach((item) => observer.observe(item));
  }

  function storyProgress(root) {
    const rect = root.getBoundingClientRect();
    const travel = Math.max(rect.height - window.innerHeight, 1);
    return clamp(-rect.top / travel);
  }

  function sceneWeight(position, index, falloff = 1.6) {
    return clamp(1 - Math.abs(position - index) * falloff);
  }

  function createTrainingStory() {
    const root = document.querySelector("[data-training-story]");
    if (!root) return null;

    const visuals = [...root.querySelectorAll("[data-training-visual]")];
    const scenes = [...root.querySelectorAll("[data-training-scene]")];
    const progressBar = root.querySelector("[data-training-progress]");
    if (visuals.length < 2 || visuals.length !== scenes.length) return null;

    return {
      root,
      sceneCount: scenes.length,
      update() {
        const progress = storyProgress(root);
        const position = progress * (scenes.length - 1);
        const activeIndex = Math.round(position);

        visuals.forEach((visual, index) => {
          const weight = sceneWeight(position, index);
          const distance = clamp(Math.abs(position - index), 0, 1);
          setNumber(visual, "--training-scene-opacity", weight);
          setNumber(visual, "--training-scene-scale", 1.005 + distance * 0.055);
          visual.style.setProperty("--training-scene-drift", `${((index - position) * 18).toFixed(2)}px`);
          setNumber(visual, "--training-scene-saturation", 0.82 + weight * 0.21);
          setNumber(visual, "--training-scene-brightness", 0.68 + weight * 0.25);
          visual.classList.toggle("is-active", index === activeIndex);
        });

        scenes.forEach((scene, index) => {
          const weight = sceneWeight(position, index, 2.1);
          const offset = clamp((index - position) * 48, -48, 48);
          setNumber(scene, "--training-copy-opacity", weight);
          scene.style.setProperty("--training-copy-y", `${offset.toFixed(2)}px`);
          const isCurrent = index === activeIndex;
          scene.classList.toggle("is-active", weight > 0.01);
          scene.style.pointerEvents = isCurrent ? "auto" : "none";
          scene.setAttribute("aria-hidden", isCurrent ? "false" : "true");
        });

        if (progressBar) setNumber(progressBar, "--training-story-progress", progress);
      },
    };
  }

  function createHeroMotion() {
    const hero = document.querySelector("[data-training-hero]");
    const copy = hero?.querySelector(".page-hero-copy");
    const logo = hero?.querySelector(".training-hero-logo");
    if (!hero || !copy) return null;

    return {
      root: hero,
      update() {
        const rect = hero.getBoundingClientRect();
        const progress = clamp(-rect.top / Math.max(rect.height, 1));
        copy.style.setProperty("--training-hero-y", `${(-progress * 34).toFixed(2)}px`);
        setNumber(copy, "--training-hero-opacity", clamp(1 - progress * 1.25));
        if (logo) {
          logo.style.setProperty("--training-logo-y", `${(progress * 28).toFixed(2)}px`);
          setNumber(logo, "--training-logo-opacity", clamp(1 - progress * 1.1));
        }
      },
    };
  }

  function resetStoryAccessibility() {
    document.querySelectorAll("[data-training-scene]").forEach((scene) => {
      scene.removeAttribute("aria-hidden");
      scene.style.pointerEvents = "";
    });
  }

  function initMotion() {
    initReveal();

    if (reducedMotion.matches || !window.CSS?.supports("position", "sticky")) {
      resetStoryAccessibility();
      return;
    }

    document.body.classList.add("training-motion-ready");
    let story = createTrainingStory();
    let targets = [story, createHeroMotion()].filter(Boolean);
    let frameRequested = false;
    let settleFrame = 0;
    let snapFrame = 0;
    let lastScrollAt = 0;
    const sceneSettleDelay = 160;

    const update = () => {
      frameRequested = false;
      targets.forEach((target) => target.update());
    };

    const scheduleUpdate = () => {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(update);
    };

    const cancelSceneSnap = () => {
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
      if (snapFrame) window.cancelAnimationFrame(snapFrame);
      settleFrame = 0;
      snapFrame = 0;
      document.documentElement.classList.remove("training-story-is-snapping");
    };

    const activeStory = () => {
      if (!story || story.sceneCount < 2) return null;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const rect = story.root.getBoundingClientRect();
      return rect.top < -8 && rect.bottom > viewportHeight + 8 ? story : null;
    };

    const animateSceneSnap = (targetY, distance) => {
      const startY = window.scrollY;
      const duration = clamp(260 + distance * 0.24, 280, 560);
      const startAt = performance.now();
      document.documentElement.classList.add("training-story-is-snapping");

      const animate = (now) => {
        const progress = clamp((now - startAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 4);
        window.scrollTo(0, startY + (targetY - startY) * eased);
        scheduleUpdate();

        if (progress < 1) {
          snapFrame = window.requestAnimationFrame(animate);
          return;
        }

        snapFrame = 0;
        document.documentElement.classList.remove("training-story-is-snapping");
      };

      snapFrame = window.requestAnimationFrame(animate);
    };

    const snapNearestScene = () => {
      if (snapFrame || document.visibilityState !== "visible") return;
      const currentStory = activeStory();
      if (!currentStory) return;

      const rect = currentStory.root.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight, 1);
      const progress = clamp(-rect.top / travel);
      const sceneStops = currentStory.sceneCount - 1;
      const targetProgress = Math.round(progress * sceneStops) / sceneStops;
      const storyTop = window.scrollY + rect.top;
      const targetY = storyTop + targetProgress * travel;
      const distance = Math.abs(targetY - window.scrollY);
      if (distance < 4) return;

      animateSceneSnap(targetY, distance);
    };

    const watchForScrollSettle = (now) => {
      if (snapFrame) {
        settleFrame = 0;
        return;
      }
      if (now - lastScrollAt < sceneSettleDelay) {
        settleFrame = window.requestAnimationFrame(watchForScrollSettle);
        return;
      }
      settleFrame = 0;
      snapNearestScene();
    };

    const scheduleSceneSnap = () => {
      if (snapFrame) return;
      lastScrollAt = performance.now();
      if (!settleFrame) settleFrame = window.requestAnimationFrame(watchForScrollSettle);
    };

    const handleScroll = () => {
      scheduleUpdate();
      scheduleSceneSnap();
    };

    const interruptSceneSnap = () => {
      cancelSceneSnap();
      lastScrollAt = performance.now();
    };

    const rebuild = () => {
      cancelSceneSnap();
      resetStoryAccessibility();
      story = createTrainingStory();
      targets = [story, createHeroMotion()].filter(Boolean);
      scheduleUpdate();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", interruptSceneSnap, { passive: true });
    window.addEventListener("touchstart", interruptSceneSnap, { passive: true });
    window.addEventListener("pointerdown", interruptSceneSnap, { passive: true });
    window.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
        interruptSceneSnap();
      }
    });
    window.addEventListener("resize", rebuild, { passive: true });
    reducedMotion.addEventListener?.("change", () => window.location.reload());
    scheduleUpdate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMotion, { once: true });
  } else {
    initMotion();
  }
})();
