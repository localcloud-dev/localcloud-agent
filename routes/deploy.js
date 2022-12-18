/*
    deploy.js
    Methods for project deployment
*/

const storage = require("../utils/storage");

module.exports = function (app) {

    app.post('/deploy/:api_key', function (req, res) {
        if (req.params.api_key != "111") {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Invalid token. Check that a hook url you added to this git repository is correct." }));
            return;
        }

        if (req.body.repository == undefined) {
            res.statusCode = 403;
            res.end("");
            return;
        }

        const repo_name = req.body.repository.name;
        const repo_full_name = req.body.repository.full_name;
        const updated_branch = req.body.push.changes[0].new.name;

        console.log(repo_name + " " + updated_branch);

        //Update projects
        let service = global.projects.find(service => service.full_name === repo_full_name);
        if (service != undefined) {
            var environment = service.environments.find(environment => environment.branch === updated_branch);
            if (environment != undefined) {
                environment.status = "to_deploy";
                storage.save_projects();
            }
        }
        res.statusCode = 200;
        res.end(JSON.stringify({}));
    });
}


