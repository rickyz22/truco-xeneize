let puntosNos = 0; 
let puntosEllos = 0;
let segundos = 0;
let cronometroIntervalo = null; 
let corriendo = false;
let wakeLock = null; 
let limitePuntos = 30;

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
    mostrarPantallaJuego();
}

function mostrarPantallaJuego() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('contenido-juego').style.display = 'block';
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
        btn.style.background = "#ff4444"; 
        btn.style.color = "white";
        corriendo = true;

    } else {
        clearInterval(cronometroIntervalo);

        icono.innerText = "play_arrow";
        btn.style.background = "#ffcc00"; 
        btn.style.color = "#003b70";
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
    btn.style.background = "#ffcc00"; 
    btn.style.color = "#003b70";
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
    mostrarHistorial();
}

function cerrarConfig() {
    vibrar();

    document.getElementById('pantalla-config').style.display = 'none';

    if (localStorage.getItem('partidaIniciada')) {
        document.getElementById('contenido-juego').style.display = 'block';
    } else {
        document.getElementById('pantalla-inicio').style.display = 'flex';
    }
}

function volverInicio() {
    vibrar();
    localStorage.removeItem('partidaIniciada');

    document.getElementById('contenido-juego').style.display = 'none';
    document.getElementById('pantalla-inicio').style.display = 'flex';
}

function cambiarEstilo(equipo) {
    document.body.className = equipo === 'boca' ? '' : 'tema-' + equipo;
    localStorage.setItem('equipo', equipo);

    // Resaltar el botón del tema seleccionado en la cuadrícula de configuración
    const botones = document.querySelectorAll('.btn-equipo');
    botones.forEach(btn => {
        btn.classList.toggle('activo-tema', btn.classList.contains(equipo));
    });
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
