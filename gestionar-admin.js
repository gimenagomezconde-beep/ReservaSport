
import { app, db } from "./firebase-config.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const auth = getAuth(app);

const UID_PRINCIPAL = "FIGdCf6xnqXrVtodhaOxQioAlHk1";

const botonActualizar = document.getElementById("actualizar");
const mensaje = document.getElementById("mensaje");
const lista = document.getElementById("lista-solicitudes");

let usuarioAutorizado = false;

botonActualizar.disabled = true;

onAuthStateChanged(auth, async (usuario) => {
  usuarioAutorizado = false;
  botonActualizar.disabled = true;
  lista.replaceChildren();

  if (!usuario) {
    mensaje.textContent = "Inicia sesión con la cuenta principal.";
    lista.textContent = "No hay una sesión activa.";
    return;
  }

  try {
    const perfilRef = doc(db, "usuarios", usuario.uid);
    const perfilSnap = await getDoc(perfilRef);

    if (
      usuario.uid !== UID_PRINCIPAL ||
      !perfilSnap.exists() ||
      perfilSnap.data().rol !== "administrador"
    ) {
      mensaje.textContent =
        "Acceso reservado al administrador principal.";
      return;
    }

    usuarioAutorizado = true;
    botonActualizar.disabled = false;
    mensaje.textContent =
      "Sesión del administrador principal verificada.";

    await cargarSolicitudes();

  } catch (error) {
    console.error(error);
    mensaje.textContent =
      "No se pudo verificar la cuenta. Revisa las reglas.";
  }
});

botonActualizar.addEventListener("click", cargarSolicitudes);

async function cargarSolicitudes() {
  if (!usuarioAutorizado) {
    mensaje.textContent =
      "No tienes autorización para ver estas solicitudes.";
    return;
  }

  botonActualizar.disabled = true;
  lista.textContent = "Cargando solicitudes...";

  try {
    const solicitudesQuery = query(
      collection(db, "solicitudes_admin"),
      where("estado", "==", "pendiente")
    );

    const resultado = await getDocs(solicitudesQuery);
    lista.replaceChildren();

    if (resultado.empty) {
      lista.textContent = "No hay solicitudes pendientes.";
      return;
    }

    resultado.forEach((documento) => {
      const solicitud = documento.data();
      const tarjeta = document.createElement("article");
      const titulo = document.createElement("h2");
      const correo = document.createElement("p");
      const uid = document.createElement("p");
      const fecha = document.createElement("p");
      const aprobar = document.createElement("button");
      const rechazar = document.createElement("button");

      titulo.textContent = solicitud.nombre || "Sin nombre";
      correo.textContent =
        `Correo: ${solicitud.email || "No disponible"}`;
      uid.textContent = `UID: ${solicitud.uid}`;
      fecha.textContent = solicitud.creadaEn
        ? `Fecha: ${solicitud.creadaEn.toDate().toLocaleString()}`
        : "Fecha: no disponible";

      aprobar.type = "button";
      aprobar.textContent = "Aprobar administrador";

      rechazar.type = "button";
      rechazar.textContent = "Rechazar solicitud";

      aprobar.addEventListener("click", () =>
        resolverSolicitud(solicitud.uid, "aprobar")
      );

      rechazar.addEventListener("click", () =>
        resolverSolicitud(solicitud.uid, "rechazar")
      );

      tarjeta.append(
        titulo,
        correo,
        uid,
        fecha,
        aprobar,
        rechazar
      );

      tarjeta.style.margin = "16px 0";
      tarjeta.style.padding = "16px";
      tarjeta.style.border = "1px solid #ccc";
      tarjeta.style.borderRadius = "8px";

      lista.appendChild(tarjeta);
    });

  } catch (error) {
    console.error(error);
    lista.textContent = "No se pudieron cargar las solicitudes.";
    mensaje.textContent =
      error.message || "Comprueba los permisos de Firestore.";
  } finally {
    botonActualizar.disabled = !usuarioAutorizado;
  }
}

async function resolverSolicitud(uid, decision) {
  if (!usuarioAutorizado) {
    mensaje.textContent = "Acción no autorizada.";
    return;
  }

  const accion = decision === "aprobar" ? "aprobar" : "rechazar";

  if (!confirm(`¿Deseas ${accion} esta solicitud?`)) {
    return;
  }

  try {
    const solicitudRef = doc(db, "solicitudes_admin", uid);
    const usuarioRef = doc(db, "usuarios", uid);

    const [solicitudSnap, usuarioSnap] = await Promise.all([
      getDoc(solicitudRef),
      getDoc(usuarioRef)
    ]);

    if (!solicitudSnap.exists() || !usuarioSnap.exists()) {
      throw new Error("No se encontró la solicitud o el perfil.");
    }

    if (
      solicitudSnap.data().estado !== "pendiente" ||
      usuarioSnap.data().rol !== "usuario"
    ) {
      throw new Error(
        "La solicitud ya fue revisada o el perfil ya cambió."
      );
    }

    const batch = writeBatch(db);

    if (decision === "aprobar") {
      batch.update(usuarioRef, {
        rol: "administrador"
      });
    }

    batch.update(solicitudRef, {
      estado: decision === "aprobar" ? "aprobada" : "rechazada",
      revisadaEn: serverTimestamp(),
      revisadaPor: auth.currentUser.uid
    });

    await batch.commit();

    mensaje.textContent = decision === "aprobar"
      ? "Solicitud aprobada. La cuenta ya es administradora."
      : "Solicitud rechazada.";

    await cargarSolicitudes();

  } catch (error) {
    console.error(error);
    mensaje.textContent =
      error.message || "No se pudo procesar la solicitud.";
  }
}

