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
    const heroBg = hero?.querySelector(".hero-bg");
    const heroCopy = hero?.querySelector(".hero-copy");

    if (hero && heroBg) {
      targets.push({
        root: hero,
        update() {
          const rect = hero.getBoundingClientRect();
          const progress = clamp(-rect.top / Math.max(rect.height, 1));
          heroBg.style.setProperty("--px", `${(progress * 52).toFixed(2)}px`);
          setNumber(heroBg, "--s", 1.015 + progress * 0.055);
          if (heroCopy) {
            heroCopy.style.setProperty("--px", `${(progress * -34).toFixed(2)}px`);
            setNumber(heroCopy, "--fade", clamp(1 - progress * 1.35));
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

    const update = () => {
      frameRequested = false;
      targets.forEach((target) => target.update());
    };

    const scheduleUpdate = () => {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(update);
    };

    const rebuildStories = () => {
      resetStoryAccessibility();
      targets = [createUnlockStory(), createWhyStory(), ...createParallaxTargets()].filter(Boolean);
      scheduleUpdate();
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
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
