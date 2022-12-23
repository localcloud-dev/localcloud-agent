/*
    deployment.js
    Methods to deploy services
*/

const exec = require('child_process').exec;
const crypto = require('crypto');
const homedir = require('os').homedir();
const storage = require("../utils/storage");
const proxy = require("./proxy");
const portfinder = require('portfinder');

function check_deployment_query() {

    global.projects.forEach((service, index) => {

        //Remove all environments with status "removed"
        var index = service.environments.findIndex(environment => environment.status === 'removed');
        while (index !== -1) {
            is_should_save = true;
            service.environments.splice(index, 1);
            index = service.environments.findIndex(environment => environment.status === 'removed');
            //Save services when we get index === -1
            if (index === -1){
                storage.save_services();
                //Reload Proxy Server
                proxy.proxy_reload();
            }
        }

        service.environments.forEach((environment, index) => {

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

                    const git_url = service.git_url;
                    const name = service.name;
    
                    const branch = environment.branch;
                    const environment_name = environment.name;
                    environment.exposed_ports = [available_port];

                    const prev_container_name = environment.image_name; //We should stop old container and remove image after we star a new container
                    const repository_name = `${name}-${environment_name}-${crypto.randomUUID()}`;
                    environment.image_name = repository_name;

                    //Update saved services
                    storage.save_services();

                    const exposed_port = environment.exposed_ports[0];
                    const service_port = environment.port;

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

                                                global.logger.info(`podman run -p ${exposed_port}:${service_port} -d ${repository_name} --name ${repository_name}`);

                                                exec(`podman run --name ${repository_name} -p ${exposed_port}:${service_port} -d ${repository_name}`, {
                                                    cwd: `${homedir}/${repository_name}`
                                                }, function (err, stdout, stderr) {
                                                    if (err == undefined || err == null) {
                                                        global.logger.info(`Container ${repository_name} has been started`);

                                                        //Reload Proxy Server
                                                        proxy.proxy_reload();

                                                        //Stop an old container and remove an old image
                                                        if (prev_container_name != undefined){
                                                            exec(`podman stop ${prev_container_name}`, function (err, stdout, stderr) {
                                                                if (err == undefined || err == null) {
                                                                    global.logger.error(`Container ${prev_container_name} has been stopped because not used anymore`);
                                                                }else{
                                                                    global.logger.error(`Cannot stop container ${prev_container_name}. Error: ${err}`);
                                                                }
                                                                exec(`podman image rm ${prev_container_name} -f`, function (err, stdout, stderr) {
                                                                    if (err == undefined || err == null) {
                                                                        global.logger.error(`Image ${prev_container_name} has been removed because not used anymore`);
                                                                    }else{
                                                                        global.logger.error(`Cannot remove image ${prev_container_name}. Error: ${err}`);
                                                                    }
                                                                });
                                                            });
                                                        }

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

            }else if (environment.status == "to_remove") {
                environment.status = "removed";
                //Remove a container and image for this environment
                const container_name = environment.image_name;
                exec(`podman stop ${container_name}`, function (err, stdout, stderr) {
                    if (err == undefined || err == null) {
                        global.logger.info(`Container ${container_name} has been stopped because not used anymore`);
                    }else{
                        global.logger.error(`Cannot stop container ${container_name}. Error: ${err}`);
                    }
                    exec(`podman image rm ${container_name} -f`, function (err, stdout, stderr) {
                        if (err == undefined || err == null) {
                            global.logger.info(`Image ${container_name} has been removed because not used anymore`);
                        }else{
                            global.logger.error(`Cannot remove image ${container_name}. Error: ${err}`);
                        }

                        //Mark that this environment is ready to be removed from the service
                        //We "clean" lists with environments at the begging of each check_deployment_query call

                    });
                });
            }
        });
    });

}

module.exports = {check_deployment_query}

