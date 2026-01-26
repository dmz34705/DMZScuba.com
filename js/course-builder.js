(() => {
  const form = document.getElementById("courseBuilderForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const fields = [];

    formData.forEach((value, key) => {
      const cleanValue = String(value || "").trim();
      if (!cleanValue) return;
      fields.push(`${key}: ${cleanValue}`);
    });

    const subject = "Course Builder Request";
    const body = fields.join("\n");
    const to = "info@dmzscuba.com";
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const gmailCompose =
      `https://mail.google.com/mail/?view=cm&fs=1` +
      `&to=${encodeURIComponent(to)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    let blurred = false;
    window.addEventListener("blur", () => { blurred = true; }, { once: true });

    try {
      window.location.assign(mailto);
    } catch (_) {}

    window.setTimeout(() => {
      if (!blurred && document.visibilityState === "visible") {
        window.open(gmailCompose, "_blank", "noopener,noreferrer");
      }
    }, 900);
  });
})();
