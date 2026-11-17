/* Storefront enhancements: shared product filtering/sorting is initialized in the EJS view. */
(function () {
  'use strict';
  document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
    if (!link.rel || !link.rel.includes('noopener')) link.rel = 'noopener noreferrer';
  });
})();
