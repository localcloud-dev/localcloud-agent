/*
    deployment.js
    Methods for project deployment
*/

const exec = require('child_process').exec;
const crypto = require('crypto');
const homedir = require('os').homedir();
const storage = require("../utils/storage");
const proxy = require("./proxy");
const portfinder = require('portfinder');

function check_deployment_query() {

    global.projects.forEach((project, index) => {

        project.environments.forEach((environment, index) => {

            if (environment.status == "to_deploy") {

                portfinder.getPort({
                    port: 6000,    // minimum port
                    stopPort: 8900 // maximum port
                }, function (err, available_port) {
                    if (err != null) {
                        global.logger.error(`Cannot get a free port: ${err}`);
                        return;
                    }

                    environment.status = "deploying";

                    const git_url = project.git_url;
                    const name = project.name;
    
                    const branch = environment.branch;
                    const environment_name = environment.name;
                    environment.exposed_ports = [available_port];

                    const repository_name = `${name}-${environment_name}-${crypto.randomUUID()}`;
                    environment.image_name = repository_name;

                    //Update saved projects
                    storage.save_projects();

                    const exposed_port = environment.exposed_ports[0];
                    const service_port = environment.service_port;

                    //Clone the repository
                    global.logger.info(`Cloning the repository:`);
                    global.logger.info(`URL: ${git_url}`);
                    global.logger.info(`Branch:  ${branch}`);

                    exec(`git clone --recurse-submodules ${git_url} ${repository_name}`, {
                        cwd: homedir
                    }, function (err, stdout, stderr) {
                        if (err == undefined || err == null) {
                            global.logger.info(`Repository ${git_url} has been cloned`);
                            if (branch != undefined) {
                                global.logger.info(`Switching to ${branch} branch`);
                                exec(`git checkout --recurse-submodules ${branch}`, {
                                    cwd: `${homedir}/${repository_name}`
                                }, function (err, stdout, stderr) {
                                    if (err == undefined || err == null) {
                                        global.logger.info(`Switched to ${branch}: ${stdout}`);

                                        //Start a container
                                        //ToDo check if the repository has a Docker file
                                        exec(`podman build . -t ${repository_name}`, {
                                            cwd: `${homedir}/${repository_name}`
                                        }, function (err, stdout, stderr) {
                                            global.logger.error(`${stdout}: ${stderr}`);

                                            if (err == undefined || err == null) {

                                                global.logger.info(`Image ${repository_name} has been built`);
                                                global.logger.info(`Run the image ${repository_name}`);

                                                exec(`podman run -p ${exposed_port}:${service_port} -d ${repository_name}`, {
                                                    cwd: `${homedir}/${repository_name}`
                                                }, function (err, stdout, stderr) {
                                                    if (err == undefined || err == null) {
                                                        global.logger.info(`Container from the image ${repository_name} has been started`);

                                                        //Reload Proxy Server
                                                        proxy.proxy_reload();

                                                    } else {
                                                        global.logger.error(`Cannot start the image ${repository_name}: ${err}`);
                                                    }
                                                });
                                            } else {
                                                global.logger.error(`Cannot build the image ${repository_name}: ${err}`);
                                            }
                                        });

                                    } else {
                                        global.logger.info(`Cannot switch to ${branch}. Error: ${err}`);
                                    }
                                });
                            }
                        } else {
                            global.logger.info(`Cannot clone the repository at ${git_url}. Error: ${err}`);
                        }
                    });

                });

            }
        });
    });

}

module.exports = {
    check_deployment_query, function(app) {

        app.post('/deploy/:api_key', function (req, res) {
            if (req.params.api_key != "111") {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Invalid token. Check that a hook url you added to this git repository is correct." }));
                return;
            }

            const repo_name = req.body.repository.name;
            if (repo_name == undefined) {
                res.statusCode = 403;
                res.end("");
                return;
            }

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
}

