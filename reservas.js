
import { app, db } from "./firebase-config.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    setDoc,
    query,
    where,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const auth = getAuth(app);

const CLAVE_DEPORTE = "reservasport_deporte";

let sesion = null;
let perfilListo = false;
let reservasActuales = [];

const saludo = document.getElementById("saludo");
const nombreUsuario = document.getElementById("nombre-usuario");
const selectorDeporte = document.getElementById("deporte");
const selectorCancha = document.getElementById("cancha");
const selectorFecha = document.getElementById("fecha");
const selectorHorario = document.getElementById("horario");
const formulario = document.getElementById("formulario-reserva");
const mensaje = document.getElementById("mensaje-reserva");
const listaReservas = document.getElementById("lista-reservas");

const ticketReserva = document.getElementById("ticket-reserva");
const ticketCodigo = document.getElementById("ticket-codigo");
const ticketUsuario = document.getElementById("ticket-usuario");
const ticketDeporte = document.getElementById("ticket-deporte");
const ticketCancha = document.getElementById("ticket-cancha");
const ticketFecha = document.getElementById("ticket-fecha");
const ticketHorario = document.getElementById("ticket-horario");
const botonImprimirTicket = document.getElementById("imprimir-ticket");

function mostrarMensaje(texto, tipo = "error") {
    if (!mensaje) return;
    mensaje.textContent = texto;
    mensaje.className = "mensaje-reserva " + tipo;
}

function mostrarNombreUsuario() {
    if (!sesion) return;

    const nombre = sesion.nombre || sesion.email;

    if (saludo) {
        saludo.textContent =
            "Hola, " + nombre + ". Ya puedes registrar tu reserva.";
    }

    if (nombreUsuario) {
        nombreUsuario.value = nombre;
    }
}

function establecerFechaMinima() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");

    if (selectorFecha) {
        selectorFecha.min = `${anio}-${mes}-${dia}`;
    }
}

establecerFechaMinima();

// ========================================
// 1. OBTENER USUARIO Y PERFIL DE FIREBASE
// ========================================

function esperarUsuario() {
    return new Promise((resolve) => {
        const cancelar = onAuthStateChanged(auth, (usuario) => {
            cancelar();
            resolve(usuario);
        });
    });
}

async function inicializar() {
    try {
        const usuario = await esperarUsuario();

        if (!usuario) {
            window.location.replace("login.html");
            return;
        }

        const referenciaPerfil = doc(db, "usuarios", usuario.uid);
        const resultadoPerfil = await getDoc(referenciaPerfil);

        if (!resultadoPerfil.exists()) {
            alert("No se encontró tu perfil en Firestore.");
            await signOut(auth);
            window.location.replace("login.html");
            return;
        }

        const perfil = resultadoPerfil.data();

        sesion = {
            uid: usuario.uid,
            email: usuario.email,
            nombre: perfil.nombre || usuario.displayName || usuario.email,
            rol: perfil.rol || "usuario"
        };

        perfilListo = true;
        mostrarNombreUsuario();

        const deporteGuardado = localStorage.getItem(CLAVE_DEPORTE);
        if (deporteGuardado) {
            seleccionarDeporte(deporteGuardado);
        }

        await mostrarReservas();
    } catch (error) {
        console.error("Error al iniciar las reservas:", error);
        mostrarMensaje(
            "No se pudo cargar tu perfil o tus reservas. Revisa la consola.",
            "error"
        );
    }
}

// ========================================
// 2. SELECCIONAR DEPORTE
// ========================================

function seleccionarDeporte(deporte) {
    if (!selectorDeporte || !deporte) return;

    selectorDeporte.value = deporte;
    localStorage.setItem(CLAVE_DEPORTE, deporte);

    const textoDeporte = document.getElementById("deporte-seleccionado");

    if (textoDeporte) {
        textoDeporte.textContent = "Deporte seleccionado: " + deporte;
    }

    document.querySelectorAll("[data-deporte]").forEach((boton) => {
        boton.classList.toggle(
            "activo",
            boton.dataset.deporte === deporte
        );
    });
}

document.querySelectorAll("[data-deporte]").forEach((boton) => {
    boton.addEventListener("click", () => {
        seleccionarDeporte(boton.dataset.deporte);
    });
});

if (selectorDeporte) {
    selectorDeporte.addEventListener("change", () => {
        seleccionarDeporte(selectorDeporte.value);
    });
}

// ========================================
// 3. MOSTRAR TICKET
// ========================================

function mostrarTicket(reserva) {
    if (!ticketReserva || !reserva) return;

    const numero = String(reserva.id).slice(-6).padStart(6, "0");

    if (ticketCodigo) ticketCodigo.textContent = "RS-" + numero;
    if (ticketUsuario) ticketUsuario.textContent = reserva.nombre || sesion.nombre;
    if (ticketDeporte) ticketDeporte.textContent = reserva.deporte;
    if (ticketCancha) ticketCancha.textContent = reserva.cancha;

    if (ticketFecha) {
        const partes = String(reserva.fecha).split("-");
        ticketFecha.textContent = partes.length === 3
            ? `${partes[2]}/${partes[1]}/${partes[0]}`
            : reserva.fecha;
    }

    if (ticketHorario) ticketHorario.textContent = reserva.horario;

    ticketReserva.hidden = false;
    ticketReserva.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

if (botonImprimirTicket) {
    botonImprimirTicket.addEventListener("click", () => {
        window.print();
    });
}

// ========================================
// 4. CONSULTAR RESERVAS EN FIRESTORE
// ========================================

async function leerReservas() {
    if (!sesion) return [];

    const referencia = collection(db, "reservas");
    const consulta = query(
        referencia,
        where("usuarioId", "==", sesion.uid)
    );

    const resultado = await getDocs(consulta);

    return resultado.docs.map((documento) => ({
        id: documento.id,
        ...documento.data()
    }));
}

// ========================================
// 5. MOSTRAR MIS RESERVAS
// ========================================

async function mostrarReservas() {
    if (!listaReservas || !sesion || !perfilListo) return;

    try {
        reservasActuales = await leerReservas();
        listaReservas.replaceChildren();

        if (reservasActuales.length === 0) {
            listaReservas.textContent =
                "Todavía no tienes reservas registradas.";
            return;
        }

        reservasActuales.forEach((reserva) => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "reserva-guardada";

            const detalle = document.createElement("p");
            detalle.textContent =
                `${reserva.deporte} | ${reserva.cancha} | ` +
                `${reserva.fecha} | ${reserva.horario}`;

            const estado = document.createElement("p");
            estado.textContent = "Estado: " + reserva.estado;

            tarjeta.append(detalle, estado);

            if (reserva.estado === "Confirmada") {
                const botonCancelar = document.createElement("button");
                botonCancelar.type = "button";
                botonCancelar.className = "boton-cancelar";
                botonCancelar.textContent = "Cancelar reserva";

                botonCancelar.addEventListener("click", async () => {
                    const confirmar = window.confirm(
                        "¿Seguro que deseas cancelar esta reserva?"
                    );

                    if (!confirmar) return;

                    try {
                        const referenciaReserva = doc(
                            db,
                            "reservas",
                            reserva.id
                        );

                        await updateDoc(referenciaReserva, {
                            estado: "Cancelada",
                            actualizadoEn: serverTimestamp()
                        });

                        await mostrarReservas();
                        mostrarMensaje("La reserva fue cancelada.", "exito");
                    } catch (error) {
                        console.error("Error al cancelar:", error);
                        mostrarMensaje(
                            "No se pudo cancelar la reserva. Revisa las reglas de Firestore.",
                            "error"
                        );
                    }
                });

                tarjeta.appendChild(botonCancelar);
            }

            listaReservas.appendChild(tarjeta);
        });
    } catch (error) {
        console.error("Error al consultar reservas:", error);
        listaReservas.textContent =
            "No se pudieron cargar las reservas desde Firebase.";
    }
}

// ========================================
// 6. REGISTRAR RESERVA EN FIRESTORE
// ========================================

if (formulario) {
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        if (!sesion || !perfilListo) {
            mostrarMensaje(
                "Espera a que se cargue tu perfil de usuario.",
                "error"
            );
            return;
        }

        const deporte = selectorDeporte.value;
        const cancha = selectorCancha.value;
        const fecha = selectorFecha.value;
        const horario = selectorHorario.value;

        if (!deporte || !cancha || !fecha || !horario) {
            mostrarMensaje("Completa todos los campos.", "error");
            return;
        }

        if (fecha < selectorFecha.min) {
            mostrarMensaje(
                "Selecciona una fecha válida, desde hoy en adelante.",
                "error"
            );
            return;
        }

        try {
            mostrarMensaje("Comprobando disponibilidad...", "exito");

            const consultaOcupadas = query(
                collection(db, "reservas"),
                where("cancha", "==", cancha),
                where("fecha", "==", fecha),
                where("horario", "==", horario),
                where("estado", "==", "Confirmada")
            );

            const ocupadas = await getDocs(consultaOcupadas);

            if (!ocupadas.empty) {
                mostrarMensaje(
                    "Esa cancha ya tiene una reserva confirmada en ese horario.",
                    "error"
                );
                return;
            }

            const nuevaReserva = {
                usuarioId: sesion.uid,
                nombre: sesion.nombre,
                email: sesion.email,
                deporte,
                cancha,
                fecha,
                horario,
                estado: "Confirmada",
                creadoEn: serverTimestamp()
            };

            const documento = await addDoc(
                collection(db, "reservas"),
                nuevaReserva
            );

            mostrarMensaje(
                "¡Reserva guardada en Firebase! Tu ticket está listo.",
                "exito"
            );

            formulario.reset();
            mostrarNombreUsuario();
            seleccionarDeporte(deporte);

            await mostrarReservas();

            mostrarTicket({
                ...nuevaReserva,
                id: documento.id
            });
        } catch (error) {
            console.error("Error al guardar en Firestore:", error);

            if (error.code === "permission-denied") {
                mostrarMensaje(
                    "Firestore rechazó la operación. Hay que revisar las reglas de seguridad.",
                    "error"
                );
            } else {
                mostrarMensaje(
                    "No se pudo guardar la reserva. Revisa la consola del navegador.",
                    "error"
                );
            }
        }
    });
}

// ========================================
// 7. CERRAR SESIÓN DE FIREBASE
// ========================================

const botonCerrarSesion = document.getElementById("cerrar-sesion");

if (botonCerrarSesion) {
    botonCerrarSesion.addEventListener("click", async () => {
        try {
            localStorage.removeItem(CLAVE_DEPORTE);
            await signOut(auth);
            window.location.href = "index.html";
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            alert("No se pudo cerrar la sesión.");
        }
    });
}
// ========================================
// 8. SOLICITAR SER ADMINISTRADOR
// ========================================

const botonSolicitarAdmin = document.getElementById(
    "btn-solicitar-admin"
);

const mensajeSolicitudAdmin = document.getElementById(
    "mensaje-solicitud-admin"
);

function mostrarMensajeSolicitud(texto, tipo = "error") {
    if (!mensajeSolicitudAdmin) return;

    mensajeSolicitudAdmin.textContent = texto;
    mensajeSolicitudAdmin.className = "mensaje-reserva " + tipo;
}

async function comprobarSolicitudAdmin() {
    if (!sesion || !botonSolicitarAdmin) return;

    try {
        const referencia = doc(
            db,
            "solicitudes_admin",
            sesion.uid
        );

        const resultado = await getDoc(referencia);

        if (!resultado.exists()) {
            botonSolicitarAdmin.disabled = false;
            mostrarMensajeSolicitud(
                "Todavía no has enviado una solicitud.",
                "exito"
            );
            return;
        }

        const solicitud = resultado.data();

        if (solicitud.estado === "pendiente") {
            botonSolicitarAdmin.disabled = true;
            mostrarMensajeSolicitud(
                "Tu solicitud está pendiente de revisión.",
                "exito"
            );
        } else if (solicitud.estado === "aprobada") {
            botonSolicitarAdmin.disabled = true;
            mostrarMensajeSolicitud(
                "Tu solicitud fue aprobada. Cierra sesión e inicia sesión nuevamente para actualizar tu acceso.",
                "exito"
            );
        } else if (solicitud.estado === "rechazada") {
            botonSolicitarAdmin.disabled = true;
            mostrarMensajeSolicitud(
                "Tu solicitud fue rechazada. Consulta con el administrador principal si deseas volver a solicitarlo.",
                "error"
            );
        } else {
            botonSolicitarAdmin.disabled = true;
            mostrarMensajeSolicitud(
                "No se reconoce el estado de tu solicitud. Consulta con el administrador.",
                "error"
            );
        }
    } catch (error) {
        console.error("Error al consultar la solicitud:", error);
        mostrarMensajeSolicitud(
            "No se pudo consultar tu solicitud. Revisa las reglas de Firestore.",
            "error"
        );
    }
}

if (botonSolicitarAdmin) {
    botonSolicitarAdmin.addEventListener("click", async () => {
        if (!sesion || !perfilListo) {
            mostrarMensajeSolicitud(
                "Espera a que se cargue tu perfil.",
                "error"
            );
            return;
        }

        if (sesion.rol === "administrador") {
            mostrarMensajeSolicitud(
                "Tu cuenta ya tiene el rol de administrador.",
                "exito"
            );
            botonSolicitarAdmin.disabled = true;
            return;
        }

        botonSolicitarAdmin.disabled = true;

        try {
            const referencia = doc(
                db,
                "solicitudes_admin",
                sesion.uid
            );

            const existente = await getDoc(referencia);

            if (existente.exists()) {
                await comprobarSolicitudAdmin();
                return;
            }

            await setDoc(referencia, {
                uid: sesion.uid,
                nombre: sesion.nombre,
                email: sesion.email,
                estado: "pendiente",
                creadoEn: serverTimestamp()
            });

            mostrarMensajeSolicitud(
                "¡Solicitud enviada! El administrador principal debe revisarla.",
                "exito"
            );

            botonSolicitarAdmin.disabled = true;
        } catch (error) {
            console.error("Error al enviar la solicitud:", error);

            botonSolicitarAdmin.disabled = false;

            mostrarMensajeSolicitud(
                "No se pudo enviar la solicitud. Verifica las reglas de Firestore y que los emuladores estén activos.",
                "error"
            );
        }
    });
}
// ========================================
// 9. INICIAR LA PÁGINA
// ========================================

async function iniciarReservaSport() {
    await inicializar();

    if (sesion && perfilListo) {
        await comprobarSolicitudAdmin();
    }
}

iniciarReservaSport();

console.log("ReservaSport: conexión con Firebase preparada.");