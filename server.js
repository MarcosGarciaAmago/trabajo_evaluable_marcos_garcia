const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "seguros.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const REGEX_ID = /^ID\d{5}$/;
const REGEX_MATRICULA = /^[0-9]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
const VALID_TRANSMISION = ["Automática", "Manual"];
const VALID_COMB_ELECTRICO = ["Combustión", "Eléctrico"];

async function readPolizas() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writePolizas(polizas) {
  await fs.writeFile(DATA_FILE, JSON.stringify(polizas, null, 2), "utf8");
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validatePoliza(poliza, { isUpdate = false } = {}) {
  const errors = [];

  const requiredFields = [
    "id_poliza",
    "vigencia",
    "matricula",
    "edad_coche",
    "edad_tomador",
    "cilindrada",
    "cilindros",
    "transmision",
    "comb_electrico",
    "peso",
    "siniestro",
  ];

  for (const field of requiredFields) {
    if (
      poliza[field] === undefined ||
      poliza[field] === null ||
      poliza[field] === ""
    ) {
      errors.push(`El campo ${field} es obligatorio.`);
    }
  }

  if (!REGEX_ID.test(poliza.id_poliza || "")) {
    errors.push("id_poliza debe tener formato IDXXXXX.");
  }

  if (!REGEX_MATRICULA.test(poliza.matricula || "")) {
    errors.push("matricula no cumple formato español válido.");
  }

  if (!isIntegerInRange(Number(poliza.vigencia), 1, 21)) {
    errors.push("vigencia debe estar entre 1 y 21.");
  }

  if (!isIntegerInRange(Number(poliza.edad_coche), 0, 10)) {
    errors.push("edad_coche debe estar entre 0 y 10.");
  }

  if (!isIntegerInRange(Number(poliza.edad_tomador), 18, 90)) {
    errors.push("edad_tomador debe estar entre 18 y 90.");
  }

  if (!VALID_TRANSMISION.includes(poliza.transmision)) {
    errors.push("transmision solo admite Automática o Manual.");
  }

  if (!VALID_COMB_ELECTRICO.includes(poliza.comb_electrico)) {
    errors.push("comb_electrico solo admite Combustión o Eléctrico.");
  }

  if (!isIntegerInRange(Number(poliza.siniestro), 0, 1)) {
    errors.push("siniestro solo admite 0 o 1.");
  }

  const integerFields = ["cilindrada", "cilindros", "peso"];
  for (const field of integerFields) {
    if (!Number.isInteger(Number(poliza[field])) || Number(poliza[field]) < 0) {
      errors.push(`${field} debe ser un número entero no negativo.`);
    }
  }

  if (isUpdate) {
    if (poliza.id_poliza_original && poliza.id_poliza_original !== poliza.id_poliza) {
      errors.push("No se permite modificar id_poliza.");
    }
    if (poliza.matricula_original && poliza.matricula_original !== poliza.matricula) {
      errors.push("No se permite modificar matricula.");
    }
  }

  return errors;
}

app.get("/polizas", async (_req, res) => {
  const polizas = await readPolizas();
  res.json(polizas);
});

app.get("/polizas/:id_poliza", async (req, res) => {
  const polizas = await readPolizas();
  const poliza = polizas.find((p) => p.id_poliza === req.params.id_poliza);
  if (!poliza) {
    return res.status(404).json({ error: "Póliza no encontrada." });
  }
  res.json(poliza);
});

app.post("/polizas", async (req, res) => {
  const polizas = await readPolizas();
  const nueva = req.body;
  const errors = validatePoliza(nueva);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  if (polizas.some((p) => p.id_poliza === nueva.id_poliza)) {
    return res.status(400).json({ errors: ["id_poliza ya existe."] });
  }
  if (polizas.some((p) => p.matricula === nueva.matricula)) {
    return res.status(400).json({ errors: ["matricula ya existe."] });
  }

  const nuevaTipada = {
    ...nueva,
    vigencia: Number(nueva.vigencia),
    edad_coche: Number(nueva.edad_coche),
    edad_tomador: Number(nueva.edad_tomador),
    cilindrada: Number(nueva.cilindrada),
    cilindros: Number(nueva.cilindros),
    peso: Number(nueva.peso),
    siniestro: Number(nueva.siniestro),
  };

  polizas.push(nuevaTipada);
  await writePolizas(polizas);
  res.status(201).json(nuevaTipada);
});

app.put("/polizas", async (req, res) => {
  const polizas = await readPolizas();
  const actualizada = req.body;
  const index = polizas.findIndex((p) => p.id_poliza === actualizada.id_poliza);

  if (index === -1) {
    return res.status(404).json({ error: "Póliza no encontrada." });
  }

  const existing = polizas[index];
  const errors = validatePoliza(
    {
      ...actualizada,
      id_poliza_original: existing.id_poliza,
      matricula_original: existing.matricula,
    },
    { isUpdate: true }
  );
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const nuevaTipada = {
    ...actualizada,
    vigencia: Number(actualizada.vigencia),
    edad_coche: Number(actualizada.edad_coche),
    edad_tomador: Number(actualizada.edad_tomador),
    cilindrada: Number(actualizada.cilindrada),
    cilindros: Number(actualizada.cilindros),
    peso: Number(actualizada.peso),
    siniestro: Number(actualizada.siniestro),
  };

  polizas[index] = nuevaTipada;
  await writePolizas(polizas);
  res.json(nuevaTipada);
});

app.delete("/polizas/:id_poliza", async (req, res) => {
  const polizas = await readPolizas();
  const newPolizas = polizas.filter((p) => p.id_poliza !== req.params.id_poliza);
  if (newPolizas.length === polizas.length) {
    return res.status(404).json({ error: "Póliza no encontrada." });
  }
  await writePolizas(newPolizas);
  res.json({ message: "Póliza eliminada correctamente." });
});

app.get("/estadisticas", async (req, res) => {
  const { transmision, comb_electrico, siniestro } = req.query;
  const polizas = await readPolizas();

  const filtradas = polizas.filter((p) => {
    if (transmision && p.transmision !== transmision) return false;
    if (comb_electrico && p.comb_electrico !== comb_electrico) return false;
    if (siniestro !== undefined && siniestro !== "" && String(p.siniestro) !== String(siniestro)) return false;
    return true;
  });

  const total = filtradas.length;
  const conSiniestro = filtradas.filter((p) => p.siniestro === 1).length;
  const sinSiniestro = total - conSiniestro;

  const mediaEdadCoche =
    total === 0 ? 0 : filtradas.reduce((acc, p) => acc + p.edad_coche, 0) / total;
  const mediaEdadTomador =
    total === 0 ? 0 : filtradas.reduce((acc, p) => acc + p.edad_tomador, 0) / total;

  res.json({
    total,
    conSiniestro,
    sinSiniestro,
    porcentajeConSiniestro: total === 0 ? 0 : (conSiniestro / total) * 100,
    porcentajeSinSiniestro: total === 0 ? 0 : (sinSiniestro / total) * 100,
    mediaEdadCoche,
    mediaEdadTomador,
  });
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
