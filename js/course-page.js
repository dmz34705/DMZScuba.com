(() => {
  const root = document.body;
  if (!root.classList.contains("course-page")) return;

  const items = [...document.querySelectorAll("[data-course-reveal]")];
  if (!items.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  root.classList.add("course-motion-ready");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -7% 0px" });

  items.forEach((item) => observer.observe(item));
})();
