const express = require("express");
const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const cors = require("cors");
const download = require("image-downloader");
const { v4: uuidv4 } = require("uuid");
const {
  getImageMetadata,
  insertImageCommercialMetadata,
  insertImageEditorialMetadata,
} = require("./model/sqlQuery");
require("dotenv").config();

app.use(cors());

const port = 8000;

// Configurar Multer para procesar el archivo CSV
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname +
      "-" +
      uniqueSuffix +
      path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage });
let activeCredential;

// Utility function to download images
const saveImages = async (imageUrl) => {
  const options = {
    url: imageUrl.url,
    dest:
      "C:/Users/yborg/OneDrive/Escritorio/shutterstock_commercial_bknd/assets/images",
  };
  try {
    const { filename } = await download.image(options);
    console.log("Saved to", filename);
  } catch (err) {
    console.error(err);
  }
};

// Endpoint for the Commercial Shutterstock account
app.post(
  "/licenseImagesCommercial",
  upload.single("file"),
  async (req, res) => {
    try {
      const filePath = req.file.path;
      const listOfIds = await importCsv(
        fs.createReadStream(filePath).pipe(csv())
      );

      const imageMetadataPromises = listOfIds.map(async (elem) => {
        const getInfoOfImage = await factoryShutterstock(process.env.SHUTTERSTOCK_COMMERCIAL_TOKEN).getImageDataWithCredentials(
          elem.shutterstock_id,
          "Commercial"
        );

        return {
          shutterstock_id: getInfoOfImage.id,
          description: getInfoOfImage.description,
          categories: getInfoOfImage.categories
            .map((obj) => obj.name)
            .join(","),
          keywords: getInfoOfImage.keywords.toString(),
          contributor: getInfoOfImage.contributor.id,
          is_adult: getInfoOfImage.is_adult,
          displayname: getInfoOfImage.assets.huge_jpg.display_name,
          file_size: getInfoOfImage.assets.huge_jpg.file_size,
          format: getInfoOfImage.assets.huge_jpg.format,
          is_licensable: getInfoOfImage.assets.huge_jpg.is_licensable,
          requested_date: new Date(),
          filename: getInfoOfImage.original_filename,
          license_id: "",
        };
      });

      const imageMetadataList = await Promise.all(imageMetadataPromises);
      const insertedPromises = imageMetadataList.map(async (imageMetadata) => {
        return factoryShutterstock()
          .insertDB(imageMetadata, "Commercial", activeCredential);
      });

      await Promise.all(insertedPromises);

      res.send("Proceso de obtencion de imagenes COMERCIALES satisfactorio...");
    } catch (error) {
      console.error(error.response?.data || error.message);
    }
  }
);

// Endpoint for the Editorial Shutterstock account
app.post(
  "/licenseImagesEditorial",
  upload.single("file"),
  async (req, res) => {
    try {
      const filePath = req.file.path;
      const listOfIds = await importCsv(
        fs.createReadStream(filePath).pipe(csv())
      );

      const processedImages = await Promise.all(
        listOfIds.map(async (elem) => {
          // let getInfoOfImage = await tryGetImageData(
          //   elem.shutterstock_id
          // );
          console.log(elem);
          let getInfoOfImage;

          getInfoOfImage = await tryGetImageData(
            elem.shutterstock_id
          );
          // let retry = 0;

          // while (retry < 2) {
          //   getInfoOfImage = await tryGetImageData(
          //     elem.shutterstock_id
          //   );
          //   if (
          //     getInfoOfImage &&
          //     getInfoOfImage.error === "Not Found"
          //   ) {
          //     console.log(
          //       "No se encontro este archivo, retrying..."
          //     );
          //     retry++;
          //   } else {
          //     break;
          //   }
          // }

          if (getInfoOfImage) {
            const imageMetadata = {
              shutterstock_id: getInfoOfImage.id,
              description: getInfoOfImage.description,
              categories: getInfoOfImage.categories
                .map((obj) => obj.name)
                .join(","),
              keywords: getInfoOfImage.keywords.toString(),
              displayname: getInfoOfImage.assets.original.display_name,
              is_licensable: getInfoOfImage.assets.original.is_licensable,
              requested_date: new Date(),
              filename: getInfoOfImage.title,
              license_id: "",
            };

            return imageMetadata;
          }
        })
      );

      // console.log(processedImages.length);

      const insertedPromises = processedImages.map(async (imageMetadata) => {
        return factoryShutterstock().insertDB(
          imageMetadata,
          "Editorial",
          activeCredential
        );
      });

      await Promise.all(insertedPromises);

      res.send(
        "Proceso de obtencion de imagenes EDITORIALES satisfactorio..."
      );
    } catch (error) {
      console.error(error.response?.data || error.message);
    }
  }
);

// Import the CSV file
const importCsv = async (stream) => {
  return new Promise((resolve, reject) => {
    let listOfIds = [];

    stream.on("data", (row) => {
      listOfIds.push({
        shutterstock_id: row.id,
      });
    });
    stream.on("end", () => resolve(listOfIds));
  });
};

// Function to attempt to get the image with different credentials
async function tryGetImageData(imageId) {
  try {
    const credentials = [
      process.env.SHUTTERSTOCK_EDITORIAL_TOKEN,
      process.env.SHUTTERSTOCK_COMMERCIAL_TOKEN,
    ];
    let lastError;

    const getImageData = await factoryShutterstock(
      credentials[0]
    ).getImageDataWithCredentials(imageId, "Editorial");

    if (!getImageData.error) {
      activeCredential = credentials[0];
      return getImageData;
    } else {
      activeCredential = credentials[1];
      return await factoryShutterstock(
        credentials[1]
      ).getImageDataWithCredentials(imageId, "Editorial");
    }

    // for await (const credential of credentials) {
    //   const getImageData = await factoryShutterstock(
    //     credential
    //   ).getImageDataWithCredentials(imageId, "Editorial");

    //   if (!getImageData.error) {
    //     activeCredential = credential;
    //     return getImageData;
    //   } else {
    //     lastError = getImageData.error;
    //   }
    // }

    console.error("Todas las credenciales fallaron:", lastError);
    return null;
  } catch (error) {
    console.error(error.message);
    //return null;
  }
}

// Factory
const factoryShutterstock = (credentials) => {
  const headers = {
    "Content-type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${credentials}`,
  };

  const getImageDataWithCredentials = async (
    imageId,
    licenseType
  ) => {
    try {
      if (licenseType === "Commercial") {
        activeCredential = credentials;
        const getImageData = await fetch(
          `${process.env.API_URL_SANDBOX}images/${imageId}`,
          {
            headers,
          }
        );
        return await getImageData.json();
      } else {
        const params = new URLSearchParams();
        params.append("country", "USA");
        const getImageData = await fetch(
          `${process.env.API_URL_SANDBOX}editorial/images/${imageId}?${params.toString()}`,
          {
            headers,
          }
        );
        return await getImageData.json();
      }
    } catch (error) {
      console.error(error.message);
      //return null;
    }
  };

  const licenseImage = async (
    imageId,
    licenseType,
    credential
  ) => {
    try {
      const headers = {
        "Content-type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${credential}`,
      };
      if (licenseType === "Commercial") {
        const bodyData = {
          images: [
            {
              image_id: imageId,
              subscription_id: process.env.SUBSCRIPTION_ID,
              price: 0,
              metadata: {
                customer_id: "",
              },
            },
          ],
        };
        const body = JSON.stringify(bodyData);
        const licenseOfimage = await fetch(
          `${process.env.API_URL_SANDBOX}images/licenses`,
          {
            headers,
            method: "POST",
            body,
          }
        );

        return await licenseOfimage.json();
      } else {
        let licenseOfimage;
        const order_idRandom = uuidv4();
        if (credential === process.env.SHUTTERSTOCK_EDITORIAL_TOKEN) {
          const bodyData = {
            editorial: [
              {
                editorial_id: imageId,
                license: "premier_editorial_all_media",
                metadata: {
                  order_id: order_idRandom,
                },
              },
            ],
            country: "USA",
          };
          const body = JSON.stringify(bodyData);
          licenseOfimage = await fetch(
            `${process.env.API_URL_SANDBOX}editorial/images/licenses`,
            {
              headers,
              method: "POST",
              body,
            }
          );
        } else {
          const bodyData = {
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
          const body = JSON.stringify(bodyData);
          licenseOfimage = await fetch(
            `${process.env.API_URL_SANDBOX}editorial/images/licenses`,
            {
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${credential}`,
              },
              method: "POST",
              body,
            }
          );
        }

        return await licenseOfimage.json();
      }
    } catch (error) {
      console.error(error.message);
      return null;
    }
  };

  const insertDB = async (
    imageMetadata,
    licenseType,
    credential
  ) => {
    try {
      const [result] = await getImageMetadata(
        imageMetadata.shutterstock_id
      );
      if (!result[0]) {
        let getImageLicense;
        if (licenseType === "Commercial") {
          getImageLicense = await licenseImage(
            imageMetadata.shutterstock_id,
            "Commercial",
            credential
          );
          imageMetadata.license_id =
            getImageLicense.data[0].license_id;
          const [data] = await insertImageCommercialMetadata(
            imageMetadata
          );
        } else {
          getImageLicense = await licenseImage(
            imageMetadata.shutterstock_id,
            "Editorial",
            credential
          );
          imageMetadata.license_id =
            getImageLicense.data[0].license_id;
          const [data] = await insertImageEditorialMetadata(
            imageMetadata
          );
        }

        saveImages(getImageLicense.data[0].download);

        return 'Archivo registrado y guardado';
      }
      return 'Ya existe este archivo';
    } catch (error) {
      error.response && error.response.data
        ? console.error('Error en la respuesta de la API:', error.response.data)
        : console.error('Error desconocido:', error);

      return 'Error al procesar el archivo';
    }
  };

  return {
    getImageDataWithCredentials,
    licenseImage,
    insertDB,
  };
};

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});



