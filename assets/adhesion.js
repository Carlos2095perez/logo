// Formulario de adhesión: toggle persona natural/jurídica, captura de foto,
// pad de firma digital, y envío al backend (nuvo-validador-transferencias).

(function () {
  const form = document.getElementById('adh-form');
  if (!form) return; // este script solo corre en adhesion.html

  const ENDPOINT = 'https://nuvo-validador-transferencias.vercel.app/api/adhesion/submit';

  // ---------- Toggle persona natural / jurídica ----------
  // El CSS ya oculta/muestra .adh-juridica según el radio seleccionado.
  // Acá solo controlamos el atributo "required" para que los campos
  // ocultos no bloqueen el envío del formulario.
  const radioJuridica = document.getElementById('adh-persona-juridica');
  const radioNatural = document.getElementById('adh-persona-natural');
  const rucInput = document.getElementById('adh-ruc');
  const representanteInput = document.getElementById('adh-representante');
  const camposJuridica = document.querySelector('.adh-juridica');

  function actualizarRequeridosJuridica() {
    const esJuridica = radioJuridica.checked;
    rucInput.required = esJuridica;
    representanteInput.required = esJuridica;
    camposJuridica.classList.toggle('show', esJuridica);
  }
  radioJuridica.addEventListener('change', actualizarRequeridosJuridica);
  radioNatural.addEventListener('change', actualizarRequeridosJuridica);
  actualizarRequeridosJuridica();

  // ---------- Captura de foto ----------
  const video = document.getElementById('adh-video');
  const photoCanvas = document.getElementById('adh-photo-canvas');
  const photoPreview = document.getElementById('adh-photo-preview');
  const btnStartCamera = document.getElementById('adh-btn-start-camera');
  const btnTakePhoto = document.getElementById('adh-btn-take-photo');
  const btnRetakePhoto = document.getElementById('adh-btn-retake-photo');
  const photoStatus = document.getElementById('adh-photo-status');
  const photoFallback = document.getElementById('adh-photo-fallback');
  const photoFileInput = document.getElementById('adh-photo-file');

  let photoDataUrl = null;
  let mediaStream = null;

  function detenerCamara() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
  }

  async function activarCamara() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      mostrarFallbackFoto('Tu navegador no soporta cámara en vivo.');
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = mediaStream;
      video.style.display = 'block';
      btnStartCamera.style.display = 'none';
      btnTakePhoto.style.display = 'inline-flex';
      photoStatus.textContent = 'Cámara activa. Encuadra tu rostro y presiona "Capturar foto".';
    } catch (err) {
      mostrarFallbackFoto('No pudimos acceder a tu cámara (revisa los permisos del navegador).');
    }
  }

  function mostrarFallbackFoto(mensaje) {
    photoStatus.textContent = mensaje;
    photoFallback.style.display = 'block';
    btnStartCamera.style.display = 'none';
  }

  function capturarFoto() {
    const size = Math.min(video.videoWidth, video.videoHeight) || 480;
    photoCanvas.width = size;
    photoCanvas.height = size;
    const ctx = photoCanvas.getContext('2d');
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    photoDataUrl = photoCanvas.toDataURL('image/jpeg', 0.9);

    photoPreview.src = photoDataUrl;
    photoPreview.style.display = 'block';
    video.style.display = 'none';
    btnTakePhoto.style.display = 'none';
    btnRetakePhoto.style.display = 'inline-flex';
    photoStatus.textContent = 'Foto capturada correctamente.';
    photoStatus.classList.add('ok');
    detenerCamara();
  }

  function repetirFoto() {
    photoDataUrl = null;
    photoPreview.style.display = 'none';
    btnRetakePhoto.style.display = 'none';
    photoStatus.classList.remove('ok');
    activarCamara();
  }

  btnStartCamera.addEventListener('click', activarCamara);
  btnTakePhoto.addEventListener('click', capturarFoto);
  btnRetakePhoto.addEventListener('click', repetirFoto);

  photoFileInput.addEventListener('change', () => {
    const file = photoFileInput.files && photoFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      photoDataUrl = reader.result;
      photoPreview.src = photoDataUrl;
      photoPreview.style.display = 'block';
      photoStatus.textContent = 'Foto cargada correctamente.';
      photoStatus.classList.add('ok');
    };
    reader.readAsDataURL(file);
  });

  // ---------- Pad de firma digital ----------
  const sigCanvas = document.getElementById('adh-sigpad');
  const sigCtx = sigCanvas.getContext('2d');
  const sigStatus = document.getElementById('adh-sig-status');
  const btnClearSig = document.getElementById('adh-btn-clear-sig');
  let dibujando = false;
  let firmaVacia = true;

  function ajustarTamanoCanvas() {
    const rect = sigCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const contenidoPrevio = firmaVacia ? null : sigCanvas.toDataURL();
    sigCanvas.width = rect.width * ratio;
    sigCanvas.height = rect.height * ratio;
    sigCtx.scale(ratio, ratio);
    sigCtx.lineWidth = 2.4;
    sigCtx.lineCap = 'round';
    sigCtx.strokeStyle = '#0A163D';
    if (contenidoPrevio) {
      const img = new Image();
      img.onload = () => sigCtx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = contenidoPrevio;
    }
  }
  window.addEventListener('resize', ajustarTamanoCanvas);
  ajustarTamanoCanvas();

  function posicionDesdeEvento(e) {
    const rect = sigCanvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function empezarTrazo(e) {
    e.preventDefault();
    dibujando = true;
    firmaVacia = false;
    sigStatus.textContent = 'Firma capturada';
    const { x, y } = posicionDesdeEvento(e);
    sigCtx.beginPath();
    sigCtx.moveTo(x, y);
  }
  function continuarTrazo(e) {
    if (!dibujando) return;
    e.preventDefault();
    const { x, y } = posicionDesdeEvento(e);
    sigCtx.lineTo(x, y);
    sigCtx.stroke();
  }
  function terminarTrazo() {
    dibujando = false;
  }

  sigCanvas.addEventListener('mousedown', empezarTrazo);
  sigCanvas.addEventListener('mousemove', continuarTrazo);
  window.addEventListener('mouseup', terminarTrazo);
  sigCanvas.addEventListener('touchstart', empezarTrazo, { passive: false });
  sigCanvas.addEventListener('touchmove', continuarTrazo, { passive: false });
  sigCanvas.addEventListener('touchend', terminarTrazo);

  btnClearSig.addEventListener('click', () => {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    firmaVacia = true;
    sigStatus.textContent = 'Firma vacía';
  });

  // ---------- Envío del formulario ----------
  const statusBox = document.getElementById('adh-status');
  const submitBtn = document.getElementById('adh-submit-btn');

  function mostrarEstado(tipo, mensaje) {
    statusBox.className = 'adh-status show ' + tipo;
    statusBox.textContent = mensaje;
    statusBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!photoDataUrl) {
      mostrarEstado('err', 'Falta tu foto: actívala cámara o sube una imagen antes de continuar.');
      return;
    }
    if (firmaVacia) {
      mostrarEstado('err', 'Falta tu firma: dibújala en el recuadro antes de continuar.');
      return;
    }

    const datos = {
      nombres: form.nombres.value.trim(),
      cedula: form.cedula.value.trim(),
      tipoPersona: form.tipoPersona.value,
      ruc: rucInput.value.trim(),
      representanteLegal: representanteInput.value.trim(),
      tipoCuenta: form.tipoCuenta.value,
      numeroCuenta: form.numeroCuenta.value.trim(),
      correo: form.correo.value.trim(),
      telefono: form.telefono.value.trim(),
      direccion: form.direccion.value.trim(),
      fotoBase64: photoDataUrl,
      firmaBase64: sigCanvas.toDataURL('image/png'),
      aceptaTerminos: document.getElementById('adh-accept-terms').checked,
      aceptaPolitica: document.getElementById('adh-accept-privacy').checked,
      aceptaContrato: document.getElementById('adh-accept-contract').checked,
      metadata: {
        userAgent: navigator.userAgent,
        idioma: navigator.language,
        zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
        pantalla: screen.width + 'x' + screen.height,
        enviadoEn: new Date().toISOString(),
      },
    };

    submitBtn.disabled = true;
    mostrarEstado('loading', 'Enviando tu información, no cierres esta página…');

    try {
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const resultado = await resp.json().catch(() => ({}));
      if (!resp.ok || !resultado.ok) {
        throw new Error(resultado.error || 'No se pudo completar el envío.');
      }
      mostrarEstado('ok', '¡Listo! Tu adhesión fue recibida. Te contactaremos pronto por WhatsApp.');
      form.reset();
      submitBtn.style.display = 'none';
    } catch (err) {
      mostrarEstado('err', 'Hubo un problema al enviar tu formulario. Intenta de nuevo o escríbenos por WhatsApp: ' + err.message);
      submitBtn.disabled = false;
    }
  });
})();
