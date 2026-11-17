/* Admin dashboard progressive enhancement; core admin operations remain on the existing server routes. */
(function () {
  'use strict';
  document.querySelectorAll('.admin-upgraded form').forEach(function (form) {
    form.addEventListener('submit', function () {
      const submit = form.querySelector('button[type="submit"],button:not([type])');
      if (submit && !form.dataset.confirmedSubmit) {
        submit.dataset.originalText = submit.textContent;
        submit.disabled = true;
        submit.textContent = 'Saving…';
      }
    });
  });
  document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
    if (!link.rel || !link.rel.includes('noopener')) link.rel = 'noopener noreferrer';
  });
  const addForm = document.querySelector('form[action$="/products/add"]');
  const editForm = document.getElementById('editProductForm');
  [addForm, editForm].filter(Boolean).forEach(function (form) {
    form.querySelectorAll('input[type="number"]').forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.value !== '' && Number(input.value) < 0) input.setCustomValidity('Value cannot be negative.');
        else input.setCustomValidity('');
      });
    });
  });
  document.querySelectorAll('input[type="file"][accept*="image"]').forEach(function (input) {
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { input.setCustomValidity('Please choose an image file.'); input.reportValidity(); return; }
      if (file.size > 5 * 1024 * 1024) { input.setCustomValidity('Image must be 5 MB or smaller.'); input.reportValidity(); return; }
      input.setCustomValidity('');
      let preview = input.parentElement.querySelector('.admin-image-preview');
      if (!preview) { preview = document.createElement('img'); preview.className = 'admin-image-preview'; preview.alt = 'Selected image preview'; input.parentElement.appendChild(preview); }
      preview.src = URL.createObjectURL(file);
    });
  });
})();
