(() => {
  if (!document.body.classList.contains("home-page")) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopStory = window.matchMedia("(min-width: 981px)");

  const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);
  const setNumber = (element, property, value) => {
    element.style.setProperty(property, Number(value).toFixed(4));
  };

  function initReveal() {
    const items = [...document.querySelectorAll("[data-reveal]")];
    if (!items.length) return;

    items.forEach((item) => item.classList.add("reveal"));
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
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" }
    );

    items.forEach((item) => observer.observe(item));
  }

  function storyProgress(root) {
    const rect = root.getBoundingClientRect();
    const travel = Math.max(rect.height - window.innerHeight, 1);
    return clamp(-rect.top / travel);
  }

  function stickySnapMetrics(root, stickyElement) {
    const rect = root.getBoundingClientRect();
    const stickyRect = stickyElement.getBoundingClientRect();
    const stickyTop = Number.parseFloat(window.getComputedStyle(stickyElement).top) || 0;
    const travel = Math.max(rect.height - stickyRect.height, 1);
    const startY = window.scrollY + rect.top - stickyTop;
    return {
      progress: clamp((window.scrollY - startY) / travel),
      startY,
      travel,
    };
  }

  function sceneWeight(position, index, falloff = 1.55) {
    return clamp(1 - Math.abs(position - index) * falloff);
  }

  function setActiveCopy(items, activeIndex, opacityProperty, yProperty, position) {
    items.forEach((item, index) => {
      const weight = sceneWeight(position, index, 2.15);
      const offset = clamp((index - position) * 54, -54, 54);
      setNumber(item, opacityProperty, weight);
      item.style.setProperty(yProperty, `${offset.toFixed(2)}px`);
      const isCurrent = index === activeIndex;
      item.classList.toggle("is-active", weight > 0.01);
      item.style.pointerEvents = isCurrent ? "auto" : "none";
      item.setAttribute("aria-hidden", isCurrent ? "false" : "true");
    });
  }

  function createUnlockStory() {
    const root = document.querySelector('[data-scroll-story="unlocks"]');
    if (!root) return null;

    const visuals = [...root.querySelectorAll("[data-unlock-visual]")];
    const scenes = [...root.querySelectorAll("[data-unlock-scene]")];
    const progressBar = root.querySelector("[data-unlock-progress]");
    if (!visuals.length || visuals.length !== scenes.length) return null;

    return {
      root,
      sceneCount: scenes.length,
      snapMetrics: () => stickySnapMetrics(root, root.querySelector(".unlock-story-sticky")),
      update() {
        const progress = storyProgress(root);
        const position = progress * (scenes.length - 1);
        const activeIndex = Math.round(position);

        visuals.forEach((visual, index) => {
          const weight = sceneWeight(position, index);
          const distance = Math.abs(position - index);
          setNumber(visual, "--scene-opacity", weight);
          setNumber(visual, "--scene-scale", 1.045 + clamp(distance, 0, 1) * 0.045);
          visual.style.setProperty("--scene-drift", `${((index - position) * 20).toFixed(2)}px`);
          setNumber(visual, "--scene-saturation", 0.78 + weight * 0.24);
          setNumber(visual, "--scene-brightness", 0.68 + weight * 0.3);
          visual.classList.toggle("is-active", index === activeIndex);
        });

        setActiveCopy(scenes, activeIndex, "--copy-opacity", "--copy-y", position);
        if (progressBar) setNumber(progressBar, "--story-progress", progress);
      },
    };
  }

  function createWhyStory() {
    const root = document.querySelector('[data-scroll-story="why"]');
    if (!root || !desktopStory.matches) return null;

    const visuals = [...root.querySelectorAll("[data-why-visual]")];
    const steps = [...root.querySelectorAll("[data-why-step]")];
    const progressBar = root.querySelector("[data-why-progress]");
    if (!visuals.length || visuals.length !== steps.length) return null;

    return {
      root,
      sceneCount: steps.length,
      snapMetrics: () => stickySnapMetrics(root, root.querySelector(".why-dmz")),
      update() {
        const progress = storyProgress(root);
        const position = progress * (steps.length - 1);
        const activeIndex = Math.round(position);

        visuals.forEach((visual, index) => {
          const weight = sceneWeight(position, index);
          const distance = Math.abs(position - index);
          setNumber(visual, "--why-opacity", weight);
          setNumber(visual, "--why-scale", 1.04 + clamp(distance, 0, 1) * 0.04);
          visual.style.setProperty("--why-x", `${((index - position) * 12).toFixed(2)}px`);
          visual.style.setProperty("--why-y", `${((index - position) * 16).toFixed(2)}px`);
          setNumber(visual, "--why-saturation", 0.8 + weight * 0.22);
          setNumber(visual, "--why-brightness", 0.7 + weight * 0.27);
          visual.classList.toggle("is-active", index === activeIndex);
        });

        setActiveCopy(steps, activeIndex, "--why-copy-opacity", "--why-copy-y", position);
        if (progressBar) setNumber(progressBar, "--why-progress", progress);
      },
    };
  }

  function createParallaxTargets() {
    const targets = [];
    const hero = document.querySelector(".hero");
    const heroStage = hero?.querySelector(".hero-dive-stage");
    const heroBg = hero?.querySelector(".hero-bg");
    const heroCopy = hero?.querySelector(".hero-copy");
    const heroMark = hero?.querySelector(".hero-mark");
    const heroCue = hero?.querySelector(".hero-scroll-cue");
    const heroDiveFx = hero?.querySelector(".hero-dive-fx");

    if (hero && heroStage && heroBg) {
      targets.push({
        root: hero,
        sceneCount: 2,
        snapMetrics: () => stickySnapMetrics(hero, heroStage),
        update() {
          const progress = stickySnapMetrics(hero, heroStage).progress;
          const copyFade = clamp(1 - clamp((progress - 0.1) / 0.52));
          const surfaceWeight = clamp(1 - Math.abs(progress - 0.48) * 2.35);
          hero.classList.toggle("is-diving", progress > 0.03 && progress < 0.995);

          heroBg.style.setProperty("--px", `${(progress * 64).toFixed(2)}px`);
          setNumber(heroBg, "--s", 1.015 + progress * 0.16);
          setNumber(heroBg, "--dive-saturation", 1.04 + progress * 0.18);
          setNumber(heroBg, "--dive-brightness", 1 - progress * 0.2);
          heroBg.style.setProperty("--dive-blur", `${(progress * 1.25).toFixed(2)}px`);

          if (heroCopy) {
            heroCopy.style.setProperty("--px", `${(progress * -92).toFixed(2)}px`);
            setNumber(heroCopy, "--fade", copyFade);
          }
          if (heroMark) {
            heroMark.style.setProperty("--mark-y", `${(progress * -58).toFixed(2)}px`);
            setNumber(heroMark, "--mark-scale", 1 - progress * 0.1);
            setNumber(heroMark, "--mark-fade", clamp(1 - progress * 1.65));
          }
          if (heroCue) {
            heroCue.style.setProperty("--cue-y", `${(progress * 24).toFixed(2)}px`);
            setNumber(heroCue, "--cue-opacity", clamp(1 - progress * 6));
          }
          if (heroDiveFx) {
            heroDiveFx.style.setProperty("--waterline", `${(112 - progress * 132).toFixed(2)}%`);
            setNumber(heroDiveFx, "--depth-opacity", clamp(progress * 1.35));
            setNumber(heroDiveFx, "--surface-opacity", surfaceWeight * 0.95);
            setNumber(heroDiveFx, "--caustic-opacity", clamp((progress - 0.16) / 0.46) * 0.62);
            setNumber(heroDiveFx, "--bubble-opacity", clamp((progress - 0.2) / 0.28) * 0.9);
            setNumber(heroDiveFx, "--vignette-opacity", clamp((progress - 0.42) / 0.58) * 0.88);
          }
        },
      });
    }

    const finalCta = document.querySelector(".final-cta");
    const finalCtaBg = finalCta?.querySelector(".final-cta-bg");
    if (finalCta && finalCtaBg) {
      targets.push({
        root: finalCta,
        update() {
          const rect = finalCta.getBoundingClientRect();
          const progress = clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height));
          finalCtaBg.style.setProperty("--px", `${(progress * 54 - 27).toFixed(2)}px`);
          setNumber(finalCtaBg, "--s", 1 + progress * 0.045);
        },
      });
    }

    return targets;
  }

  function resetStoryAccessibility() {
    document.querySelectorAll("[data-unlock-scene], [data-why-step]").forEach((item) => {
      item.removeAttribute("aria-hidden");
      item.style.pointerEvents = "";
    });
  }

  function initMotion() {
    initReveal();

    if (reducedMotion.matches || !window.CSS?.supports("position", "sticky")) {
      resetStoryAccessibility();
      return;
    }

    document.body.classList.add("motion-ready");
    let targets = [createUnlockStory(), createWhyStory(), ...createParallaxTargets()].filter(Boolean);
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
      document.documentElement.classList.remove("story-is-snapping");
    };

    const nearestActiveStory = () => {
      for (const target of targets) {
        if (!target.sceneCount || target.sceneCount < 2 || !target.snapMetrics) continue;
        const metrics = target.snapMetrics();
        if (metrics.progress > 0.008 && metrics.progress < 0.992) return { target, metrics };
      }
      return null;
    };

    const animateSceneSnap = (targetY, distance) => {
      const startY = window.scrollY;
      const duration = clamp(260 + distance * 0.24, 280, 560);
      const startAt = performance.now();
      document.documentElement.classList.add("story-is-snapping");

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
        document.documentElement.classList.remove("story-is-snapping");
      };

      snapFrame = window.requestAnimationFrame(animate);
    };

    const snapNearestStoryScene = () => {
      if (snapFrame || document.visibilityState !== "visible") return;
      const activeStory = nearestActiveStory();
      if (!activeStory) return;

      const { target: story, metrics } = activeStory;
      const targetProgress = Math.round(metrics.progress * (story.sceneCount - 1)) / (story.sceneCount - 1);
      const targetY = metrics.startY + targetProgress * metrics.travel;
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
      snapNearestStoryScene();
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

    const rebuildStories = () => {
      cancelSceneSnap();
      resetStoryAccessibility();
      targets = [createUnlockStory(), createWhyStory(), ...createParallaxTargets()].filter(Boolean);
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
    window.addEventListener("resize", rebuildStories, { passive: true });
    desktopStory.addEventListener?.("change", rebuildStories);
    reducedMotion.addEventListener?.("change", () => window.location.reload());
    scheduleUpdate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMotion, { once: true });
  } else {
    initMotion();
  }
})();
