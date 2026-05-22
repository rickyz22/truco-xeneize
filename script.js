let puntosNos = 0; 
let puntosEllos = 0;
let segundos = 0;
let cronometroIntervalo = null; 
let corriendo = false;
let wakeLock = null; 
let limitePuntos = 30;
let nombreNos = localStorage.getItem('nombreNos') || 'NOSOTROS';
let nombreEllos = localStorage.getItem('nombreEllos') || 'ELLOS';
let usuarioInteractuo = false;

// Caché en memoria de preferencias de hardware/sonido para evitar accesos síncronos lentos a localStorage en el hilo principal
let prefVibrar = localStorage.getItem('show-vibrar') !== 'false';
let prefSonido = localStorage.getItem('show-sonido') !== 'false';

let audioContext = null;

function vibrar(ms = 30) { 
    if (!usuarioInteractuo) return; // Evita warnings al restaurar la configuración guardada en el window.onload
    if (prefVibrar && navigator.vibrate) {
        navigator.vibrate(ms);
    }
}

function playBeep(tipo = 'default') {
    if (!prefSonido) return;

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (tipo === 'sumar') {
            // Sonido retro estilo moneda (agudo doble)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.08); // A5
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            osc.start();
            osc.stop(audioContext.currentTime + 0.1);
        } else if (tipo === 'restar') {
            // Sonido hacia abajo graves
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, audioContext.currentTime); // A4
            osc.frequency.exponentialRampToValueAtTime(293.66, audioContext.currentTime + 0.08); // D4
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            osc.start();
            osc.stop(audioContext.currentTime + 0.1);
        } else if (tipo === 'victoria') {
            // Arpegio brillante y alegre
            const notas = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notas.forEach((f, idx) => {
                const oscNode = audioContext.createOscillator();
                const gain = audioContext.createGain();
                oscNode.type = 'triangle';
                oscNode.frequency.setValueAtTime(f, audioContext.currentTime + idx * 0.08);
                gain.gain.setValueAtTime(0.12, audioContext.currentTime + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + idx * 0.08 + 0.25);
                oscNode.connect(gain);
                gain.connect(audioContext.destination);
                oscNode.start(audioContext.currentTime + idx * 0.08);
                oscNode.stop(audioContext.currentTime + idx * 0.08 + 0.25);
            });
        } else {
            // Sonido por defecto
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
            osc.start();
            osc.stop(audioContext.currentTime + 0.08);
        }
    } catch (e) {
        console.error('Error al reproducir beep:', e);
    }
}

async function activarWakeLock() {
    try { 
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch {}
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await activarWakeLock();
    }
});

let timerGuardar = null;
function guardarProgresoInmediato() {
    localStorage.setItem('puntosNos', puntosNos);
    localStorage.setItem('puntosEllos', puntosEllos);
    localStorage.setItem('segundos', segundos);
}
function guardarProgreso() {
    if (timerGuardar) clearTimeout(timerGuardar);
    timerGuardar = setTimeout(guardarProgresoInmediato, 150);
}

// Asegurar que se guarde si el usuario minimiza la app de golpe
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        if (timerGuardar) {
            clearTimeout(timerGuardar);
            guardarProgresoInmediato();
        }
    }
});

function comenzarJuego() {
    vibrar();
    activarWakeLock();

    // Marcar sesion activa (se borra solo si se cierra la app completamente)
    sessionStorage.setItem('enJuego', 'true');
    localStorage.setItem('partidaIniciada', 'true');

    // Si habia una partida guardada, retomarla
    const pGuardados = localStorage.getItem('puntosNos');
    if (pGuardados !== null) {
        puntosNos = parseInt(localStorage.getItem('puntosNos') || 0);
        puntosEllos = parseInt(localStorage.getItem('puntosEllos') || 0);
        segundos = parseInt(localStorage.getItem('segundos') || 0);
        mostrarTiempo();
    }

    detenerAnimacionPelota();
    mostrarPantallaJuego();
}

function sincronizarGridMarcador() {
    const cronoVisible = localStorage.getItem('show-crono') !== 'false';
    const marcador = document.querySelector('.marcador-futbol');
    if (marcador) {
        marcador.style.gridTemplateColumns = cronoVisible ? '1fr 120px 1fr' : '1fr 1fr';
    }
}

function mostrarPantallaJuego() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('contenido-juego').style.display = 'block';
    detenerAnimacionPelota();
    sincronizarGridMarcador();
    actualizarInterfaz();
}

function toggleCronometro() {
    vibrar();

    const icono = document.getElementById('icono-play');
    const btn = document.getElementById('btn-play-pause');

    if (!corriendo) {
        cronometroIntervalo = setInterval(() => { 
            segundos++; 
            mostrarTiempo(); 
            guardarProgreso();
        }, 1000);

        icono.innerText = "pause";
        btn.classList.add('corriendo');
        btn.style.background = ""; 
        btn.style.color = "";
        corriendo = true;

    } else {
        clearInterval(cronometroIntervalo);

        icono.innerText = "play_arrow";
        btn.classList.remove('corriendo');
        btn.style.background = ""; 
        btn.style.color = "";
        corriendo = false;
    }
}

function mostrarTiempo() {
    let min = Math.floor(segundos / 60); 
    let seg = segundos % 60;

    document.getElementById('cronometro').innerText =
        `${min.toString().padStart(2,'0')}:${seg.toString().padStart(2,'0')}`;
}

function resetearCronometro() {
    vibrar();
    clearInterval(cronometroIntervalo);
    cronometroIntervalo = null; 
    segundos = 0; 
    corriendo = false;

    mostrarTiempo();
    guardarProgreso();

    document.getElementById('icono-play').innerText = "play_arrow";

    const btn = document.getElementById('btn-play-pause');
    btn.classList.remove('corriendo');
    btn.style.background = ""; 
    btn.style.color = "";
}

function juegoTerminado() {
    return puntosNos >= limitePuntos || puntosEllos >= limitePuntos;
}

function sumar(equipo) {
    if (juegoTerminado()) return;

    vibrar();
    playBeep('sumar');

    if (equipo === 'nos' && puntosNos < limitePuntos) {
        puntosNos++;
        document.getElementById('num-nos').innerText = puntosNos;
        agregarPalito('palitos-nos', puntosNos);
    }
    if (equipo === 'ellos' && puntosEllos < limitePuntos) {
        puntosEllos++;
        document.getElementById('num-ellos').innerText = puntosEllos;
        agregarPalito('palitos-ellos', puntosEllos);
    }

    if (juegoTerminado()) {
        clearInterval(cronometroIntervalo);
        const ganador = puntosNos >= limitePuntos ? nombreNos : nombreEllos;
        vibrar(200);
        playBeep('victoria');
        guardarEnHistorial(ganador);
        mostrarModal("\u00a1GANARON!", `El equipo de ${ganador} se lleva la gloria.`, false);
    }

    guardarProgreso();
}

function restar(equipo) {
    if (juegoTerminado()) return;

    vibrar();
    playBeep('restar');

    if (equipo === 'nos' && puntosNos > 0) {
        puntosNos--;
        document.getElementById('num-nos').innerText = puntosNos;
        quitarPalito('palitos-nos', puntosNos);
    }
    if (equipo === 'ellos' && puntosEllos > 0) {
        puntosEllos--;
        document.getElementById('num-ellos').innerText = puntosEllos;
        quitarPalito('palitos-ellos', puntosEllos);
    }

    guardarProgreso();
}

function actualizarInterfaz(equipo) {
    if (!equipo || equipo === 'nos') {
        document.getElementById('num-nos').innerText = puntosNos;
        document.getElementById('palitos-nos').innerHTML = dibujarPalitos(puntosNos);
    }
    if (!equipo || equipo === 'ellos') {
        document.getElementById('num-ellos').innerText = puntosEllos;
        document.getElementById('palitos-ellos').innerHTML = dibujarPalitos(puntosEllos);
    }

    if (juegoTerminado()) {
        clearInterval(cronometroIntervalo);

        let ganador = puntosNos >= limitePuntos ? nombreNos : nombreEllos;

        vibrar(200);
        playBeep('victoria');

        guardarEnHistorial(ganador);

        mostrarModal("¡GANARON!", `El equipo de ${ganador} se lleva la gloria.`, false);
    }
}

function mostrarModal(titulo, mensaje, esConfirmacion, accion, labelNo = 'VOLVER', labelSi = 'REINICIAR') {
    const modal = document.getElementById('modal-custom');

    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-mensaje').innerText = mensaje;

    const btnBox = document.getElementById('modal-botones');
    btnBox.innerHTML = '';

    if (esConfirmacion) {
        let btnNo = document.createElement('button');
        btnNo.innerText = labelNo;
        btnNo.className = 'btn-modal-cancelar';
        btnNo.onclick = () => modal.style.display = 'none';

        let btnSi = document.createElement('button');
        btnSi.innerText = labelSi;
        btnSi.className = 'btn-modal-confirmar';
        btnSi.onclick = () => { if(accion) accion(); modal.style.display = 'none'; };

        btnBox.append(btnNo, btnSi);

    } else {
        let btnOk = document.createElement('button');
        btnOk.innerText = '¡VAMOS!';
        btnOk.className = 'btn-modal-confirmar';
        btnOk.onclick = () => { reiniciarTotalmente(); modal.style.display = 'none'; };

        btnBox.append(btnOk);
    }

    modal.style.display = 'flex';
}

function reiniciar() {
    vibrar();
    mostrarModal("¿NUEVA PARTIDA?", "¿Borrar puntos y tiempo?", true, reiniciarTotalmente);
}

function reiniciarTotalmente() {
    puntosNos = 0; 
    puntosEllos = 0;

    localStorage.setItem('partidaIniciada', 'true');
    localStorage.setItem('puntosNos', 0);
    localStorage.setItem('puntosEllos', 0);
    sessionStorage.setItem('enJuego', 'true');

    resetearCronometro();
    actualizarInterfaz();
}

function guardarEnHistorial(ganador) {
    let historial = JSON.parse(localStorage.getItem('historial') || '[]');

    historial.push({
        fecha: new Date().toISOString(),
        ganador,
        puntosNos,
        puntosEllos,
        tiempo: segundos
    });

    if (historial.length > 10) historial.shift();

    localStorage.setItem('historial', JSON.stringify(historial));
}

function mostrarHistorial() {
    const lista = document.getElementById('lista-historial');
    lista.innerHTML = '';

    const historial = JSON.parse(localStorage.getItem('historial') || '[]');

    if (historial.length === 0) {
        lista.innerHTML = '<p>No hay partidas guardadas.</p>';
        return;
    }

    historial.forEach(p => {
        const div = document.createElement('div');
        div.className = 'partida-historial';

        const fecha = new Date(p.fecha).toLocaleString();

        div.innerHTML =
            `<p>${fecha} - Ganó ${p.ganador} (${p.puntosNos}-${p.puntosEllos})</p>`;

        lista.appendChild(div);
    });
}

function reiniciarHistorial() {
    vibrar();
    localStorage.removeItem('historial');
    mostrarHistorial();
}

// Reconstrucción completa (usada en reset/init)
function dibujarPalitos(puntos) {
    let html = '<div class="grupo-15">';

    for (let i = 0; i < puntos; i++) {

        if (i === 15) {
            html += '</div><div class="linea-divisoria"></div><div class="grupo-15">';
        }

        if (i % 5 === 0) html += '<div class="cuadradito">';

        html += `<img src="fosforo.png" class="fosforo p${(i % 5) + 1}">`;

        if (i % 5 === 4 || i === puntos - 1) html += '</div>';
    }

    return html + '</div>';
}

/**
 * Agrega un palito de forma incremental (O(1) DOM ops, sin reconstruir todo).
 * @param {string} id - ID del contenedor
 * @param {number} puntos - Valor NUEVO (ya incrementado)
 */
function agregarPalito(id, puntos) {
    const contenedor = document.getElementById(id);
    const i = puntos - 1; // índice 0-based del palito nuevo
    const img = `<img src="fosforo.png" class="fosforo p${(i % 5) + 1}">`;

    if (i === 0) {
        // Primer palito: inicializar estructura
        contenedor.innerHTML = `<div class="grupo-15"><div class="cuadradito">${img}</div></div>`;
        return;
    }
    if (i === 15) {
        // Palito 16: nuevo bloque con separador
        contenedor.insertAdjacentHTML('beforeend',
            `<div class="linea-divisoria"></div><div class="grupo-15"><div class="cuadradito">${img}</div></div>`);
        return;
    }
    if (i % 5 === 0) {
        // Inicio de nuevo cuadradito en el grupo actual
        contenedor.querySelector('.grupo-15:last-child')
            .insertAdjacentHTML('beforeend', `<div class="cuadradito">${img}</div>`);
        return;
    }
    // Agregar al último cuadradito
    contenedor.querySelector('.grupo-15:last-child .cuadradito:last-child')
        .insertAdjacentHTML('beforeend', img);
}

/**
 * Quita el último palito de forma incremental.
 * @param {string} id - ID del contenedor
 * @param {number} puntos - Valor NUEVO (ya decrementado)
 */
function quitarPalito(id, puntos) {
    const contenedor = document.getElementById(id);
    if (puntos === 0) {
        contenedor.innerHTML = '<div class="grupo-15"></div>';
        return;
    }
    const lastGrupo = contenedor.querySelector('.grupo-15:last-child');
    const lastCuadradito = lastGrupo.querySelector('.cuadradito:last-child');
    const lastImg = lastCuadradito && lastCuadradito.querySelector('.fosforo:last-child');
    if (lastImg) lastImg.remove();

    if (lastCuadradito && lastCuadradito.children.length === 0) lastCuadradito.remove();

    if (lastGrupo.children.length === 0) {
        lastGrupo.remove();
        const divisoria = contenedor.querySelector('.linea-divisoria');
        if (divisoria) divisoria.remove();
    }
}

function abrirConfiguracion() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('contenido-juego').style.display = 'none';
    document.getElementById('pantalla-config').style.display = 'flex';
    detenerAnimacionPelota();
    mostrarHistorial();
}

function cerrarConfig() {
    vibrar();

    document.getElementById('pantalla-config').style.display = 'none';

    if (localStorage.getItem('partidaIniciada')) {
        document.getElementById('contenido-juego').style.display = 'block';
        detenerAnimacionPelota();
    } else {
        document.getElementById('pantalla-inicio').style.display = 'flex';
        iniciarAnimacionPelota();
    }
}

function volverInicio() {
    vibrar();
    // Si hay una partida en curso, pedir confirmación antes de abandonarla
    const hayPartida = puntosNos > 0 || puntosEllos > 0 || segundos > 0;
    if (hayPartida) {
        mostrarModal(
            "\u00bfIR AL MEN\u00da?",
            "La partida se va a guardar y pod\u00e9s retomar cuando vuelvas.",
            true,
            _irAlMenuSinBorrar,
            'CANCELAR',
            'IR AL MEN\u00da'
        );
    } else {
        _irAlMenuSinBorrar();
    }
}

function _irAlMenuSinBorrar() {
    // Solo navega al menú; NO borra la partida guardada
    // El botón "Jugar Ahora" la retomará
    clearInterval(cronometroIntervalo);
    cronometroIntervalo = null;
    corriendo = false;
    guardarProgresoInmediato();

    document.getElementById('contenido-juego').style.display = 'none';
    document.getElementById('pantalla-inicio').style.display = 'flex';
    iniciarAnimacionPelota();
}

function cambiarEstilo(equipo) {
    document.body.className = 'tema-' + equipo;
    localStorage.setItem('equipo', equipo);

    // Resaltar el botón del tema seleccionado en la cuadrícula de configuración
    const botones = document.querySelectorAll('.btn-equipo');
    botones.forEach(btn => {
        btn.classList.toggle('activo-tema', btn.classList.contains(equipo));
    });

    actualizarImagenFlor(equipo);
}

function editarNombre(equipo) {
    vibrar();
    const nombreActual = equipo === 'nos' ? nombreNos : nombreEllos;
    const nuevoNombre = prompt("Ingresa el nombre del equipo:", nombreActual);
    if (nuevoNombre && nuevoNombre.trim() !== "") {
        const nombreLimpio = nuevoNombre.trim().substring(0, 15).toUpperCase();
        if (equipo === 'nos') {
            nombreNos = nombreLimpio;
            localStorage.setItem('nombreNos', nombreNos);
        } else {
            nombreEllos = nombreLimpio;
            localStorage.setItem('nombreEllos', nombreEllos);
        }
        actualizarNombresUI();
        playBeep('sumar');
    }
}

function actualizarNombresUI() {
    const elNos = document.getElementById('name-nos');
    const elEllos = document.getElementById('name-ellos');
    const lblNos = document.getElementById('lbl-nos');
    const lblEllos = document.getElementById('lbl-ellos');

    if (elNos) elNos.innerText = nombreNos;
    if (elEllos) elEllos.innerText = nombreEllos;

    // Scoreboard labels take first 8 characters (evita truncamiento "NOSOT")
    if (lblNos) lblNos.innerText = nombreNos.substring(0, 8);
    if (lblEllos) lblEllos.innerText = nombreEllos.substring(0, 8);
}

function cambiarLimitePuntos(limite, conEfectos = true) {
    if (conEfectos) vibrar();
    limitePuntos = limite;
    localStorage.setItem('limitePuntos', limite);

    const btn15 = document.getElementById('btn-limite-15');
    const btn30 = document.getElementById('btn-limite-30');
    if (btn15 && btn30) {
        btn15.classList.toggle('activa', limite === 15);
        btn30.classList.toggle('activa', limite === 30);
    }

    // Si los puntos actuales superan el nuevo límite, actualizar la interfaz inmediatamente
    if (puntosNos >= limite || puntosEllos >= limite) {
        actualizarInterfaz();
    }
}

function toggleElemento(tipo) {
    const el = document.getElementById(`check-${tipo}`);
    if (!el) return;

    const activo = el.checked;

    if (tipo === 'crono') {
        const contCrono = document.getElementById('cont-crono');
        contCrono.style.display = activo ? 'flex' : 'none';
        // Colapsar/restaurar la columna central del grid para que NOS y ELLOS queden centrados
        const marcador = document.querySelector('.marcador-futbol');
        if (marcador) {
            marcador.style.gridTemplateColumns = activo ? '1fr 120px 1fr' : '1fr 1fr';
        }
    } 
    else if (tipo === 'num') {
        document.getElementById('cont-nos').style.display = activo ? 'flex' : 'none';
        document.getElementById('cont-ellos').style.display = activo ? 'flex' : 'none';
    }
    else if (tipo === 'sonido') {
        document.getElementById('icon-sonido').innerText = activo ? 'volume_up' : 'volume_off';
    }
    else if (tipo === 'flor') {
        const elFlor = document.getElementById('cont-flor');
        if (elFlor) elFlor.style.display = activo ? 'flex' : 'none';
    }

    localStorage.setItem(`show-${tipo}`, activo);
    vibrar();
}

window.onload = () => {
    // Registro de Service Worker para soporte offline PWA (evitar en entorno local de archivo)
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('Service Worker registrado con éxito:', reg.scope);
                
                // Si hay un Service Worker nuevo instalándose, escuchar su activación
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('Nueva versión disponible. Recargando automáticamente...');
                            window.location.reload();
                        }
                    });
                });
            })
            .catch(err => console.error('Error al registrar el Service Worker:', err));
    }

    // Cargar estilo y tema inicial
    const equipo = localStorage.getItem('equipo') || 'boca';
    cambiarEstilo(equipo);
    actualizarNombresUI();

    // Cargar límite de puntos inicial (sin vibración al iniciar)
    const limiteGuardado = localStorage.getItem('limitePuntos');
    if (limiteGuardado) {
        cambiarLimitePuntos(parseInt(limiteGuardado), false);
    } else {
        cambiarLimitePuntos(30, false);
    }
    // Detectar si la app fue cerrada completamente o solo minimizada
    // sessionStorage se borra al cerrar la app, pero persiste al cambiar de pantalla
    const enSesionActiva = sessionStorage.getItem('enJuego');
    const hayPartidaGuardada = localStorage.getItem('partidaIniciada');

    if (enSesionActiva && hayPartidaGuardada) {
        // Volvio desde otra app (cambio de pantalla), restaurar anotador directamente
        puntosNos = parseInt(localStorage.getItem('puntosNos') || 0);
        puntosEllos = parseInt(localStorage.getItem('puntosEllos') || 0);
        segundos = parseInt(localStorage.getItem('segundos') || 0);
        mostrarTiempo();
        mostrarPantallaJuego();
    } else {
        // App cerrada completamente: mostrar menu principal
        // Si habia partida guardada, el boton "Jugar Ahora" la retomara
        iniciarAnimacionPelota();
    }

    // Restaurar preferencias
    ['crono','num','sonido','vibrar','flor'].forEach(tipo => {
        const estado = localStorage.getItem(`show-${tipo}`);

        if (estado !== null) {
            const el = document.getElementById(`check-${tipo}`);

            if (el) {
                el.checked = JSON.parse(estado);

                if (tipo === 'sonido') {
                    document.getElementById('icon-sonido').innerText =
                        el.checked ? 'volume_up' : 'volume_off';
                } else {
                    toggleElemento(tipo);
                }
            }
        }
    });
};

/* --- PELOTA REBOTADORA EN PANTALLA DE INICIO --- */
let animacionPelotaId = null;

function iniciarAnimacionPelota() {
    const pelota = document.getElementById('pelota-rebotadora');
    const container = document.getElementById('pantalla-inicio');
    if (!pelota || !container) return;

    pelota.style.display = 'block';

    let w = window.innerWidth;
    let h = window.innerHeight;
    const size = 65; // perfect visual scale
    pelota.style.width = size + 'px';
    pelota.style.height = size + 'px';

    // Start inside screen boundary
    let x = Math.random() * (w - size - 40) + 20;
    let y = Math.random() * (h - size - 40) + 20;
    
    // Velocities: dynamic 1.5px to 2.7px per frame
    let dx = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.2);
    let dy = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.2);
    
    let rotation = 0;
    const spinSpeed = 1.5;

    function resizeHandler() {
        w = window.innerWidth;
        h = window.innerHeight;
    }
    window.addEventListener('resize', resizeHandler);

    function update() {
        if (container.style.display === 'none') {
            pelota.style.display = 'none';
            animacionPelotaId = null;
            window.removeEventListener('resize', resizeHandler);
            return;
        }

        x += dx;
        y += dy;
        rotation += spinSpeed;

        // Bounce horizontal walls
        if (x <= 0) {
            x = 0;
            dx = -dx;
            vibrarSutilBounce();
        } else if (x + size >= w) {
            x = w - size;
            dx = -dx;
            vibrarSutilBounce();
        }

        // Bounce vertical walls
        if (y <= 0) {
            y = 0;
            dy = -dy;
            vibrarSutilBounce();
        } else if (y + size >= h) {
            y = h - size;
            dy = -dy;
            vibrarSutilBounce();
        }

        pelota.style.left = x + 'px';
        pelota.style.top = y + 'px';
        pelota.style.transform = `rotate(${rotation}deg)`;

        animacionPelotaId = requestAnimationFrame(update);
    }

    if (animacionPelotaId) {
        cancelAnimationFrame(animacionPelotaId);
    }
    animacionPelotaId = requestAnimationFrame(update);
}

function detenerAnimacionPelota() {
    if (animacionPelotaId) {
        cancelAnimationFrame(animacionPelotaId);
        animacionPelotaId = null;
    }
    const pelota = document.getElementById('pelota-rebotadora');
    if (pelota) pelota.style.display = 'none';
}

function vibrarSutilBounce() {
    if (!usuarioInteractuo) return; // Evita warnings de intervención del navegador antes del primer tap
    const vibrarHabilitado = localStorage.getItem('show-vibrar') !== 'false';
    if (vibrarHabilitado && navigator.vibrate) {
        navigator.vibrate(8);
    }
}

// Registrar interacción inicial para habilitar la vibración de rebote
function registrarInteraccionUsuario() {
    usuarioInteractuo = true;
    window.removeEventListener('click', registrarInteraccionUsuario);
    window.removeEventListener('touchstart', registrarInteraccionUsuario);
    window.removeEventListener('mousedown', registrarInteraccionUsuario);
}
window.addEventListener('click', registrarInteraccionUsuario);
window.addEventListener('touchstart', registrarInteraccionUsuario, { passive: true });
window.addEventListener('mousedown', registrarInteraccionUsuario);

function actualizarImagenFlor(tema) {
    const el = document.querySelector('.flor-img');
    if (!el) return;

    if (tema === 'river' || tema === 'independiente') {
        el.src = 'flor-blanca.png';
    } else if (tema === 'boca') {
        el.src = 'flor-boca.png';
    } else {
        el.src = 'flor.png';
    }
}

// --- MÓDULO ÁRBITRO IA (ASART) ---
function abrirArbitro() {
    vibrar();
    document.getElementById('modal-arbitro').style.display = 'flex';
    setTimeout(() => document.getElementById('input-arbitro').focus(), 100);
}

function cerrarArbitro() {
    vibrar();
    document.getElementById('modal-arbitro').style.display = 'none';
}

function manejarEnterArbitro(event) {
    if (event.key === 'Enter') {
        enviarConsultaArbitro();
    }
}

function enviarConsultaArbitro() {
    const input = document.getElementById('input-arbitro');
    const texto = input.value.trim();
    if (!texto) return;

    vibrar(20);
    agregarMensajeChat('usuario', texto);
    input.value = '';

    // Simular tiempo de pensar del árbitro
    setTimeout(() => {
        const respuesta = motorArbitroASART(texto);
        agregarMensajeChat('arbitro', respuesta);
        vibrar(40);
    }, 600 + Math.random() * 800);
}

function agregarMensajeChat(remitente, texto) {
    const chat = document.getElementById('chat-arbitro');
    const div = document.createElement('div');
    div.className = remitente === 'arbitro' ? 'mensaje-arbitro' : 'mensaje-usuario';
    
    if (remitente === 'arbitro') {
        div.innerHTML = `<strong>Árbitro:</strong> ${texto}`;
    } else {
        div.innerText = texto;
    }
    
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// Motor Heurístico Local (Offline)
function motorArbitroASART(consulta) {
    const c = consulta.toLowerCase();
    
    if (c.includes('envido') && c.includes('tapado')) {
        return "¡Epa! Si cantó el envido, lo ganó, y tiró las cartas tapadas al mazo, la regla es clara: PIERDE LOS PUNTOS. El que gana el envido tiene que mostrar sus cartas sí o sí, che.";
    }
    if (c.includes('pica') || c.includes('pica pica')) {
        return "El Pica-Pica (Punta y Hacha) es sagrado. Juegan los enfrentados. Los de afuera NO pueden chistar ni cantar los tantos. Si alguno de afuera habla, su equipo pierde los puntos en juego. ¡A callarse!";
    }
    if (c.includes('parda') || c.includes('empate')) {
        return "Si empatan la primera, define la segunda. Si empatan la segunda, define la primera. Si empatan las tres, gana el mano. Es fácil, no me lloren.";
    }
    if (c.includes('falta') || c.includes('falta envido')) {
        return "La Falta Envido se paga con lo que le falta al puntero para ganar el partido si están en malas. Si están en buenas, gana el partido directamente. ¡Sin vueltas!";
    }
    if (c.includes('flor')) {
        const juegaConFlor = document.getElementById('check-flor')?.checked;
        if (!juegaConFlor) return "Che, fíjate en la configuración: ¡Están jugando SIN flor! Acá el que canta flor se come una penalización.";
        return "La Flor se canta en el primer turno antes de jugar tu carta. Si te olvidás y jugás, perdiste la chance y marche preso.";
    }
    if (c.includes('mentir') || c.includes('falso') || c.includes('boca')) {
        return "En el truco se miente, maestro. Pero si cantás un envido con puntos que no tenés y te piden mostrar al final... ¡perdés todos los puntos de esa mano!";
    }
    if (c.includes('mal cantado') || c.includes('cantó mal') || c.includes('equivocó')) {
        return "Si canta los tantos y se equivoca o miente, marcha preso. Pierde los puntos de la mano en juego, regla de campeonato.";
    }
    if (c.includes('irse') || c.includes('al mazo') || c.includes('mazo')) {
        return "El que se va al mazo pierde los puntos de la ronda (un punto de truco si no hay nada cantado). Y a no llorar, a barajar de nuevo.";
    }
    
    // Fallback genérico
    const fallbacks = [
        "Che, hablá más claro. Según la ASART hay reglas firmes, pero no entiendo bien cuál es el quilombo acá.",
        "Pará la mano. Si no está en el reglamento oficial, se resuelve con sentido común o barajan y dan de nuevo.",
        "No me vengas con excusas raras. El reglamento es uno solo. Reformulame la pregunta con las palabras justas (pica pica, parda, envido, falta) que te canto la posta."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}
