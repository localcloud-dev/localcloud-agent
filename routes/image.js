/*
    image.js
    Methods to manage images
*/

const storage = require("../utils/storage");

module.exports = function (app) {

    //Update an image's status
    app.post('/image/status', async function (req, res) {

        const image_id = req.body.image_id;
        const status = req.body.status;
        global.logger.info(`Update status of image_id:${image_id} to "${status}"`);

        await storage.update_image_status(image_id, status);

        res.statusCode = 200;
        res.end(JSON.stringify({}));

    });

}

