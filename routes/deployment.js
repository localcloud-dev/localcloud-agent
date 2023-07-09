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
const gitlog = require("gitlog").default;

function create_restart_query() {

    //Get running containers from Podman
    exec(`podman ps --format json`, {
        cwd: homedir
    }, function (err, stdout, stderr) {
        if (err == undefined || err == null) {

            //Parse response
            const containers = JSON.parse(stdout);

            //ToDo: Check if registry container is online, if not - start it
            //We should start registry only on a root node and later on special build machines

            global.services.forEach((service, index) => {
                service.environments.forEach((environment, index) => {
                    if (environment.status == "deployed") {

                        if (containers.find(container => container.Names[0] === environment.image_name) == undefined) {

                            environment.status = "deploying";
                            const image_name = environment.image_name;

                            global.logger.info(`Container ${image_name} not found. Restarting...`);

                            exec(`podman start ${image_name}`, {
                                cwd: `${homedir}/${image_name}`
                            }, function (err, stdout, stderr) {
                                if (err == undefined || err == null) {

                                    global.logger.info(`Container ${image_name} has been restarted`);
                                    environment.status = "deployed";
                                    storage.save_services();
                                } else {
                                    global.logger.error(`Container ${image_name} cannot be restarted. Error: ${err}`);
                                }
                            });
                        }

                    }
                });
            });

        }
    });
}

async function check_deployment_query() {

    //Reload services and apps from redis
    /*const services = await global.redis_client.get('services');
    if (services != undefined) {
        global.services = JSON.parse(services);
    }*/

    global.services.forEach((service, index) => {

        //Remove all environments with status "removed"
        var index = service.environments.findIndex(environment => environment.status === 'removed');
        while (index !== -1) {
            is_should_save = true;
            service.environments.splice(index, 1);
            index = service.environments.findIndex(environment => environment.status === 'removed');
            //Save services when we get index === -1
            if (index === -1) {
                storage.save_services();
                //Reload Proxy Server
                proxy.proxy_reload();
            }
        }

        service.environments.forEach((environment, index) => {

            //Get info about this server
            let me_node = storage.get_vpn_node_by_id(global.service_node_config.server_id);

            //Check if we should pull a container from the container registry and start it on this server
            //Note: Each server from the list environment->servers has the field "status", we check "status" inside a server not environment
            if (environment.image_status == 'ready'){
                environment.servers.forEach((server, index) => {
                    if (server.status == 'to_deploy' && me_node.id == server.id) {
                        server.status = 'deploying';
                        global.logger.info(`Deploying on server: ${me_node.id}: ${me_node.ip}`);
                        //Pull a container from a container registry
                        //We set --tls-verify=false because we push to localhost
                        //Also all traffic between servers within VPN is encrypted
                        global.logger.info(`Pulling a container: ${environment.image_id}`);
                        exec(`podman image pull 192.168.202.1:7000/${environment.image_id} --tls-verify=false`, {
                            cwd: `${homedir}`
                        }, function (err, stdout, stderr) {
                            global.logger.info(`podman pull output: ${stdout}, error output: ${stderr}`);

                            if (err == undefined || err == null) {
                                server.status = 'started';
                                global.logger.info(`Image ${environment.image_id} has been pulled from the container registry`);
                                //Getting a free port and starting a container
                                portfinder.getPort({
                                    port: 6000,    // minimum port
                                    stopPort: 8900 // maximum port
                                }, function (err, available_port) {
                                    if (err != null) {
                                        global.logger.error(`Cannot get a free port: ${err}`);
                                        return;
                                    }
                                    global.logger.info(`A free port has ben found: ${available_port}`);

                                    global.logger.info(`Running a command: podman run -p ${available_port}:${environment.port} -d ${environment.image_id} --name ${environment.image_id}`);
        
                                    exec(`podman container run -p ${available_port}:${environment.port} -d --name ${environment.image_id} ${environment.image_id}`, {
                                        cwd: `${homedir}`
                                    }, function (err, stdout, stderr) {
                                        global.logger.info(`podman run output: ${stdout}, error output: ${stderr}`);

                                        if (err == undefined || err == null) {
                                            global.logger.info(`Container ${environment.image_id} has been started`);

                                            //Reload Proxy Server
                                            //proxy.proxy_reload();
                                            //environment.status = "deployed";
                                            //storage.save_services();

                                        }
                                    });


                                });
                            
                            }

                        });
                    }
                });
            }

            //Check if we should build a new image for this environment
            //Note: We build images only on servers with "build_machine" type
            if (environment.image_status == 'to_build' && me_node.type.indexOf("build_machine") != -1) {

                environment.image_status = 'clone';
                portfinder.getPort({
                    port: 6000,    // minimum port
                    stopPort: 8900 // maximum port
                }, function (err, available_port) {
                    if (err != null) {
                        global.logger.error(`Cannot get a free port: ${err}`);
                        return;
                    }

                    const git_url = service.git_url;
                    const name = service.name;
                    const branch = environment.branch;
                    const environment_name = environment.name;
                    const repository_name = `${name}-${crypto.randomUUID()}`;
                    //environment.exposed_ports = [available_port];

                    //const prev_container_name = environment.image_name; //We should stop old container and remove image after we star a new container


                    //const exposed_port = environment.exposed_ports[0];
                    //const service_port = environment.port;

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
                                        global.logger.info(`Getting information about the latest commit using "git log"`);

                                        //Get Git commits and information about the latest commit
                                        const options = {
                                            repo: `${homedir}/${repository_name}`,
                                            number: 20,
                                            fields: ["hash", "abbrevHash", "subject", "authorName", "authorDateRel"],
                                            execOptions: { maxBuffer: 1000 * 1024 },
                                          };
                                          
                                          // Synchronous
                                          const commits = gitlog(options);

                                                //Now we deploy only the latest commit in a branch (the first commit in the array from stdout)
                                                const commit_to_deploy = commits[0];
                                                global.logger.info(`Commit to deploy: ${JSON.stringify(commit_to_deploy)}`);

                                                environment.commit_id = commit_to_deploy.hash;
                                                environment.image_id = `${name}-${environment_name}-${environment.commit_id}`;

                                                //Update the status
                                                environment.image_status = 'build';

                                                //Start a container
                                                //ToDo check if the repository has a Docker file
                                                exec(`podman build . -t ${environment.image_id}`, {
                                                    cwd: `${homedir}/${repository_name}`
                                                }, function (err, stdout, stderr) {
                                                    global.logger.error(`${stdout}: ${stderr}`);

                                                    if (err == undefined || err == null) {

                                                        global.logger.info(`Image ${environment.image_id} has been built`);
                                                        global.logger.info(`Pushing the image ${environment.image_id} to the container registry`);

                                                        //Update the status
                                                        environment.image_status = 'registry_push';

                                                        //Tag and push the image to the container registry
                                                        exec(`podman image tag ${environment.image_id} localhost:7000/${environment.image_id}`, {
                                                            cwd: `${homedir}/${repository_name}`
                                                        }, function (err, stdout, stderr) {
                                                            global.logger.info(`${stdout}: ${stderr}`);
        
                                                            if (err == undefined || err == null) {

                                                                //Push to the container registry
                                                                //We set --tls-verify=false because we push to localhost
                                                                //Also all traffic between servers within VPN is encrypted
                                                                exec(`podman image push localhost:7000/${environment.image_id} --tls-verify=false`, {
                                                                    cwd: `${homedir}/${repository_name}`
                                                                }, function (err, stdout, stderr) {
                                                                    global.logger.info(`${stdout}: ${stderr}`);
                
                                                                    if (err == undefined || err == null) {
                                                                        environment.image_status = 'ready';
                                                                        global.logger.info(`Image ${environment.image_id} has been pushed to the container registry`);
                                                                        storage.save_services();
                                                                    }

                                                                });

        
                                                            }
                                                        });


                                                        //podman run
                                                        /*
                                                        global.logger.info(`Run the image ${repository_name}`);
                                                        global.logger.info(`podman run -p ${exposed_port}:${service_port} -d ${repository_name} --name ${repository_name}`);
        
                                                        exec(`podman run --name ${repository_name} -p ${exposed_port}:${service_port} -d ${repository_name}`, {
                                                            cwd: `${homedir}/${repository_name}`
                                                        }, function (err, stdout, stderr) {
                                                            if (err == undefined || err == null) {
                                                                global.logger.info(`Container ${repository_name} has been started`);
        
                                                                //Reload Proxy Server
                                                                proxy.proxy_reload();
                                                                environment.status = "deployed";
                                                                storage.save_services();
        
                                                                //Stop an old container and remove an old image
                                                                if (prev_container_name != undefined){
                                                                    exec(`podman stop ${prev_container_name}`, function (err, stdout, stderr) {
                                                                        if (err == undefined || err == null) {
                                                                            global.logger.info(`Container ${prev_container_name} has been stopped because not used anymore`);
                                                                        }else{
                                                                            global.logger.error(`Cannot stop container ${prev_container_name}. Error: ${err}`);
                                                                        }
                                                                        exec(`podman image rm ${prev_container_name} -f`, function (err, stdout, stderr) {
                                                                            if (err == undefined || err == null) {
                                                                                global.logger.info(`Image ${prev_container_name} has been removed because not used anymore`);
                                                                            }else{
                                                                                global.logger.error(`Cannot remove image ${prev_container_name}. Error: ${err}`);
                                                                            }
                                                                        });
                                                                    });
                                                                }
        
                                                            } else {
                                                                global.logger.error(`Cannot start the image ${repository_name}: ${err}`);
                                                            }
                                                        });*/
                                                        //End podman run

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

            } else if (environment.status == "to_remove") {
                environment.status = "removed";
                //Remove a container and image for this environment
                const container_name = environment.image_name;
                exec(`podman stop ${container_name}`, function (err, stdout, stderr) {
                    if (err == undefined || err == null) {
                        global.logger.info(`Container ${container_name} has been stopped because not used anymore`);
                    } else {
                        global.logger.error(`Cannot stop container ${container_name}. Error: ${err}`);
                    }
                    exec(`podman image rm ${container_name} -f`, function (err, stdout, stderr) {
                        if (err == undefined || err == null) {
                            global.logger.info(`Image ${container_name} has been removed because not used anymore`);
                        } else {
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

module.exports = { check_deployment_query, create_restart_query }

