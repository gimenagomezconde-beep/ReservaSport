
import { app, db } from "./firebase-config.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const auth = getAuth(app);

const boton = document.getElementById("enviar-solicitud");
const mensaje = document.getElementById("mensaje");
const estadoSesion = document.getElementById("estado-sesion");

let usuarioActual = null;
let solicitudEnviada = false;

boton.disabled = true;

onAuthStateChanged(auth, async (usuario) => {
  usuarioActual = usuario;
  solicitudEnviada = false;
  boton.disabled = true;
  mensaje.textContent = "";

  if (!usuario) {
    estadoSesion.textContent = "Debes iniciar sesión primero.";
    return;
  }

  try {
    const perfilRef = doc(db, "usuarios", usuario.uid);
    const perfilSnap = await getDoc(perfilRef);

    if (!perfilSnap.exists()) {
      estadoSesion.textContent = "No se encontró tu perfil.";
      return;
    }

    const perfil = perfilSnap.data();

    if (perfil.rol === "administrador") {
      estadoSesion.textContent =
        "Tu cuenta ya tiene el rol de administrador.";
      return;
    }

    if (perfil.rol !== "usuario") {
      estadoSesion.textContent =
        "Tu perfil no tiene un rol válido.";
      return;
    }

    const solicitudRef = doc(
      db,
      "solicitudes_admin",
      usuario.uid
    );

    const solicitudSnap = await getDoc(solicitudRef);

    if (solicitudSnap.exists()) {
      const estado = solicitudSnap.data().estado;

      estadoSesion.textContent =
        estado === "pendiente"
          ? "Ya tienes una solicitud pendiente."
          : estado === "aprobada"
            ? "Tu solicitud fue aprobada."
            : "Tu solicitud fue revisada. Contacta al administrador principal.";

      return;
    }

    estadoSesion.textContent =
      `Sesión iniciada: ${usuario.email || "cuenta activa"}`;

    boton.disabled = false;

  }  catch (error) {
  console.error("Código del error:", error.code);
  console.error("Mensaje del error:", error.message);
  console.error("Usuario autenticado:", usuarioActual?.uid);

  mensaje.textContent =
    `Error de Firebase: ${error.code || error.message}`;
}
});

boton.addEventListener("click", async () => {
  if (!usuarioActual || solicitudEnviada) {
    mensaje.textContent =
      "Inicia sesión o revisa el estado de tu solicitud.";
    return;
  }

  boton.disabled = true;
  mensaje.textContent = "Enviando solicitud...";

  try {
    const perfilRef = doc(
      db,
      "usuarios",
      usuarioActual.uid
    );

    const perfilSnap = await getDoc(perfilRef);

    if (
      !perfilSnap.exists() ||
      perfilSnap.data().rol !== "usuario"
    ) {
      throw new Error(
        "Tu perfil no puede solicitar autorización."
      );
    }

    const solicitudRef = doc(
      db,
      "solicitudes_admin",
      usuarioActual.uid
    );

    const solicitudSnap = await getDoc(solicitudRef);

    if (solicitudSnap.exists()) {
      throw new Error(
        "Ya existe una solicitud para tu cuenta."
      );
    }

    await setDoc(solicitudRef, {
      uid: usuarioActual.uid,
      nombre: perfilSnap.data().nombre || "",
      email: usuarioActual.email || perfilSnap.data().email || "",
      estado: "pendiente",
      creadoEn: serverTimestamp()
    });

    solicitudEnviada = true;

    mensaje.textContent =
      "Solicitud enviada correctamente al administrador principal.";

    estadoSesion.textContent =
      "Tu solicitud está pendiente de revisión.";

  } catch (error) {
    console.error(error);
    mensaje.textContent =
      error.message || "No se pudo enviar la solicitud.";
  } finally {
    boton.disabled = true;
  }
});
