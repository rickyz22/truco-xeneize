let puntosNos = 0; let puntosEllos = 0; let segundos = 0;
let cronometroIntervalo = null; let corriendo = false;
let wakeLock = null; const limitePuntos = 30;

function vibrar() { if (navigator.vibrate) navigator.vibrate(30); }

async function activarWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } 
    catch (err) { console.log("Wake Lock no disponible"); }
}

function guardarProgreso() {
    localStorage.setItem('puntosNos', puntosNos);
    localStorage.setItem('puntosEllos', puntosEllos);
    localStorage.setItem('segundos', segundos);
}

function comenzarJuego() {
    vibrar();
    activarWakeLock();
    localStorage.setItem('partidaIniciada', 'true');
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
        btn.style.background = "#ff4444"; btn.style.color = "white";
        corriendo = true;
    } else {
        clearInterval(cronometroIntervalo);
        icono.innerText = "play_arrow";
        btn.style.background = "#ffcc00"; btn.style.color = "#003b70";
        corriendo = false;
    }
}

function mostrarTiempo() {
    let min = Math.floor(segundos / 60); let seg = segundos % 60;
    document.getElementById('cronometro').innerText = (min < 10 ? "0" + min : min) + ":" + (seg < 10 ? "0" + seg : seg);
}

function resetearCronometro() {
    vibrar();
    clearInterval(cronometroIntervalo);
    cronometroIntervalo = null; segundos = 0; corriendo = false;
    mostrarTiempo();
    guardarProgreso();
    document.getElementById('icono-play').innerText = "play_arrow";
    const btn = document.getElementById('btn-play-pause');
    btn.style.background = "#ffcc00"; btn.style.color = "#003b70";
}

function sumar(equipo) {
    vibrar();
    if (equipo === 'nos' && puntosNos < limitePuntos) puntosNos++;
    if (equipo === 'ellos' && puntosEllos < limitePuntos) puntosEllos++;
    actualizarInterfaz();
    guardarProgreso();
}

function restar(equipo) {
    vibrar();
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
    if (puntosNos >= limitePuntos || puntosEllos >= limitePuntos) {
        clearInterval(cronometroIntervalo);
        let ganador = puntosNos >= limitePuntos ? "NOSOTROS" : "ELLOS";
        mostrarModal("¡GANARON!", "El equipo de " + ganador + " se lleva la gloria.", false);
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
        btnNo.innerText = 'VOLVER'; btnNo.className = 'btn-modal-cancelar';
        btnNo.onclick = () => { vibrar(); modal.style.display = 'none'; };
        let btnSi = document.createElement('button');
        btnSi.innerText = 'REINICIAR'; btnSi.className = 'btn-modal-confirmar';
        btnSi.onclick = () => { vibrar(); if(accion) accion(); modal.style.display = 'none'; };
        btnBox.append(btnNo, btnSi);
    } else {
        let btnOk = document.createElement('button');
        btnOk.innerText = '¡VAMOS!'; btnOk.className = 'btn-modal-confirmar';
        btnOk.onclick = () => { vibrar(); reiniciarTotalmente(); modal.style.display = 'none'; };
        btnBox.append(btnOk);
    }
    modal.style.display = 'flex';
}

function reiniciar() {
    vibrar();
    mostrarModal("¿NUEVA PARTIDA?", "¿Borrar puntos y tiempo?", true, () => { reiniciarTotalmente(); });
}

function reiniciarTotalmente() {
    puntosNos = 0; puntosEllos = 0;
    localStorage.removeItem('partidaIniciada');
    resetearCronometro();
    actualizarInterfaz();
    document.getElementById('modal-custom').style.display = 'none';
}

function dibujarPalitos(puntos) {
    let html = '<div class="grupo-15">'; 
    for (let i = 0; i < puntos; i++) {
        if (i === 15) html += '</div><div class="linea-divisoria" style="width:2px; background:#ffcc00; opacity:0.3; margin:0 5px;"></div><div class="grupo-15">';
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
}

function cerrarConfig() {
    document.getElementById('pantalla-config').style.display = 'none';
    if (localStorage.getItem('partidaIniciada')) document.getElementById('contenido-juego').style.display = 'block';
    else document.getElementById('pantalla-inicio').style.display = 'flex';
}

function cambiarEstilo(equipo) {
    vibrar();
    document.body.className = equipo === 'boca' ? '' : 'tema-' + equipo;
    localStorage.setItem('equipo', equipo);
}

function toggleElemento(tipo) {
    const activo = document.getElementById(`check-${tipo}`).checked;
    if (tipo === 'crono') document.getElementById('cont-crono').style.display = activo ? 'flex' : 'none';
    else {
        document.getElementById('cont-nos').style.display = activo ? 'flex' : 'none';
        document.getElementById('cont-ellos').style.display = activo ? 'flex' : 'none';
    }
    localStorage.setItem(`show-${tipo}`, activo);
}

window.onload = () => {
    // Cargar estilo
    const equipo = localStorage.getItem('equipo');
    if (equipo) cambiarEstilo(equipo);
    
    // Cargar datos si hay partida iniciada
    if (localStorage.getItem('partidaIniciada')) {
        puntosNos = parseInt(localStorage.getItem('puntosNos') || 0);
        puntosEllos = parseInt(localStorage.getItem('puntosEllos') || 0);
        segundos = parseInt(localStorage.getItem('segundos') || 0);
        mostrarTiempo();
        comenzarJuego();
    }
    
    // Cargar configuración de elementos
    ['crono', 'num'].forEach(tipo => {
        const estado = localStorage.getItem(`show-${tipo}`);
        if (estado !== null) {
            const el = document.getElementById(`check-${tipo}`);
            if(el) { el.checked = JSON.parse(estado); toggleElemento(tipo); }
        }
    });
};