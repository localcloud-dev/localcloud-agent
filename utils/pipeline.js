const storage = require("./storage");

async function schedule_deployment(repo_full_name, updated_branch){
    global.logger.info(`Scheduling deployment for a service with full name: ${repo_full_name}`);
    
    let services = await storage.get_service_by_fullname(repo_full_name);
    if (services != undefined && services.length == 1) {
        let service = services[0];
        var environment = await storage.get_environment_by_branch(service.id, updated_branch);
        storage.create_image_and_containers(service, environment);
    }

}

module.exports = {schedule_deployment}