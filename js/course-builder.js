(() => {
  const form = document.getElementById("courseBuilderForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (window.DMZForms && typeof window.DMZForms.submit === "function") {
      window.DMZForms.submit(form, { requireEmail: true });
      return;
    }
    if (!form.reportValidity()) return;
  });
})();
