/*
    deploy.js
    Methods for project deployment
*/

const storage = require("../utils/storage");
const auth = require("../utils/auth");

module.exports = function (app) {

    //Handles Webhooks from Git repository
    //Now only Bitbucket repositories are supported
    app.post('/deploy/:api_token', async function (req, res) {
        if (await auth.validate_token(req.params.api_token) == false){
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Invalid api key" }));
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


