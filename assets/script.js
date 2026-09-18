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

const regForm = document.getElementById('reg-form');
if (regForm) {
  regForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = regForm.nombre.value.trim();
    const celular = regForm.celular.value.trim();
    const correo = regForm.correo.value.trim();
    const planInput = regForm.querySelector('input[name="plan"]:checked');
    const plan = planInput ? planInput.dataset.label : 'Sin especificar';
    const lineas = [
      'Hola, quiero registrarme en Nuvo.',
      `Nombre: ${nombre}`,
      `Plan de interés: ${plan}`,
      `Celular: ${celular}`,
      `Correo: ${correo}`,
    ];
    const texto = encodeURIComponent(lineas.join('\n'));
    window.location.href = `https://wa.me/593996879595?text=${texto}`;
  });
}
