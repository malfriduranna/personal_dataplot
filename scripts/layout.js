// START OF FILE scripts/layout.js
function loadComponent(url, placeholderId) {
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} loading ${url}`);
        }
        return response.text();
      })
      .then(data => {
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
          placeholder.innerHTML = data;
          // Optional: Dispatch a custom event if other scripts need to know when loaded
          // placeholder.dispatchEvent(new CustomEvent('componentLoaded', { bubbles: true }));
        } else {
          console.warn(`Placeholder element with ID '${placeholderId}' not found on this page.`);
        }
      })
      .catch(error => console.error(`Error loading component ${url}:`, error));
  }

// Load header and footer when the basic DOM structure is ready
document.addEventListener('DOMContentLoaded', () => {
     loadComponent('header.html', 'header-placeholder');
     loadComponent('footer.html', 'footer-placeholder');
});
// END OF FILE scripts/layout.js