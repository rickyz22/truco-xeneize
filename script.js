let puntosNos = 0; let puntosEllos = 0; let segundos = 0;
let cronometroIntervalo = null; let juegoIniciado = false;
const limitePuntos = 30;

function comenzarJuego() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('contenido-juego').style.display = 'block';
    actualizarInterfaz();
}

function sumar(equipo) {
    if (!juegoIniciado) { juegoIniciado = true; iniciarCronometro(); }
    if (equipo === 'nos' && puntosNos < limitePuntos) puntosNos++;
    if (equipo === 'ellos' && puntosEllos < limitePuntos) puntosEllos++;
    actualizarInterfaz();
}

function restar(equipo) {
    if (equipo === 'nos' && puntosNos > 0) puntosNos--;
    if (equipo === 'ellos' && puntosEllos > 0) puntosEllos--;
    actualizarInterfaz();
}

function iniciarCronometro() {
    if (cronometroIntervalo) return;
    cronometroIntervalo = setInterval(() => {
        segundos++;
        let min = Math.floor(segundos / 60); let seg = segundos % 60;
        document.getElementById('cronometro').innerText = 
            (min < 10 ? "0" + min : min) + ":" + (seg < 10 ? "0" + seg : seg);
    }, 1000);
}

function actualizarInterfaz() {
    document.getElementById('num-nos').innerText = puntosNos;
    document.getElementById('num-ellos').innerText = puntosEllos;
    document.getElementById('palitos-nos').innerHTML = dibujarPalitos(puntosNos);
    document.getElementById('palitos-ellos').innerHTML = dibujarPalitos(puntosEllos);

    if (puntosNos === limitePuntos || puntosEllos === limitePuntos) {
        clearInterval(cronometroIntervalo);
        let ganador = puntosNos === limitePuntos ? "NOSOTROS" : "ELLOS";
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
        btnOk.innerText = '¡VAMOS BOCA!';
        btnOk.className = 'btn-modal-confirmar';
        btnOk.onclick = () => { 
            puntosNos = 0; puntosEllos = 0; segundos = 0; juegoIniciado = false;
            document.getElementById('cronometro').innerText = "00:00";
            actualizarInterfaz();
            modal.style.display = 'none'; 
        };
        btnBox.append(btnOk);
    }
    modal.style.display = 'flex';
}

function reiniciar() {
    mostrarModal("¿NUEVA PARTIDA?", "¿Seguro que querés borrar los puntos y el tiempo?", true, () => {
        puntosNos = 0; puntosEllos = 0; segundos = 0; juegoIniciado = false;
        if (cronometroIntervalo) { clearInterval(cronometroIntervalo); cronometroIntervalo = null; }
        document.getElementById('cronometro').innerText = "00:00";
        actualizarInterfaz();
    });
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
