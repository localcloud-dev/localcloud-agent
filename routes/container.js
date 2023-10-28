/*
    container.js
    Methods to manage containers
*/

const storage = require("../utils/storage");

module.exports = function (app) {

    //Update a container's status
    app.post('/container/status', async function (req, res) {

        const container_id = req.body.container_id;
        const status = req.body.status;
        global.logger.info(`Update status of container_id:${container_id} to "${status}"`);

        await storage.update_container_status(container_id, status);

        res.statusCode = 200;
        res.end(JSON.stringify({}));

    });

}

