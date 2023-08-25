const express = require("express");
const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser"); // Para leer el contenido del CSV
const axios = require("axios"); // Para hacer peticiones HTTP
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const download = require("image-downloader");
require('dotenv').config();

app.use(cors());

const port = 8001;

// Configurar Multer para procesar el archivo CSV
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Carpeta donde se guardarán los archivos cargados
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage });

// Endpoint para subir el archivo CSV
app.post("/upload-csv", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "No se ha proporcionado ningún archivo CSV" });
  }

  const ids = []; // Array para almacenar los IDs del CSV

  // Procesar el archivo CSV
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      // Suponemos que el CSV tiene una única columna llamada "id"
      ids.push(row.shutterstock_id);
    })
    .on("end", (row) => {
      // Ya tenemos los IDs en el array "ids"
      // Ahora podemos realizar las peticiones a AWS y descargar las imágenes
      const imageUrls = [];
      console.log("ids", ids);
      // Función para realizar la petición a AWS y obtener el enlace de la imagen
      async function fetchImageUrl(id) {
        const country = "USA";
        const imageId = id;

        const apiUrl = `https://api-sandbox.shutterstock.com/v2/images/${imageId}`;
        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.SHUTTERSTOCK_GENERAL_TOKEN}`,
        };
        try {
          const response = await axios.get(apiUrl, {
            params: { country },
            headers: headers,
          });
          const order_idRandom = uuidv4();
          const data = {
            editorial: [
              {
                editorial_id: imageId,
                license: "premier_editorial_comp",
                metadata: {
                  order_id: order_idRandom,
                },
              },
            ],
            country: "USA",
          };

          const responseImgLicense = await axios.post(
            "https://api-sandbox.shutterstock.com/v2/images/licenses",
            data,
            {
              headers: headers,
            }
          );
          imageUrls.push({
            ...response.data,
            link: responseImgLicense.data.data[0].download.url,
            license_id: responseImgLicense.data.data[0].license_id,
            order_id: order_idRandom,
          });
        } catch (error) {
          console.error(
            `Error al obtener la imagen para el ID ${id}: ${error.message}`
          );
        }
      }

      // Usamos Promise.all para asegurarnos de que todas las peticiones terminen antes de continuar
      Promise.all(ids.map((id) => fetchImageUrl(id)))
        .then(() => {
          imageUrls.map(async(img) => {

            const options = {
              url: img.link,
              dest: "C:/Users/yborg/OneDrive/Escritorio/backend-ingestion-shutterstock/assets/images", // will be saved to /path/to/dest/image.jpg
            };

            await download
              .image(options)
              .then(({ filename }) => {
                console.log("Saved to", filename); // saved to /path/to/dest/image.jpg
              })
              .catch((err) => console.error(err));
          });
          res.json({ imageUrls });
        })
        .catch((error) => {
          console.error("Error al procesar las peticiones de imágenes:", error);
          res
            .status(500)
            .json({ error: "Ocurrió un error al procesar las imágenes" });
        });
    });
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
