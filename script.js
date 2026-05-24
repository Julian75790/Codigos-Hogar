// ================================================
// CONFIGURACIÓN — Reemplaza con tu Client ID
// ================================================
const CLIENT_ID = '956724651079-44e90vpseqdlleg3u0o6kl0rp3knr13n.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

const PLATAFORMAS = {
    netflix: {
        nombre: 'Netflix',
        dominios: ['netflix.com', 'account.netflix.com'],
        clase: 'netflix',
        filtro: 'netflix'
    }
};

let tokenAcceso = null;
let todosLosCodigos = [];

// ================================================
// INICIAR SESIÓN
// ================================================
function iniciarSesion() {
    const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (respuesta) => {
            if (respuesta.error) { alert('Error al iniciar sesión: ' + respuesta.error); return; }
            tokenAcceso = respuesta.access_token;
            await cargarPerfil();
            mostrarApp();
            await buscarCodigos();
        }
    });
    client.requestAccessToken();
}

// ================================================
// PERFIL
// ================================================
async function cargarPerfil() {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenAcceso}` }
    });
    const datos = await res.json();
    document.getElementById('user-nombre').textContent = datos.name || datos.email;
    if (datos.picture) document.getElementById('user-foto').src = datos.picture;
}

// ================================================
// MOSTRAR APP
// ================================================
function mostrarApp() {
    document.getElementById('pantalla-login').classList.add('oculto');
    document.getElementById('pantalla-app').classList.remove('oculto');
}

// ================================================
// CERRAR SESIÓN
// ================================================
function cerrarSesion() {
    google.accounts.oauth2.revoke(tokenAcceso, () => {
        tokenAcceso = null;
        todosLosCodigos = [];
        document.getElementById('pantalla-app').classList.add('oculto');
        document.getElementById('pantalla-login').classList.remove('oculto');
        document.getElementById('grid-codigos').innerHTML = '';
    });
}

// ================================================
// BUSCAR CORREOS DE NETFLIX — Solo código de acceso temporal
// ================================================
async function buscarCodigos() {
    mostrarCarga(true);
    todosLosCodigos = [];

    const query = 'from:info@account.netflix.com subject:"código de acceso temporal" newer_than:30d';

    try {
        const ids = await obtenerIdsCorreos(query, 20);
        for (const id of ids) {
            const correo = await obtenerCorreo(id);
            if (correo) todosLosCodigos.push(correo);
        }
        todosLosCodigos.sort((a, b) => b.fecha - a.fecha);
        mostrarCarga(false);
        renderizarCodigos(todosLosCodigos);
    } catch (err) {
        console.error('Error:', err);
        mostrarCarga(false);
        mostrarVacio(true);
    }
}

// ================================================
// OBTENER IDs
// ================================================
async function obtenerIdsCorreos(query, max = 20) {
    const url = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tokenAcceso}` } });
    const datos = await res.json();
    return (datos.messages || []).map(m => m.id);
}

// ================================================
// OBTENER UN CORREO — Solo "código de acceso temporal"
// ================================================
async function obtenerCorreo(id) {
    const url = `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tokenAcceso}` } });
    const datos = await res.json();

    const headers    = datos.payload?.headers || [];
    const asunto     = headers.find(h => h.name === 'Subject')?.value || '';
    const de         = headers.find(h => h.name === 'From')?.value || '';
    const fechaMs    = parseInt(datos.internalDate);
    const plataforma = detectarPlataforma(de);

    if (!plataforma) return null;

    // Filtro estricto — solo correos de código de acceso temporal
    const asuntoLower = asunto.toLowerCase();
    if (!asuntoLower.includes('código de acceso temporal') &&
        !asuntoLower.includes('codigo de acceso temporal')) {
        return null;
    }

    const cuerpoHTML  = extraerCuerpoHTML(datos.payload);
    const cuerpoTexto = extraerCuerpo(datos.payload);
    const enlace      = extraerEnlaceNetflix(cuerpoHTML);
    const codigo      = extraerCodigo(cuerpoTexto, asunto);

    if (!enlace && !codigo) return null;

    return {
        id,
        asunto,
        de,
        plataforma,
        codigo: codigo || null,
        enlace: enlace || null,
        fecha: fechaMs,
        fechaTexto: formatearFecha(fechaMs)
    };
}

// ================================================
// DETECTAR PLATAFORMA
// ================================================
function detectarPlataforma(remitente) {
    const rem = remitente.toLowerCase();
    for (const [clave, datos] of Object.entries(PLATAFORMAS)) {
        if (datos.dominios.some(d => rem.includes(d))) return { clave, ...datos };
    }
    if (rem.includes('netflix')) return PLATAFORMAS.netflix;
    return null;
}

// ================================================
// EXTRAER CUERPO HTML
// ================================================
function extraerCuerpoHTML(payload) {
    let html = '';
    function recorrer(parte) {
        if (parte.mimeType === 'text/html' && parte.body?.data) {
            html += atob(parte.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (parte.parts) parte.parts.forEach(recorrer);
    }
    recorrer(payload);
    return html;
}

// ================================================
// EXTRAER CUERPO TEXTO PLANO
// ================================================
function extraerCuerpo(payload) {
    let texto = '';
    function recorrer(parte) {
        if (parte.body?.data) {
            texto += atob(parte.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (parte.parts) parte.parts.forEach(recorrer);
    }
    recorrer(payload);
    return texto;
}

// ================================================
// EXTRAER ENLACE DE NETFLIX
// ================================================
function extraerEnlaceNetflix(html) {
    if (!html) return null;
    const patrones = [
        /href="(https:\/\/www\.netflix\.com\/account\/travel\/verify[^"]+)"/i,
        /href="(https:\/\/www\.netflix\.com\/[^"]*temporar[^"]+)"/i,
        /href="(https:\/\/www\.netflix\.com\/[^"]*code[^"]+)"/i,
        /href="(https:\/\/www\.netflix\.com\/[^"]*acceso[^"]+)"/i,
        /href="(https:\/\/www\.netflix\.com\/[^"]{20,})"/i
    ];
    for (const patron of patrones) {
        const match = html.match(patron);
        if (match) return match[1];
    }
    return null;
}

// ================================================
// EXTRAER CÓDIGO NUMÉRICO
// ================================================
function extraerCodigo(cuerpo, asunto) {
    const texto = (cuerpo + ' ' + asunto).replace(/<[^>]+>/g, ' ');
    const patrones = [
        /\b(\d{4,8})\b(?=\s*(?:es tu|is your|código|code|PIN|de verificación|de acceso|temporal))/i,
        /(?:código|code|PIN|clave|acceso temporal)[:\s]+([A-Z0-9]{4,10})/i,
        /\b([A-Z0-9]{4,8}-[A-Z0-9]{4,8})\b/,
        /\b(\d{6,8})\b/
    ];
    for (const patron of patrones) {
        const match = texto.match(patron);
        if (match) return match[1].toUpperCase();
    }
    return null;
}

// ================================================
// FORMATEAR FECHA
// ================================================
function formatearFecha(ms) {
    return new Date(ms).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// ================================================
// FILTRAR
// ================================================
function filtrar(plataforma, btn) {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
    const filtrados = plataforma === 'todos'
        ? todosLosCodigos
        : todosLosCodigos.filter(c => c.plataforma.filtro === plataforma);
    renderizarCodigos(filtrados);
}

// ================================================
// RENDERIZAR TARJETAS
// ================================================
function renderizarCodigos(codigos) {
    const grid = document.getElementById('grid-codigos');
    grid.innerHTML = '';

    if (codigos.length === 0) { mostrarVacio(true); return; }
    mostrarVacio(false);
    grid.classList.remove('oculto');

    codigos.forEach(item => {
        const card = document.createElement('div');
        card.className = 'codigo-card';

        let accionHTML = '';
        if (item.codigo) {
            accionHTML += `
                <div class="codigo-box">
                    <span class="codigo-texto">${item.codigo}</span>
                    <button class="btn-copiar" onclick="copiarCodigo(this, '${item.codigo}')">Copiar</button>
                </div>`;
        }
        if (item.enlace) {
            accionHTML += `
                <a href="${item.enlace}" target="_blank" class="btn-obtener">
                    ▶ Obtener código en Netflix
                </a>`;
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="card-plataforma plat-badge ${item.plataforma.clase}">${item.plataforma.nombre}</span>
                <span class="card-fecha">${item.fechaTexto}</span>
            </div>
            <div class="card-body">
                <p class="card-asunto">${item.asunto}</p>
                ${accionHTML}
            </div>`;
        grid.appendChild(card);
    });
}

// ================================================
// COPIAR CÓDIGO
// ================================================
function copiarCodigo(btn, codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
        btn.textContent = '✔ Copiado';
        btn.classList.add('copiado');
        setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copiado'); }, 2000);
    });
}

// ================================================
// HELPERS UI
// ================================================
function mostrarCarga(visible) {
    document.getElementById('estado-carga').classList.toggle('oculto', !visible);
    document.getElementById('grid-codigos').classList.toggle('oculto', visible);
    document.getElementById('estado-vacio').classList.add('oculto');
}

function mostrarVacio(visible) {
    document.getElementById('estado-vacio').classList.toggle('oculto', !visible);
    document.getElementById('grid-codigos').classList.toggle('oculto', visible);
}