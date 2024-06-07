/*
    vpn.js
    Methods to manage VPN
*/


const adm_zip = require('adm-zip');
const os = require('os');
const home_dir = `${os.homedir()}`;
const crypto = require('crypto');
const fs = require('fs')
const exec = require('child_process').exec;
const storage = require("../utils/storage");
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 11); //~117 years or 1B IDs needed, in order to have a 1% probability of at least one collision, https://zelark.github.io/nano-id-cc/

async function create_routes(app)  {

  //Add a new node (or machine) to VPN
  //This request can be send only to localhost (for example, if you use Deploy CLI on the same server where you keep your vpn private key)
  //or from any node within VPN

  app.post('/vpn_node', async function (req, res) {

    const name = req.body.name;
    const type = req.body.type; //possible values: server, local_machine

    let vpn_nodes = await storage.get_vpn_nodes();
    if (vpn_nodes.find(node => node.name === name) != undefined) {
      res.statusCode = 403;
      res.end(JSON.stringify({ "msg": `The node with name ${name} already exists. Use another name.` }));
      return;
    }

    //You can set the token to join VPN in the body of this request
    //If a token isn't provided, LocalCloud generates it
    var archive_uuid = null;
    if(req.body.join_token != undefined && req.body.join_token !=  ''){
      archive_uuid = req.body.join_token;
    }else{
      archive_uuid = crypto.randomUUID();
    }

    global.logger.info(`Adding new VPN node ${name}`);

    //Generate .crt and .key for a new node
    //Keep available IPs in ~/.deployed-config.json and take IP from this IP list only
    //We should add IP of a removed node to this list again

    //Generate a new VPN private IP
    const private_ip_mask = `192.168.202.`;
    const IP_mask_min = 2;
    const IP_mask_max = 254;
    var random_id = randomNumber(IP_mask_min, IP_mask_max);

    while (vpn_nodes.find(node => node.ip === `${private_ip_mask}${random_id}`) != undefined) {
      random_id = randomNumber(IP_mask_min, IP_mask_max);
    }

    var new_vpn_node = {};
    new_vpn_node.ip = `${private_ip_mask}${random_id}`;
    new_vpn_node.name = name;
    new_vpn_node.type = [type];
    new_vpn_node.status = 2; //statuses: 0 - offline, 1 - online, 2 - provision
    new_vpn_node.public_ip = '';
    new_vpn_node.id = nanoid();
    while (vpn_nodes.find(vpn_node => vpn_node.id === new_vpn_node.id)) {
      new_vpn_node.id = nanoid();
    }

    global.logger.info(`Random private VPN IP: ${new_vpn_node.ip}`);

    //Note: we use id of a new node in parameter -name below because Nebula uses -name as id
    exec(`./nebula-cert sign -ca-crt /etc/nebula/ca.crt -ca-key /etc/nebula/ca.key -name \"${new_vpn_node.id}\" -ip \"${new_vpn_node.ip}\/24" -groups "devs" && sudo ufw allow from ${new_vpn_node.ip}`, {
      cwd: home_dir
    }, async function (err, stdout, stderr) {

      if (err != null) {
        global.logger.error(`Cannot generate a certificate for a new node. Error: ${err}`);
        res.statusCode = 403;
        res.end(JSON.stringify({ "msg": `Cannot generate a certificate for a new node. Error: ${err}` }));
        return;
      }

      await storage.add_vpn_node(new_vpn_node);

      global.logger.info(`A certificate for a new node is created.`);

      //After we generate certificates for a new node move them to folder $HOME/$archive_uuid
      //We need 4 files: ca.crt, config.yaml, host.key, host.crt
      const archive_root = `${home_dir}/${archive_uuid}`;
      if (!fs.existsSync(archive_root)) {
        fs.mkdirSync(archive_root, { recursive: true });
      }

      fs.copyFileSync(`/etc/nebula/ca.crt`, `${archive_root}/ca.crt`);
      fs.copyFileSync(`${home_dir}/node_config.yaml`, `${archive_root}/config.yaml`);
      fs.copyFileSync(`${home_dir}/${new_vpn_node.id}.crt`, `${archive_root}/host.crt`);
      fs.copyFileSync(`${home_dir}/${new_vpn_node.id}.key`, `${archive_root}/host.key`);

      //Add a host config, now we use only machine_id (or server_id)
      let machine_config = JSON.stringify(new_vpn_node);
      fs.writeFileSync(`${archive_root}/machine_config.json`, machine_config);

      //Generate ZIP from $HOME/$archive_uuid
      const zip = new adm_zip();
      zip.addLocalFile(`${archive_root}/ca.crt`);
      zip.addLocalFile(`${archive_root}/config.yaml`);
      zip.addLocalFile(`${archive_root}/host.crt`);
      zip.addLocalFile(`${archive_root}/host.key`);
      zip.addLocalFile(`${archive_root}/machine_config.json`);

      // Define zip file name
      const download_name = `deployed-cc-vpn-setup-${archive_uuid}.zip`;
      zip.writeZip(`${home_dir}/${download_name}`);

      try {

        //Remove crt and key files of this new node and a folder used to create a zip archive
        fs.unlinkSync(`${home_dir}/${new_vpn_node.id}.crt`)
        fs.unlinkSync(`${home_dir}/${new_vpn_node.id}.key`)
        fs.rmSync(archive_root, { recursive: true, force: true });

      } catch (err) {
        global.logger.error(`Cannot remove file: ${err}`);
      }

      res.statusCode = 201;
      res.end(JSON.stringify({ zip_url: `https://${global.service_node_config.domain}/join_vpn/${archive_uuid}` }));

    });
  });

  //Update a vpn node
  app.put('/vpn_node', async function (req, res) {

    const node_id = req.body.id;
    const status = req.body.status; 
    const public_ip = req.body.public_ip; 

    let vpn_nodes = await storage.get_vpn_node_by_id(node_id);
    if (vpn_nodes.length == 0) {
      res.statusCode = 404;
      res.end(JSON.stringify({ "msg": `Node not found` }));
      return;
    }

    if (status != undefined){
      await storage.update_vpn_node_status(node_id, status);
    }

    if (public_ip != undefined){
      await storage.update_vpn_node_public_ip(node_id, public_ip);
    }

    res.statusCode = 200;
    res.end('');

  });

  //Get VPN nodes
  app.get('/vpn_node', async function (req, res) {
      //Load services from DB and simplify the output format
      let vpn_nodes = await storage.get_vpn_nodes();
      res.statusCode = 200;
      res.end(JSON.stringify(vpn_nodes));
  });

  app.get('/join_vpn/:archive_uuid', async function (req, res) {

    const archive_uuid = req.params.archive_uuid;
    const download_file = `${home_dir}/deployed-cc-vpn-setup-${archive_uuid}.zip`;
    if (!fs.existsSync(download_file)) {
      res.statusCode = 404;
      res.end("The setup archive isn't found! You can download an archive only once. Try to add a new VPN node again.");
      return;
    }

    var zip = new adm_zip(download_file);
    const data = zip.toBuffer();
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename=deployed-cc-setup-vpn.zip`, 'Content-Length': data.length });
    res.end(data);

    try {
      fs.unlinkSync(download_file)
    } catch (err) {
      global.logger.error(`Cannot remove zip at ${download_file}: ${err}`);
    }
  });


  //ToDo: Find the way how to notify all other vpn nodes about deleted node
  app.delete('/vpn_node', async function (req, res) {
    const name = req.body.name;
    let vpn_nodes = storage.get_vpn_nodes();
    if (vpn_nodes.find(node => node.name === name) != undefined) {
      res.statusCode = 403;
      res.end(JSON.stringify({ "msg": `The node with name ${name} not found.` }));
      return;
    }

    res.statusCode = 201;
    res.end(JSON.stringify({}));

  });

}

async function check_nodes() {
  let vpn_nodes = await storage.get_vpn_nodes();
  vpn_nodes.forEach(async vpn_node => {
    ping(vpn_node);
  })
}

async function ping(vpn_node) { 
  exec(`ping -c 1 ${vpn_node.ip}`, async function (err, stdout, stderr) {

    if (stderr) {
      console.error(`Error from ping: ${stderr}`);
      return false;
    }

    console.log(`${stdout}`);

    if (stdout.toString().includes('1 received') == true){
      //Set the machine status to "online" only if it's not "online"
      if (vpn_node.status != 1 ){
        await storage.update_vpn_node_status(vpn_node.id, 1);
      }
    }else{
      //If a machine has status "provision" (status == 2)
      //we don't update the machine status to "offline"
      if (vpn_node.status == 1 ){
        await storage.update_vpn_node_status(vpn_node.id, 0);
      }
    }

  });
}


function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

module.exports = { create_routes, check_nodes };