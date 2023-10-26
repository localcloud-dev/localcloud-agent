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
const request = require('superagent');

async function check_deployment_query() {

    //Get info about this server
    let vpn_nodes = await storage.get_vpn_node_by_id(global.service_node_config.server_id);
    if (vpn_nodes.length > 0) {
        //Check if there are images to be built
        check_build_image(vpn_nodes[0]);

        //Check if there are any containers that should be deployed on this server
        check_deploy_container(vpn_nodes[0]);
    }

    async function check_build_image(me_node) {
        //Note: We build images only on servers with "build_machine" type
        if (JSON.parse(me_node.type).indexOf("build_machine") != -1) {

            //Get Image records with status == "to_do"
            let images = await storage.get_images_by_status("to_do");
            if (images.length > 0) {
                let image = images[0];
                const image_id = image.id;
                await storage.update_image_status(image_id, "in_progress");

                const git_url = image.git_url;
                const environment = await storage.get_environment_by_id(image.environment_id);
                if (environment == null){
                    global.logger.error(`check_build_image: Environment with id: ${image.environment_id} not found. Stopping deployment.`);
                    return;
                }
                const branch = environment.branch;
                const repository_name = `${crypto.randomUUID()}`;
                global.logger.info(`Found a new image to build: ${git_url}, branch:${branch}`);

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

                                    //environment.commit_id = commit_to_deploy.hash;

                                    //Update the status
                                    //environment.image_status = 'build';

                                    //Start a container
                                    //ToDo check if the repository has a Docker file
                                    exec(`docker build . -t ${image_id}`, {
                                        cwd: `${homedir}/${repository_name}`
                                    }, function (err, stdout, stderr) {
                                        global.logger.error(`${stdout}: ${stderr}`);

                                        if (err == undefined || err == null) {

                                            global.logger.info(`Image ${image_id} has been built`);
                                            global.logger.info(`Pushing the image ${image_id} to the container registry`);

                                            //Update the status
                                            //environment.image_status = 'registry_push';

                                            //Tag and push the image to the container registry
                                            exec(`docker image tag ${image_id} localhost:7000/${image_id}`, {
                                                cwd: `${homedir}/${repository_name}`
                                            }, function (err, stdout, stderr) {
                                                global.logger.info(`${stdout}: ${stderr}`);

                                                if (err == undefined || err == null) {

                                                    //Push to the container registry
                                                    //We set --tls-verify=false because we push to localhost
                                                    //Also all traffic between servers within VPN is encrypted
                                                    exec(`docker image push localhost:7000/${image_id}`, {
                                                        cwd: `${homedir}/${repository_name}`
                                                    }, async function (err, stdout, stderr) {
                                                        global.logger.info(`${stdout}: ${stderr}`);

                                                        if (err == undefined || err == null) {
                                                            //environment.image_status = 'ready';
                                                            global.logger.info(`Image ${image_id} has been pushed to the container registry`);
                                                            await storage.update_image_status(image.id, "done");
                                                        }

                                                    });


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
            }

        }
    }

    async function check_deploy_container(me_node) {
        //Check if we should pull a container from the container registry and start it on this server
        //Check if there containers with status to_do and target_id == id of this server
        let conatainers_to_do = await storage.get_containers_by_status_and_target_id("to_do", me_node.id);
        let conatainers_in_progress = await storage.get_containers_by_status_and_target_id("in_progress", me_node.id);

        if (conatainers_in_progress.length == 0 && conatainers_to_do.length > 0) {
            conatainers_to_do.forEach(async (container) => {
                //Check if image is built and pushed to container registry
                let image_id = container.image_id;
                let images = await storage.get_image_by_id(image_id);

                if (images.length > 0 && images[0].status == "done") {
                    let image = images[0];
                    const environment = await storage.get_environment_by_id(image.environment_id);
                    await storage.update_container_status(container.id, "in_progress");

                    global.logger.info(`Deploying on server: ${me_node.id}: ${me_node.ip}`);
                    //Pull a container from a container registry
                    //We set --tls-verify=false because we push to localhost
                    //All traffic between servers within VPN is encrypted that's why we can use -tls-verify=false
                    global.logger.info(`Pulling a container: ${image_id}`);
                    exec(`docker image pull 192.168.202.1:7000/${image_id}`, {
                        cwd: `${homedir}`
                    }, function (err, stdout, stderr) {
                        global.logger.info(`docker pull output: ${stdout}, error output: ${stderr}`);

                        if (err == undefined || err == null) {
                            global.logger.info(`Image ${image_id} has been pulled from the container registry`);
                            run_container(environment.port, image_id, container, me_node, environment);
                        }
                    });
                }
            })
        }
    }

    async function check_remove_environment(me_node) {
        //To remove an environment we should:
        //- Find an environment with status "to_remove"
        //- Find all containers linked to that environment and server where this code is running
        //- Stop and remove those containers
        //- Notify lighthouses that containers have been removed
        

    }

    async function run_container(service_port, image_id, container, me_node, environment) {
        //Getting a free port and starting a container
        portfinder.getPort({
            port: 6000,    // minimum port
            stopPort: 8900 // maximum port
        }, function (err, available_port) {
            if (err != null) {
                global.logger.error(`Cannot get a free port: ${err}`);
                return false;
            }
            global.logger.info(`A free port has ben found: ${available_port}`);
            global.logger.info(`Running a command: docker run -p ${available_port}:${service_port} -d --restart unless-stopped --name ${image_id} ${image_id}`);

            exec(`docker container run -p ${available_port}:${service_port} -d --restart unless-stopped --name ${image_id} 192.168.202.1:7000/${image_id}`, {
                cwd: `${homedir}`
            }, async function (err, stdout, stderr) {
                global.logger.info(`docker run output: ${stdout}, error output: ${stderr}`);

                if (err == undefined || err == null) {

                    global.logger.info(`Container ${image_id} has been started`);
                    request
                                .post(`http://192.168.202.1:5005/proxy`)
                                .send({ container_id: container.id, workload_ip: me_node.ip, port: available_port, domain: environment.domain }) // sends a JSON post body
                                .set('accept', 'json')
                                .retry(150)
                                .end(function (err, res) {
                                    // Calling the end function will send the request
                                    console.log(`\nMessage to create a new proxy for container: ${container.id}, domain: ${environment.domain} is delivered.\n`);
                                });
                    return true;
                } else {
                    return false;
                }
            });
        });
    }
}

module.exports = { check_deployment_query }