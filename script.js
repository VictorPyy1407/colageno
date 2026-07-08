const CONFIG = {
  productName: 'Colágeno + Ácido Hialurónico GECAPS',
  productPrice: 129000,
  combos: {
    1: { quantity: 1, price: 129000, label: '1 pote' },
    2: { quantity: 2, price: 200000, label: 'Combo 2 potes' },
  },
  currency: 'PYG',
  origin: 'landing_colageno_gecaps',
  supabaseUrl: 'https://roruinqorwgolcrhhmpm.supabase.co',
  supabaseAnonKey: 'sb_publishable_aRPb1yNunMEheat00BxwtQ_Uft732KJ',
  supabaseTable: 'pedidos_web',
  whatsapp: '595972738779',
};

const productPage = document.querySelector('#product-page');
const checkoutPage = document.querySelector('#checkout-page');
const orderForm = document.querySelector('#order-form');
const confirmation = document.querySelector('#confirmation');
const orderNumber = document.querySelector('#order-number');
const confirmationWhatsapp = document.querySelector('#confirmation-whatsapp');
const mapInput = document.querySelector('#map-input');
const mapStatus = document.querySelector('#map-status');
const mapButton = document.querySelector('#map-button');
const checkoutTotal = document.querySelector('#checkout-total');
const confirmationTotal = document.querySelector('#confirmation-total');

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function formatPrice(value) {
  return new Intl.NumberFormat('es-PY').format(value);
}

function generateOrderNumber() {
  return 'COL-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function showCheckout() {
  productPage.hidden = true;
  checkoutPage.hidden = false;
  document.body.classList.add('checkout-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => orderForm.querySelector('input[name="name"]')?.focus(), 280);
  trackEvent('begin_checkout');
}

function getSelectedCombo() {
  const selected = orderForm?.querySelector('input[name="combo"]:checked');
  const key = selected?.value || '1';
  return CONFIG.combos[key] || CONFIG.combos[1];
}

function selectCombo(comboKey) {
  const input = orderForm?.querySelector(`input[name="combo"][value="${comboKey}"]`);
  if (!input) return;
  input.checked = true;
  updateCheckoutTotal();
}

function selectFlavor(flavor) {
  const input = orderForm?.querySelector(`input[name="flavor"][value="${flavor}"]`);
  if (input) input.checked = true;
}

function updateCheckoutTotal() {
  const combo = getSelectedCombo();
  if (checkoutTotal) checkoutTotal.textContent = `Gs. ${formatPrice(combo.price)}`;
}

function showProduct() {
  checkoutPage.hidden = true;
  productPage.hidden = false;
  document.body.classList.remove('checkout-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function whatsappUrl(message) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(message)}`;
}

function trackEvent(eventName, payload = {}) {
  const data = {
    producto: CONFIG.productName,
    precio: CONFIG.productPrice,
    moneda: CONFIG.currency,
    origen: CONFIG.origin,
    url: window.location.href,
    ...payload,
  };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...data });
  if (typeof window.gtag === 'function') window.gtag('event', eventName, data);
}

async function saveOrderToSupabase(order) {
  const response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${CONFIG.supabaseTable}`, {
    method: 'POST',
    headers: {
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Error guardando pedido en Supabase.');
  }
}

function saveLocalBackup(order) {
  const orders = JSON.parse(localStorage.getItem('colagenoOrders') || '[]');
  orders.push(order);
  localStorage.setItem('colagenoOrders', JSON.stringify(orders));
}

function getLocation() {
  if (!navigator.geolocation) {
    mapStatus.textContent = 'Tu navegador no permite ubicación automática. Podés enviar el pedido igual.';
    return;
  }

  mapButton.disabled = true;
  mapButton.textContent = 'Obteniendo ubicación...';
  mapStatus.textContent = 'Aceptá el permiso para guardar tu ubicación de entrega.';

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    mapInput.value = `https://www.google.com/maps?q=${latitude},${longitude}`;
    mapButton.textContent = '📍 Ubicación guardada';
    mapStatus.textContent = 'Listo. Agregamos el enlace de Google Maps a tu pedido.';
    mapButton.disabled = false;
  }, () => {
    mapButton.textContent = '📍 Usar mi ubicación automáticamente';
    mapStatus.textContent = 'No se pudo obtener la ubicación. Podés completar dirección y referencia manualmente.';
    mapButton.disabled = false;
  }, {
    enableHighAccuracy: true,
    timeout: 9000,
    maximumAge: 0,
  });
}

document.querySelectorAll('[data-checkout]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.combo) selectCombo(button.dataset.combo);
    if (button.dataset.flavor) selectFlavor(button.dataset.flavor);
    trackEvent('click_cta', { cta: cleanText(button.textContent), combo: button.dataset.combo || null, sabor: button.dataset.flavor || null });
    showCheckout();
  });
});

document.querySelector('[data-back]')?.addEventListener('click', showProduct);
mapButton?.addEventListener('click', getLocation);
orderForm?.querySelectorAll('input[name="combo"]').forEach((input) => {
  input.addEventListener('change', () => {
    updateCheckoutTotal();
    trackEvent('select_combo', { combo: input.value, precio: getSelectedCombo().price });
  });
});

document.querySelector('[data-close-confirmation]')?.addEventListener('click', () => {
  confirmation.hidden = true;
  showProduct();
});

confirmation?.addEventListener('click', (event) => {
  if (event.target === confirmation) confirmation.hidden = true;
});

orderForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(orderForm);
  const submitButton = orderForm.querySelector('button[type="submit"]');
  const formError = orderForm.querySelector('.form-error');
  const flavor = cleanText(formData.get('flavor'));
  const combo = getSelectedCombo();
  const reference = cleanText(formData.get('reference'));
  const mapUrl = cleanText(formData.get('map'));
  const id = generateOrderNumber();
  const referenceParts = [`Sabor: ${flavor}`, `Oferta: ${combo.label}`, 'Pago contra entrega'];

  if (reference) referenceParts.push(`Referencia: ${reference}`);
  if (mapUrl) referenceParts.push('Ubicación automática adjunta');

  const order = {
    id,
    producto: CONFIG.productName,
    precio: combo.price,
    cantidad: combo.quantity,
    subtotal: combo.price,
    nombre: cleanText(formData.get('name')),
    telefono: cleanText(formData.get('phone')),
    correo: 'No informado',
    ci: 'No informado',
    departamento: 'Paraguay',
    ciudad: cleanText(formData.get('city')),
    direccion: cleanText(formData.get('address')) || 'No informado',
    referencia: referenceParts.join(' | '),
    ubicacion_maps: mapUrl || 'No informado',
    estado: 'Pendiente',
    origen: CONFIG.origin,
    created_at: new Date().toISOString(),
  };

  formError.textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Enviando pedido...';

  try {
    saveLocalBackup(order);
    await saveOrderToSupabase(order);
    trackEvent('generate_lead', { sabor: flavor, combo: combo.label, cantidad: combo.quantity, subtotal: combo.price });
  } catch (error) {
    console.error(error);
    formError.textContent = 'No se pudo guardar el pedido. Revisá tu conexión e intentá nuevamente.';
    submitButton.disabled = false;
    submitButton.textContent = 'FINALIZAR PEDIDO CON PAGO AL RECIBIR';
    return;
  }

  orderForm.reset();
  updateCheckoutTotal();
  mapInput.value = '';
  mapButton.textContent = '📍 Usar mi ubicación automáticamente';
  mapStatus.textContent = 'Opcional. Te pediremos permiso del navegador.';
  submitButton.disabled = false;
  submitButton.textContent = 'FINALIZAR PEDIDO CON PAGO AL RECIBIR';
  orderNumber.textContent = id;
  if (confirmationTotal) confirmationTotal.textContent = `Gs. ${formatPrice(combo.price)}`;
  confirmationWhatsapp.href = whatsappUrl(`Hola, realicé mi pedido de ${CONFIG.productName}. Número: ${id}. Oferta: ${combo.label}. Sabor: ${flavor}. Total: Gs. ${formatPrice(combo.price)}.`);
  confirmation.hidden = false;
});

const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 }) : null;

document.querySelectorAll('.reveal').forEach((element) => {
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add('is-visible');
});

trackEvent('view_item');
updateCheckoutTotal();
