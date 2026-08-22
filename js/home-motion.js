(() => {
  if (!document.body.classList.contains("home-page")) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initReveal() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
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
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    items.forEach((el) => observer.observe(el));

    // Safety net: never leave content invisible if IO misfires on a slow-loading layout.
    window.setTimeout(() => {
      items.forEach((el) => el.classList.add("is-visible"));
    }, 2500);
  }

  function initStack() {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) return;
    const frames = [...document.querySelectorAll(".stack-frame")];
    if (frames.length < 2) return;

    for (let i = 1; i < frames.length; i += 1) {
      const prevSection = frames[i - 1].querySelector(":scope > section");
      if (!prevSection) continue;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            prevSection.classList.toggle("is-covered", entry.isIntersecting);
          });
        },
        { threshold: 0, rootMargin: "0px 0px -70% 0px" }
      );
      observer.observe(frames[i]);
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function initParallax() {
    if (prefersReducedMotion) return;

    const targets = [];

    const hero = document.querySelector(".hero");
    const heroBg = document.querySelector(".hero-bg");
    const heroCopy = document.querySelector(".hero-copy");
    if (hero && heroBg) {
      targets.push({
        el: hero,
        active: false,
        update() {
          const rect = hero.getBoundingClientRect();
          const progress = clamp(-rect.top / rect.height, 0, 1);
          heroBg.style.setProperty("--px", `${(progress * 46).toFixed(2)}px`);
          heroBg.style.setProperty("--s", `${(1.015 + progress * 0.05).toFixed(4)}`);
          if (heroCopy) {
            heroCopy.style.setProperty("--px", `${(progress * -40).toFixed(2)}px`);
            heroCopy.style.setProperty("--fade", `${clamp(1 - progress * 1.3, 0, 1).toFixed(3)}`);
          }
        },
      });
    }

    const finalCta = document.querySelector(".final-cta");
    const finalCtaBg = document.querySelector(".final-cta-bg");
    if (finalCta && finalCtaBg) {
      targets.push({
        el: finalCta,
        active: false,
        update() {
          const rect = finalCta.getBoundingClientRect();
          const vh = window.innerHeight || document.documentElement.clientHeight;
          const progress = clamp((vh - rect.top) / (vh + rect.height), 0, 1);
          finalCtaBg.style.setProperty("--px", `${(progress * 50 - 25).toFixed(2)}px`);
          finalCtaBg.style.setProperty("--s", `${(1 + progress * 0.04).toFixed(4)}`);
        },
      });
    }

    if (!targets.length) return;

    let frameRequested = false;
    function scheduleFrame() {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(frame);
    }
    function frame() {
      frameRequested = false;
      let anyActive = false;
      targets.forEach((target) => {
        if (!target.active) return;
        anyActive = true;
        target.update();
      });
      if (anyActive) scheduleFrame();
    }

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const target = targets.find((t) => t.el === entry.target);
            if (target) target.active = entry.isIntersecting;
          });
          scheduleFrame();
        },
        { threshold: 0 }
      );
      targets.forEach((target) => observer.observe(target.el));
    } else {
      targets.forEach((target) => {
        target.active = true;
      });
    }

    window.addEventListener("scroll", scheduleFrame, { passive: true });
    window.addEventListener("resize", scheduleFrame);
    scheduleFrame();
  }

  function init() {
    initReveal();
    initStack();
    initParallax();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
