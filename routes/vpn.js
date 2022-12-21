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

module.exports = function (app) {

  //Add a new node to VPN
  //This request can be send only to localhost (for example, if you use Deploy CLI on the same server where you keep your vpn private key)
  //or from any node within VPN
  app.post('/vpn_node', async function (req, res) {

    const name = req.body.name;
    if (global.service_node_config.vpn_nodes.find(node => node.name === name) != undefined) {
      res.statusCode = 403;
      res.end(JSON.stringify({ "msg": `The node with name ${name} already exists. Use another name.` }));
      return;
    }

    const archive_uuid = crypto.randomUUID();
    global.logger.info(`Adding new VPN node ${name}`);

    //Generate .crt and .key for a new node
    //Keep available IPs in ~/.deployed-config.json and take IP from this IP list only
    //We should add IP of a removed node to this list again

    //Generate a new VPN private IP
    const private_ip_mask = `192.168.202.`;
    var random_id = randomNumber(1,254);
    while (global.service_node_config.vpn_nodes.find(node => node.ip === `${private_ip_mask}${random_id}/24`) != undefined) {
      random_id = randomNumber(1,254);
    }

    var new_vpn_node = {};
    new_vpn_node.ip = `${private_ip_mask}${random_id}/24`;
    new_vpn_node.name = name;

    global.logger.info(`Random private VPN IP: ${new_vpn_node.ip}`);

    exec(`./nebula-cert sign -name \"${new_vpn_node.name}\" -ip \"${new_vpn_node.ip}\" -groups "devs"`,{
      cwd: home_dir
  }, function (err, stdout, stderr) {

      if (err != null) {
        res.statusCode = 403;
        res.end(JSON.stringify({ "msg": `Cannot generate a certificate for a new node. Error: ${err}` }));
        return;
      }

      global.service_node_config.vpn_nodes.push(new_vpn_node);
      storage.save_config();

      global.logger.info(`A certificate for a new node are created.`);

      //After we generate certificates for a new node move them to folder $HOME/$archive_uuid
      //We need 4 files: ca.crt, config.yaml, host.key, host.crt
      const archive_root = `${home_dir}/${archive_uuid}`;
      if (!fs.existsSync(archive_root)) {
        fs.mkdirSync(archive_root, { recursive: true });
      }

      fs.copyFileSync(`${home_dir}/ca.crt`, `${archive_root}/ca.crt`);
      fs.copyFileSync(`${home_dir}/node_config.yaml`, `${archive_root}/config.yaml`);
      fs.copyFileSync(`${home_dir}/${name}.crt`, `${archive_root}/host.crt`);
      fs.copyFileSync(`${home_dir}/${name}.key`, `${archive_root}/host.key`);

      //Generate ZIP from $HOME/$archive_uuid
      const zip = new adm_zip();
      zip.addLocalFile(`${archive_root}/ca.crt`);
      zip.addLocalFile(`${archive_root}/config.yaml`);
      zip.addLocalFile(`${archive_root}/host.crt`);
      zip.addLocalFile(`${archive_root}/host.key`);

      // Define zip file name
      const download_name = `deployed-cc-vpn-setup-${archive_uuid}.zip`;
      zip.writeZip(`${home_dir}/${download_name}`);

      try {

        //Remove crt and key files of this new node and a folder used to create a zip archive
        fs.unlinkSync(`${home_dir}/${name}.crt`)
        fs.unlinkSync(`${home_dir}/${name}.key`)
        fs.rmSync(archive_root, { recursive: true, force: true });

      } catch (err) {
        global.logger.error(`Cannot remove file: ${err}`);
      }

      res.statusCode = 201;
      res.end(JSON.stringify({ "vpn_setup_archive_url": `http://localhost:5005/setup_vpn/${archive_uuid}` }));

    });

  });

  app.get('/setup_vpn/:archive_uuid', async function (req, res) {

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

}

function randomNumber(min, max) { 
  return Math.floor(Math.random() * (max - min) + min);
} 

