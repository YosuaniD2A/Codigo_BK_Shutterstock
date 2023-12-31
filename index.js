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
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage });
let activeCredential;

// Utility function to download images
const saveImages = async (imageUrl) => {
  const imageId = getImageIdFromUrl(imageUrl.url);
  const options = {
    url: imageUrl.url,
    dest: `C:/Users/yborg/OneDrive/Documents/Codigo_BK_Shutterstock/images/${imageId}.jpg`,
  };
  try {
    const { filename } = await download.image(options);
    console.log("Saved to", filename);
  } catch (err) {
    console.error(err);
  }
};

function getImageIdFromUrl(imageUrl) {
  const parts = imageUrl.split('/');
  let name = parts[parts.length - 1].split('.')[0];

  if (!name.startsWith("shutterstock_")) {
    return `shutterstock_${name}`;
  }
  return name;
}


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

      const imageMetadataPromises = await Promise.all(listOfIds.map(async (elem) => {
        const getInfoOfImage = await factoryShutterstock(
          process.env.SHUTTERSTOCK_COMMERCIAL_TOKEN
        ).getImageDataWithCredentials(elem.shutterstock_id, "Commercial");

        //console.log(getInfoOfImage);
        if (getInfoOfImage === 'undefined' || getInfoOfImage.errors) {
          console.log(`Error con el ID ${elem.shutterstock_id}`);
          return {
            shutterstock_id: elem.shutterstock_id,
            error: `Problema con el ID ${elem.shutterstock_id}`
          }
        }
        else {
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
        }

      })
      );


      const imageMetadataList = await Promise.all(imageMetadataPromises);
      //console.log(imageMetadataList);

      const insertedPromises = await Promise.all(imageMetadataList.map(async (imageMetadata) => {
        return factoryShutterstock(process.env.SHUTTERSTOCK_COMMERCIAL_TOKEN).insertDB(imageMetadata, "Commercial");
      }));
      //console.log(insertedPromises);
      // const result = await Promise.all(insertedPromises);

      const result = insertedPromises.forEach(elem => {
        if (elem !== null) {
          if (elem.url)
            saveImages(elem);
          else
            console.log("Archivo existente en la BD, ya debe estar descargado...");
        }
      });

      res.status(200).json({
        message: "Proceso de obtencion de imagenes COMERCIALES satisfactorio...",
        //data: [...result],
      });
    } catch (error) {
      console.log(error.response?.data || error);
    }
  }
);

// Endpoint for the Editorial Shutterstock account
app.post("/licenseImagesEditorial", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const listOfIds = await importCsv(
      fs.createReadStream(filePath).pipe(csv())
    );


    const imageMetadataPromises = await Promise.all(listOfIds.map(async (elem) => {
      const getInfoOfImage = await factoryShutterstock(
        process.env.SHUTTERSTOCK_EDITORIAL_TOKEN
      ).getImageDataWithCredentials(elem.shutterstock_id, "Editorial");

      if (getInfoOfImage == undefined || getInfoOfImage.errors) {
        console.log(`Error con el ID ${elem.shutterstock_id}`);
        return {
          shutterstock_id: elem.shutterstock_id,
          error: `Problema con el ID ${elem.shutterstock_id}`
        }
      }
      else {
        return {
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
      }
    })
    );

    const imageMetadataList = await Promise.all(imageMetadataPromises);
    console.log(imageMetadataList);

    const insertedPromises = await Promise.all(imageMetadataList.map(async (imageMetadata) => {
      return factoryShutterstock(process.env.SHUTTERSTOCK_EDITORIAL_TOKEN).insertDB(imageMetadata, "Editorial");
    }))//TODO Esto se puso en un Promise all
    console.log(insertedPromises);
    //const result = await Promise.all(insertedPromises);

    const result = insertedPromises.forEach(elem => {
      if (elem !== null) {
        if (elem.url)
          saveImages(elem);
        else
          console.log("Archivo existente en la BD, ya debe estar descargado...");
      }
    });

    res.status(200).json({
      message: "Proceso de obtencion de imagenes EDITORIALES satisfactorio...",
      //data: [...result],
    });
  } catch (error) {
    console.log(error.response?.data || error);
  }
});

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
    activeCredential = credentials[0];

    const getImageData = await factoryShutterstock(
      credentials[0]
    ).getImageDataWithCredentials(imageId, "Editorial");

    if (getImageData.error) {
      activeCredential = credentials[1];
      return await factoryShutterstock(
        credentials[1]
      ).getImageDataWithCredentials(imageId, "Editorial");
    }

    return { ...getImageData, actCred: activeCredential };
  } catch (error) {
    console.log("Problema con la obtencion de los datos de la imagen");
    console.error(error);
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

  const getImageDataWithCredentials = async (imageId, licenseType) => {
    try {
      if (licenseType === "Commercial") {
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
          `${process.env.API_URL_BASE
          }editorial/images/${imageId}?${params.toString()}`,
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

  const licenseImage = async (imageId, licenseType) => {
    try {
      const headers = {
        "Content-type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${credentials}`,
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
        if (credentials === process.env.SHUTTERSTOCK_EDITORIAL_TOKEN) {
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
            `${process.env.API_URL_BASE}editorial/images/licenses`,
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
            `${process.env.API_URL_BASE}editorial/images/licenses`,
            {
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${credentials}`,
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

  const insertDB = async (imageMetadata, licenseType) => {
    try {
      const [result] = await getImageMetadata(imageMetadata.shutterstock_id);
      if (!result[0]) {
        let getImageLicense;
        if (licenseType === "Commercial") {
          getImageLicense = await licenseImage(
            imageMetadata.shutterstock_id,
            "Commercial"
          );
          //console.log(getImageLicense);
          if (getImageLicense.data) {
            if (getImageLicense.data[0].license_id) {
              imageMetadata.license_id = getImageLicense.data[0].license_id;
              const [data] = await insertImageCommercialMetadata(imageMetadata);
              return getImageLicense.data[0].download
            } else {
              return null;
            }
          } else {
            return null;
          }
        } else {
          getImageLicense = await licenseImage(
            imageMetadata.shutterstock_id,
            "Editorial"
          );
          console.log(getImageLicense);
          if (getImageLicense.data) {
            if (getImageLicense.data[0].license_id) {
              imageMetadata.license_id = getImageLicense.data[0].license_id;
              const [data] = await insertImageEditorialMetadata(imageMetadata);
              return getImageLicense.data[0].download
            } else {
              return null
            }
          } else {
            return null;
          }
        }
        //saveImages(getImageLicense.data[0].download);

        //return "Archivo registrado y guardado";
      }

      return `Archivo existente este ID: ${imageMetadata.shutterstock_id} en la BD`;

    } catch (error) {
      if (error.code && error.code === 'ER_DUP_ENTRY') {
        console.log("Mensaje:", error);
        return "Archivo existente en la BD"
      } else {
        console.log(error);
        return { error: `Error al procesar el archivo con ID: ${imageMetadata.shutterstock_id}` };
      }
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
