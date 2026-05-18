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

let audioContext = null;

function vibrar(ms = 30) { 
    const vibrarHabilitado = localStorage.getItem('show-vibrar') !== 'false';
    if (vibrarHabilitado && navigator.vibrate) {
        navigator.vibrate(ms);
    }
}

function playBeep(tipo = 'default') {
    const sonidoHabilitado = localStorage.getItem('show-sonido') !== 'false';
    if (!sonidoHabilitado) return;

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

function guardarProgreso() {
    localStorage.setItem('puntosNos', puntosNos);
    localStorage.setItem('puntosEllos', puntosEllos);
    localStorage.setItem('segundos', segundos);
}

function comenzarJuego() {
    vibrar();
    activarWakeLock();
    localStorage.setItem('partidaIniciada', 'true');
    detenerAnimacionPelota();
    mostrarPantallaJuego();
}

function mostrarPantallaJuego() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('contenido-juego').style.display = 'block';
    detenerAnimacionPelota();
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

    if (equipo === 'nos' && puntosNos < limitePuntos) puntosNos++;
    if (equipo === 'ellos' && puntosEllos < limitePuntos) puntosEllos++;

    actualizarInterfaz();
    guardarProgreso();
}

function restar(equipo) {
    if (juegoTerminado()) return;

    vibrar();
    playBeep('restar');

    if (equipo === 'nos' && puntosNos > 0) puntosNos--;
    if (equipo === 'ellos' && puntosEllos > 0) puntosEllos--;

    actualizarInterfaz();
    guardarProgreso();
}

function actualizarInterfaz() {
    document.getElementById('num-nos').innerText = puntosNos;
    document.getElementById('num-ellos').innerText = puntosEllos;

    document.getElementById('palitos-nos').innerHTML = dibujarPalitos(puntosNos);
    document.getElementById('palitos-ellos').innerHTML = dibujarPalitos(puntosEllos);

    if (juegoTerminado()) {
        clearInterval(cronometroIntervalo);

        let ganador = puntosNos >= limitePuntos ? "NOSOTROS" : "ELLOS";

        vibrar(200);
        playBeep('victoria');

        guardarEnHistorial(ganador);

        mostrarModal("¡GANARON!", `El equipo de ${ganador} se lleva la gloria.`, false);
    }
}

function mostrarModal(titulo, mensaje, esConfirmacion, accion) {
    const modal = document.getElementById('modal-custom');

    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-mensaje').innerText = mensaje;

    const btnBox = document.getElementById('modal-botones');
    btnBox.innerHTML = '';

    if (esConfirmacion) {
        let btnNo = document.createElement('button');
        btnNo.innerText = 'VOLVER';
        btnNo.className = 'btn-modal-cancelar';
        btnNo.onclick = () => modal.style.display = 'none';

        let btnSi = document.createElement('button');
        btnSi.innerText = 'REINICIAR';
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

// 🔥 ACA ESTA LA MEJORA
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
    localStorage.removeItem('partidaIniciada');

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

    // Scoreboard labels take first 5 characters
    if (lblNos) lblNos.innerText = nombreNos.substring(0, 5);
    if (lblEllos) lblEllos.innerText = nombreEllos.substring(0, 5);
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
        document.getElementById('cont-crono').style.display = activo ? 'flex' : 'none';
    } 
    else if (tipo === 'num') {
        document.getElementById('cont-nos').style.display = activo ? 'flex' : 'none';
        document.getElementById('cont-ellos').style.display = activo ? 'flex' : 'none';
    }
    else if (tipo === 'sonido') {
        document.getElementById('icon-sonido').innerText = activo ? 'volume_up' : 'volume_off';
    }

    localStorage.setItem(`show-${tipo}`, activo);
    vibrar();
}

window.onload = () => {
    // Registro de Service Worker para soporte offline PWA (evitar en entorno local de archivo)
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
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
    // Cargar partida iniciada
    if (localStorage.getItem('partidaIniciada')) {
        puntosNos = parseInt(localStorage.getItem('puntosNos') || 0);
        puntosEllos = parseInt(localStorage.getItem('puntosEllos') || 0);
        segundos = parseInt(localStorage.getItem('segundos') || 0);

        mostrarTiempo();
        mostrarPantallaJuego();
    } else {
        iniciarAnimacionPelota();
    }

    // Restaurar preferencias
    ['crono','num','sonido','vibrar'].forEach(tipo => {
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
