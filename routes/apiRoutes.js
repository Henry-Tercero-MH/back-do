const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const dbPath = path.join(__dirname, "../data/db.json");

// Leer el archivo `db.json`
function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

// Escribir en el archivo `db.json`
function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Rutas para usuarios

// Obtener todos los usuarios
router.get("/usuarios", (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.usuarios });
});

// Obtener usuario por ID
router.get("/usuarios/:id", (req, res) => {
  const db = readDb();
  const usuario = db.usuarios.find((u) => u.id === parseInt(req.params.id));
  if (usuario) {
    res.json({ success: true, data: usuario });
  } else {
    res.status(404).json({ success: false, message: "Usuario no encontrado" });
  }
});

// Crear nuevo usuario
router.post("/usuarios", (req, res) => {
  const db = readDb();
  const nuevoUsuario = req.body;
  nuevoUsuario.id = db.usuarios.length + 1;
  db.usuarios.push(nuevoUsuario);
  writeDb(db);
  res.status(201).json(nuevoUsuario);
});

// Editar usuario existente
router.put("/usuarios/:id", (req, res) => {
  const db = readDb();
  const index = db.usuarios.findIndex((u) => u.id === parseInt(req.params.id));
  if (index !== -1) {
    db.usuarios[index] = { ...db.usuarios[index], ...req.body };
    writeDb(db);
    res.json(db.usuarios[index]);
  } else {
    res.status(404).json({ message: "Usuario no encontrado" });
  }
});

// Eliminar usuario
router.delete("/usuarios/:id", (req, res) => {
  const db = readDb();
  const index = db.usuarios.findIndex((u) => u.id === parseInt(req.params.id));
  if (index !== -1) {
    const eliminado = db.usuarios.splice(index, 1);
    writeDb(db);
    res.json(eliminado);
  } else {
    res.status(404).json({ message: "Usuario no encontrado" });
  }
});

// Rutas para lecturas RFID

// Obtener todas las lecturas RFID
router.get("/lecturas", (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.lecturas });
});

// Crear nueva lectura RFID y generar un reporte
router.post("/lecturas", (req, res) => {
  try {
    const db = readDb();
    const nuevaLectura = req.body;

    // Validar que se proporcione la placa
    if (
      !nuevaLectura.placa ||
      !nuevaLectura.ubicacion ||
      !nuevaLectura.fecha ||
      !nuevaLectura.hora
    ) {
      return res.status(400).json({
        success: false,
        message: "Se requieren 'placa', 'ubicacion', 'fecha' y 'hora'.",
      });
    }

    // Buscar el vehículo según la placa en el archivo `db.json`
    const vehiculo = db.vehiculos.find((v) => v.placa === nuevaLectura.placa);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado." });
    }

    // Generar la nueva lectura RFID
    nuevaLectura.id =
      db.lecturas.length > 0
        ? Math.max(...db.lecturas.map((l) => l.id)) + 1
        : 1;
    db.lecturas.push(nuevaLectura);

    // Crear un nuevo reporte automáticamente con los nuevos datos
    const nuevoReporte = {
      id:
        db.reportes.length > 0
          ? Math.max(...db.reportes.map((r) => r.id)) + 1
          : 1,
      conductor: vehiculo.conductor || "Desconocido",
      placa: vehiculo.placa,
      tipo: vehiculo.tipo,
      uso: vehiculo.uso,
      ubicacion: nuevaLectura.ubicacion,
      fecha: nuevaLectura.fecha,
      hora: nuevaLectura.hora,
      detalle: `Lectura RFID para el vehículo con placa ${vehiculo.placa} registrada en la ubicación ${nuevaLectura.ubicacion}.`,
    };

    // Agregar el nuevo reporte a la base de datos
    db.reportes.push(nuevoReporte);

    // Guardar los cambios en el archivo `db.json`
    writeDb(db);

    // Devolver la respuesta con la nueva lectura y el reporte generado
    res.status(201).json({
      success: true,
      mensaje: "Lectura y reporte creados exitosamente.",
      lectura: nuevaLectura,
      reporte: nuevoReporte,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error al crear la lectura RFID." });
  }
});

// Rutas para reportes

// Obtener todos los reportes
router.get("/reportes", (req, res) => {
  const db = readDb();
  res.json({ success: true, data: db.reportes });
});

// Crear nuevo reporte
router.post("/reportes", (req, res) => {
  const db = readDb();
  const nuevoReporte = req.body;
  nuevoReporte.id =
    db.reportes.length > 0 ? Math.max(...db.reportes.map((r) => r.id)) + 1 : 1;
  db.reportes.push(nuevoReporte);
  writeDb(db);
  res.status(201).json({ success: true, data: nuevoReporte });
});

// Obtener vehículo por placa (con parámetros de consulta)
router.get("/rfid", (req, res) => {
  const { placa } = req.query; // Obtener placa desde los parámetros de consulta

  // Validar que se haya proporcionado una placa
  if (!placa) {
    return res
      .status(400)
      .json({ success: false, message: "Se requiere el parámetro 'placa'." });
  }

  try {
    const db = readDb(); // Asumiendo que readDb() lee tu archivo JSON

    // Buscar en la sección rfid
    const vehiculo = db.rfid.find((v) => v.placa === placa); // Buscar por placa

    // Verificar si se encontró el vehículo
    if (vehiculo) {
      res.status(200).json({ success: true, data: vehiculo }); // Devolver el vehículo encontrado
    } else {
      res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado." }); // Mensaje de error si no se encuentra
    }
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error al obtener el vehículo." });
  }
});

// Actualizar el estado del vehículo
router.put("/rfid/estado", (req, res) => {
  const { placa, estado } = req.body; // Obtener la placa y el estado desde el cuerpo de la solicitud

  if (!placa || !estado) {
    return res
      .status(400)
      .json({ success: false, message: "Placa y estado son requeridos." });
  }

  try {
    const db = readDb();

    // Buscar el vehículo según la placa en la sección `rfid`
    const vehiculo = db.rfid.find((v) => v.placa === placa);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado." });
    }

    // Actualizar el estado del vehículo
    vehiculo.estado = estado;

    // Guardar los cambios en el archivo `db.json`
    writeDb(db);

    // Devolver el vehículo actualizado
    res.json({ success: true, data: vehiculo });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar el estado." });
  }
});
// Verificar si el correo electrónico ya existe
router.get("/check-email", (req, res) => {
  const { email } = req.query; // Obtener el correo desde los parámetros de consulta

  // Validar que se haya proporcionado un correo
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Se requiere el parámetro 'email'." });
  }

  const db = readDb();

  // Verificar si el correo ya existe en la base de datos
  const exists = db.usuarios.some((usuario) => usuario.email === email);

  res.json({ success: true, exists }); // Retornar si el correo existe
});
// Endpoint para agregar una nueva lectura con todos los detalles
router.post("/lecturas", (req, res) => {
  console.log(req.body); // Agregar esta línea para depuración

  // Extraer los datos del cuerpo de la solicitud
  const {
    uso,
    tipo,
    linea,
    chasis,
    serie,
    color,
    placa,
    modelo,
    nombre,
    cui,
    nit,
    estado,
    fotoVehiculo,
    fotoConductor,
    ubicacion,
    fecha,
    hora,
  } = req.body;

  // Validar que se hayan proporcionado todos los campos requeridos
  if (
    !uso ||
    !tipo ||
    !linea ||
    !chasis ||
    !serie ||
    !color ||
    !placa ||
    !modelo ||
    !nombre ||
    !cui ||
    !nit ||
    !estado ||
    !fotoVehiculo ||
    !fotoConductor ||
    !ubicacion ||
    !fecha ||
    !hora
  ) {
    return res.status(400).json({ error: "Faltan datos requeridos." });
  }

  // Leer el archivo db.json
  fs.readFile(dbPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error al leer la base de datos:", err);
      return res.status(500).json({ error: "Error al leer la base de datos" });
    }

    try {
      const db = JSON.parse(data);
      db.lecturas = db.lecturas || []; // Asegúrate de que existe 'lecturas'

      // Crear un nuevo objeto de lectura
      const nuevaLectura = {
        id: uuidv4(), // Generar un nuevo ID único
        uso,
        tipo,
        linea,
        chasis,
        serie,
        color,
        placa,
        modelo,
        nombre,
        cui,
        nit,
        estado,
        fotoVehiculo,
        fotoConductor,
        fecha,
        hora,
        ubicacion,
      };

      // Agregar la nueva lectura
      db.lecturas.push(nuevaLectura);

      // Guardar las actualizaciones en db.json
      fs.writeFile(dbPath, JSON.stringify(db, null, 2), (err) => {
        if (err) {
          console.error("Error al guardar la lectura:", err);
          return res.status(500).json({ error: "Error al guardar la lectura" });
        }
        console.log("Nueva lectura guardada:", nuevaLectura);
        res.status(201).json(nuevaLectura); // Responder con la nueva lectura
      });
    } catch (parseError) {
      console.error("Error al procesar la base de datos:", parseError);
      res.status(500).json({ error: "Error al procesar la base de datos" });
    }
  });
});
// Obtener todas las lecturas RFID
router.get("/lecturas", (req, res) => {
  try {
    const db = readDb();
    res.json({ success: true, data: db.lecturas });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error al obtener lecturas." });
  }
});
// Crear nuevo usuario
router.post("/usuarios", (req, res) => {
  const db = readDb();
  const nuevoUsuario = req.body;

  // Generar un UUID como ID único para el nuevo usuario
  nuevoUsuario.id = uuidv4();

  db.usuarios.push(nuevoUsuario);
  writeDb(db);

  res.status(201).json(nuevoUsuario);
});
// Obtener usuario por ID
router.get("/usuarios/:id", (req, res) => {
  const db = readDb();

  // Buscar el usuario usando UUID
  const usuario = db.usuarios.find((u) => u.id === req.params.id);

  if (usuario) {
    res.json({ success: true, data: usuario });
  } else {
    res.status(404).json({ success: false, message: "Usuario no encontrado" });
  }
});
// services/api.js

// services/api.js
export const requestPasswordReset = async (email) => {
  const response = await fetch("/api/request-password-reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error("Error en la solicitud de restablecimiento de contraseña");
  }

  return await response.json();
};

// Actualizar la contraseña del usuario
router.put("/usuarios/cambiar-contrasena", (req, res) => {
  const { email, nuevaContraseña } = req.body; // Obtener el email y la nueva contraseña desde el cuerpo de la solicitud

  // Validar que se hayan proporcionado el email y la nueva contraseña
  if (!email || !nuevaContraseña) {
    return res.status(400).json({
      success: false,
      message: "Email y nueva contraseña son requeridos.",
    });
  }

  try {
    const db = readDb(); // Función para leer la base de datos

    // Buscar el usuario según el email
    const usuario = db.usuarios.find((u) => u.email === email);

    if (!usuario) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado." });
    }

    // Actualizar la contraseña del usuario
    usuario.contraseña = nuevaContraseña; // Considera hashear la contraseña antes de guardarla

    // Guardar los cambios en el archivo `db.json`
    writeDb(db); // Función para guardar los cambios en la base de datos

    // Devolver el usuario actualizado
    res.json({ success: true, data: usuario });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar la contraseña." });
  }
});

module.exports = router;
