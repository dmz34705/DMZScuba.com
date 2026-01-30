(() => {
  const form = document.getElementById("courseBuilderForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (window.DMZForms && typeof window.DMZForms.submit === "function") {
      const thanksUrl = `${window.location.origin}/pages/thanks/index.html`;
      window.DMZForms.submit(form, { requireEmail: true, redirectUrl: thanksUrl });
      return;
    }
    if (!form.reportValidity()) return;
  });
})();
