/*
    API_URL_SANDBOX=https://api-sandbox.shutterstock.com/v2/
    order_idRandom = uuidv4();
*/

/*
// Fetch to obtain the information of a commercial image from its ID using  
// SANDBOX and the token of the account roberto@smartprintsink.com
const getImageData = await fetch(
    `${process.env.API_URL_SANDBOX}images/${imageId}`,
    {
        headers: {
            "Content-type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.SHUTTERSTOCK_COMMERCIAL_TOKEN}`,
        }
    }
);




// Fetch to obtain the information of an editorial image from its ID using 
// SANDBOX and the token of the account roberto@smartprintsink.com
const params = new URLSearchParams();
params.append("country", "USA");

const getImageData = await fetch(
    `${process.env.API_URL_SANDBOX
    }editorial/images/${imageId}?${params.toString()}`,
    {
        headers: {
            "Content-type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.SHUTTERSTOCK_COMMERCIAL_TOKEN}`,
        }
    }
);




// Fetch to obtain the information of an editorial image from its ID using 
// SANDBOX and the token of the account design@smartprintsink.com
const params = new URLSearchParams();
params.append("country", "USA");

const getImageData = await fetch(
    `${process.env.API_URL_SANDBOX
    }editorial/images/${imageId}?${params.toString()}`,
    {
        headers: {
            "Content-type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.SHUTTERSTOCK_EDITORIAL_TOKEN}`,
        }
    }
);



//-----------------------------Licenciar---------------------------------------

// Fetch to license a commercial image from your ID using SANDBOX and the 
// account token roberto@smartprintsink.com
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
        headers: {
            "Content-type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.SHUTTERSTOCK_COMMERCIAL_TOKEN}`,
        },
        method: "POST",
        body,
    }
);



// Fetch to license a editorial image from your ID using SANDBOX and the 
// account token design@smartprintsink.com 
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
const licenseOfimage = await fetch(
    `${process.env.API_URL_SANDBOX}editorial/images/licenses`,
    {
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.SHUTTERSTOCK_EDITORIAL_TOKEN}`,
        },
        method: "POST",
        body,
    }
);
*/


// Fetch to license a editorial image from your ID using SANDBOX and the 
// account token roberto@smartprintsink.com 
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
            Authorization: `Bearer ${process.env.SHUTTERSTOCK_COMMERCIAL_TOKEN}`,
        },
        method: "POST",
        body,
    }
);

/*
*/