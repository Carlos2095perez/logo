document.getElementById('year').textContent = new Date().getFullYear();

const mobileMenu = document.querySelector('.mobile-menu');
if (mobileMenu) {
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => { mobileMenu.open = false; });
  });
  document.addEventListener('click', (e) => {
    if (mobileMenu.open && !mobileMenu.contains(e.target)) {
      mobileMenu.open = false;
    }
  });
}
