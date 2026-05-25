// ============================================================
// CONFIGURACIÓN — Pega aquí la URL de tu Apps Script
// (La obtienes al hacer Deploy > Web App en Google Apps Script)
// ============================================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzotS5zM6hXZpL_UV1VVFfQlZdU0IJkaBZB-yP2BeiP1wn_jhSA-tY6zNZJXaJPAkkZ/exec';

// ============================================================
// BUSCAR — Se ejecuta al hacer clic en el botón o presionar Enter
// ============================================================
async function buscar() {
    const input  = document.getElementById('input-correo');
    const correo = input.value.trim().toLowerCase();

    // Validación básica del correo
    if (!correo) {
        input.focus();
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
        return;
    }

    if (!correo.includes('@')) {
        mostrarError('Por favor ingresa un correo válido.');
        return;
    }

    setBuscando(true);
    ocultarEstados();

    try {
        const url = `${APPS_SCRIPT_URL}?email=${encodeURIComponent(correo)}`;
        const res  = await fetch(url);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const datos = await res.json();

        if (datos.error) {
            mostrarError(datos.error);
            return;
        }

        renderizarCodigos(datos.codigos || [], correo);

    } catch (err) {
        console.error('Error:', err);
        mostrarError('No se pudo conectar. Verifica tu conexión e intenta de nuevo.');
    } finally {
        setBuscando(false);
    }
}

// ============================================================
// RENDERIZAR TARJETAS DE CÓDIGOS
// ============================================================
function renderizarCodigos(codigos, correo) {
    const grid = document.getElementById('grid-codigos');
    grid.innerHTML = '';

    // Scroll suave a resultados
    document.getElementById('zona-resultados').scrollIntoView({ behavior: 'smooth' });

    if (codigos.length === 0) {
        mostrarVacio();
        return;
    }

    // Encabezado de resultados
    const encabezado = document.createElement('div');
    encabezado.className = 'resultados-encabezado';
    encabezado.innerHTML = `
        <h2 class="resultados-titulo">
            Códigos para <span class="correo-highlight">${correo}</span>
        </h2>
        <span class="resultados-count">${codigos.length} código${codigos.length > 1 ? 's' : ''} encontrado${codigos.length > 1 ? 's' : ''}</span>
    `;
    grid.appendChild(encabezado);

    // Tarjetas
    const tarjetasWrap = document.createElement('div');
    tarjetasWrap.className = 'tarjetas-wrap';

    codigos.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = 'codigo-card';
        card.style.animationDelay = `${i * 80}ms`;

        let accionHTML = '';

        if (item.codigo) {
            accionHTML += `
                <div class="codigo-box">
                    <div class="codigo-label">Tu código</div>
                    <span class="codigo-texto">${item.codigo}</span>
                    <button class="btn-copiar" onclick="copiarCodigo(this, '${item.codigo}')">
                        <span class="copiar-icono">📋</span> Copiar
                    </button>
                </div>`;
        }

        if (item.enlace) {
            accionHTML += `
                <a href="${item.enlace}" target="_blank" rel="noopener" class="btn-obtener">
                    ▶ Obtener código en Netflix
                </a>`;
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="plat-badge netflix">Netflix</span>
                <span class="card-fecha">🕐 ${item.fechaTexto}</span>
            </div>
            <div class="card-body">
                <p class="card-asunto">${item.asunto}</p>
                ${accionHTML}
            </div>`;

        tarjetasWrap.appendChild(card);
    });

    grid.appendChild(tarjetasWrap);
    grid.classList.remove('oculto');
}

// ============================================================
// COPIAR CÓDIGO AL PORTAPAPELES
// ============================================================
function copiarCodigo(btn, codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
        btn.innerHTML = '<span class="copiar-icono">✔</span> Copiado';
        btn.classList.add('copiado');
        setTimeout(() => {
            btn.innerHTML = '<span class="copiar-icono">📋</span> Copiar';
            btn.classList.remove('copiado');
        }, 2500);
    }).catch(() => {
        // Fallback para navegadores que no soportan clipboard API
        const el = document.createElement('textarea');
        el.value = codigo;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        btn.innerHTML = '✔ Copiado';
        btn.classList.add('copiado');
        setTimeout(() => {
            btn.innerHTML = '<span class="copiar-icono">📋</span> Copiar';
            btn.classList.remove('copiado');
        }, 2500);
    });
}

// ============================================================
// LIMPIAR BÚSQUEDA
// ============================================================
function limpiar() {
    const input = document.getElementById('input-correo');
    input.value = '';
    input.focus();
    ocultarEstados();
    document.getElementById('btn-limpiar').classList.add('oculto');
}

// ============================================================
// HELPERS UI
// ============================================================
function setBuscando(activo) {
    const btn    = document.getElementById('btn-buscar');
    const texto  = document.getElementById('btn-texto');
    const spin   = document.getElementById('btn-spinner');
    const limpiar = document.getElementById('btn-limpiar');
    const input  = document.getElementById('input-correo');

    btn.disabled   = activo;
    input.disabled = activo;
    texto.classList.toggle('oculto', activo);
    spin.classList.toggle('oculto', !activo);

    if (!activo && input.value.trim()) {
        limpiar.classList.remove('oculto');
    }
}

function ocultarEstados() {
    document.getElementById('estado-error').classList.add('oculto');
    document.getElementById('estado-vacio').classList.add('oculto');
    document.getElementById('grid-codigos').classList.add('oculto');
    document.getElementById('grid-codigos').innerHTML = '';
}

function mostrarError(msg) {
    document.getElementById('error-mensaje').textContent = msg;
    document.getElementById('estado-error').classList.remove('oculto');
    document.getElementById('zona-resultados').scrollIntoView({ behavior: 'smooth' });
}

function mostrarVacio() {
    document.getElementById('estado-vacio').classList.remove('oculto');
    document.getElementById('zona-resultados').scrollIntoView({ behavior: 'smooth' });
}

// Mostrar/ocultar botón limpiar mientras se escribe
document.addEventListener('DOMContentLoaded', () => {
    const input   = document.getElementById('input-correo');
    const btnLimp = document.getElementById('btn-limpiar');
    input.addEventListener('input', () => {
        btnLimp.classList.toggle('oculto', !input.value.trim());
    });
});
