/*
    deployment.js
    Methods for deploying projects
*/
const dotenv = require('dotenv');
dotenv.config();

const deployment_int = require("../internal/deployment_int");

module.exports = function (app) {

    app.post('/deploy/:hook_key', function (req, res) {
        if (req.params.hook_key != global.cluster_config.hook_key) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Invalid token. Check that a hook url you added to this git repository is correct." }));
            return;
        }

        const repo_name = req.body.repository.name;
        const updated_branch = req.body.push.changes[0].new.name;
        console.log(repo_name + " " + updated_branch);

        res.statusCode = 200;
        res.end(JSON.stringify({}));

        deployment_int.addProjectToQuery(repo_name, updated_branch);

    });

}

