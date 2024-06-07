const dotenv = require('dotenv');
dotenv.config();

const os = require('os');
const home_dir = `${os.homedir()}/`;

const http = require('http');
const server = http.createServer();

const polka = require('polka');
const app = polka({ server });

const { WebSocketServer } = require('ws');
const WebSocket = require('ws');

const wss = new WebSocketServer({ server }); // We start a websocket server on load balancers
var ws_client = null;

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const storage = require("./utils/storage");
const fs = require('fs');

const auth = require("./utils/auth");
const { execSync } = require('child_process');

const { json } = require('body-parser');
app.use(json());

const Journalctl = require('./utils/journalctl-monitor');
const journalctl = new Journalctl({
  unit: ['localcloud-nebula.service', 'docker.service', 'localcloud-agent.service']
});

//Create logger
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const logger_format = printf(({ level, message, label, timestamp }) => {
  return `${timestamp}: ${level}: ${message}`;
});

const logger = createLogger({
  format: combine(
    timestamp(),
    logger_format
  ),
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `info.log`
    //
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'info.log' }),
  ]
});
global.logger = logger;

// Log every request
function log_request(req, res, next) {
  logger.info(`=======================================`);
  logger.info(`~> Request: ${req.method} on ${req.url}`);
  if (req.body != undefined) {
    //logger.info(`~> Body:`);
    //logger.info(`${JSON.stringify(req.body)}`);
  }
  logger.info(`=======================================`);

  next(); // move on
}

//Add Content-Type: application/json to all responses
function add_response_headers(req, res, next) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'HEAD, OPTIONS, POST, GET, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Request-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next(); // move on
}

async function authorize(req, res, next) {
  if (global.service_node_config.is_api_key_used == true) {
    const api_token = await auth.validate_token(req.headers);
    if (api_token == false) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Invalid api token" }));
    } else {
      next();
    }
  } else {
    next();
  }
}

//Add middleware
app.use(log_request, authorize, add_response_headers);

//Log examples:
//logger.info('Some info');
//logger.error('Some error');

//Load config
const redis_db = require('redis');
global.service_node_config = {};

connect_redis();
async function connect_redis() {
  global.redis_client = redis_db.createClient({ url: 'redis://127.0.0.1:6379' });
  global.redis_client.on('error', err => console.log('Redis Client Error', err));

  while (!global.redis_client.isOpen) {
    await global.redis_client.connect();
    global.logger.info('Connecting to Redis server');
  }

  //Create Redis Indexes
  try {
    await global.redis_client.ft.create('idx:vpnnodes', {
      name: redis_db.SchemaFieldTypes.TAG,
      id: redis_db.SchemaFieldTypes.TEXT,
    }, {
      ON: 'HASH',
      PREFIX: 'vpnnode',
    });

  } catch (e) {
    if (e.message === 'Index already exists') {
      console.log('Index exists already, skipped creation.');
    } else {
      // Something went wrong, perhaps RediSearch isn't installed...
      console.error(e);
      process.exit(1);
    }
  }

  try {
    await global.redis_client.ft.create('idx:services', {
      name: redis_db.SchemaFieldTypes.TAG,
      full_name: redis_db.SchemaFieldTypes.TAG,
      id: redis_db.SchemaFieldTypes.TEXT,
    }, {
      ON: 'HASH',
      PREFIX: 'service',
    });

  } catch (e) {
    if (e.message === 'Index already exists') {
      console.log('Index exists already, skipped creation.');
    } else {
      // Something went wrong, perhaps RediSearch isn't installed...
      console.error(e);
      process.exit(1);
    }
  }

  try {
    await global.redis_client.ft.create('idx:tunnels', {
      domain: redis_db.SchemaFieldTypes.TAG,
      id: redis_db.SchemaFieldTypes.TEXT,
    }, {
      ON: 'HASH',
      PREFIX: 'tunnel',
    });

  } catch (e) {
    if (e.message === 'Index already exists') {
      console.log('Index exists already, skipped creation.');
    } else {
      // Something went wrong, perhaps RediSearch isn't installed...
      console.error(e);
      process.exit(1);
    }
  }

  try {
    await global.redis_client.ft.create('idx:environments', {
      name: redis_db.SchemaFieldTypes.TAG,
      branch: redis_db.SchemaFieldTypes.TAG,
      id: redis_db.SchemaFieldTypes.TEXT,
      service_id: redis_db.SchemaFieldTypes.TEXT,
    }, {
      ON: 'HASH',
      PREFIX: 'environment',
    });

  } catch (e) {
    if (e.message === 'Index already exists') {
      console.log('Index exists already, skipped creation.');
    } else {
      // Something went wrong, perhaps RediSearch isn't installed...
      console.error(e);
      process.exit(1);
    }
  }

  try {
    await global.redis_client.ft.create('idx:images', {
      status: redis_db.SchemaFieldTypes.TAG,
      id: redis_db.SchemaFieldTypes.TEXT,
      environment_id: redis_db.SchemaFieldTypes.TAG,
    }, {
      ON: 'HASH',
      PREFIX: 'image',
    });

  } catch (e) {
    if (e.message === 'Index already exists') {
      console.log('Index exists already, skipped creation.');
    } else {
      // Something went wrong, perhaps RediSearch isn't installed...
      console.error(e);
      process.exit(1);
    }
  }

  try {
    await global.redis_client.ft.create('idx:containers', {
      status: redis_db.SchemaFieldTypes.TAG,
      target: redis_db.SchemaFieldTypes.TAG,
      environment_id: redis_db.SchemaFieldTypes.TAG,
      id: redis_db.SchemaFieldTypes.TEXT,
    }, {
      ON: 'HASH',
      PREFIX: 'container',
    });

  } catch (e) {
    if (e.message === 'Index already exists') {
      console.log('Index exists already, skipped creation.');
    } else {
      // Something went wrong, perhaps RediSearch isn't installed...
      console.error(e);
      process.exit(1);
    }
  }

  try {
    await global.redis_client.ft.create('idx:proxies', {
      status: redis_db.SchemaFieldTypes.TAG,
      domain: redis_db.SchemaFieldTypes.TAG,
      id: redis_db.SchemaFieldTypes.TEXT,
    }, {
      ON: 'HASH',
      PREFIX: 'proxy',
    });

  } catch (e) {
    if (e.message === 'Index already exists') {
      console.log('Index exists already, skipped creation.');
    } else {
      // Something went wrong, perhaps RediSearch isn't installed...
      console.error(e);
      process.exit(1);
    }
  }

  try {
    global.service_node_config = JSON.parse(fs.readFileSync(home_dir + '.deployed-config.json', 'utf8'));
    global.logger.info('Loaded node config:');
    global.logger.info(global.service_node_config);

  } catch (e) {
    global.logger.info('No config file ~/.deployed-config.json has been found');

    //Create a new config file
    //Use env.PORT.BASE_PRIVATE_IP to generate private IPs for VPN nodes
    global.service_node_config.hashed_tokens = [];
  }

  //Load data about this node from host.crt file
  var vpn_node_info = {};
  try {
    let node_info_out = execSync('./nebula-cert print -json -path /etc/nebula/host.crt', { cwd: home_dir });
    vpn_node_info = JSON.parse(node_info_out.toString()).details;
    global.logger.info('Loaded VPN node info from crt:');
    global.logger.info(node_info_out.toString());

    //Nebula uses names as server ids that's why we use nebula's node name as a server id
    global.service_node_config.server_id = vpn_node_info.name;

  } catch (err) {
    global.logger.error(`Cannot load information about this node from host.crt. Error: ${err}`);
    return;
  }

  //Load VPN nodes
  var vpn_nodes = await storage.get_vpn_node_by_id(global.service_node_config.server_id);

  if (vpn_nodes.length == 0) {

    global.logger.info('No stored VPN nodes in DB found. Seams this is the first node in VPN. Creating a first record...');

    //We should add the first server to vpn nodes that we just provisioned
    //Now the first server in VPN (or the first node) has a predefined private IP - 192.168.202.1
    var new_vpn_node = {};
    new_vpn_node.ip = vpn_node_info.ips[0].split('/')[0]; // remove subnet mask
    new_vpn_node.name = "load_balancer_1";
    new_vpn_node.type = ["load_balancer", "build_machine", "server"];
    new_vpn_node.id = global.service_node_config.server_id; // this is the first node - we shouldn't check that id is unique here
    new_vpn_node.status = 2; //statuses: 0 - offline, 1 - online, 2 - provision
    new_vpn_node.public_ip = '';
    await storage.add_vpn_node(new_vpn_node);

    //Load info about this server again
    vpn_nodes = await storage.get_vpn_node_by_id(global.service_node_config.server_id);
  }

  //Load Tunnels
  const tunnels = await global.redis_client.get('tunnels');
  if (tunnels != undefined) {
    global.tunnels = JSON.parse(tunnels);
    global.logger.info('Loaded Services');
    global.logger.info(global.tunnels);
  } else {
    global.logger.info('No stored Tunnels found');
    global.tunnels = [];
  }

  global.service_node_config.is_api_key_used = false; // We don't use API Tokens for API in the first version except POST /deploy/:api_token that is used to notify a service node about new git push
  generate_deploy_api_token(); // this API token is used in webhook URLs

  global.service_node_config.port = process.env.PORT || 5005;
  global.service_node_config.domain = process.env.SERVICE_NODE_DOMAIN; // We set this in deployed-service-node-install.sh script

  //Routes
  require("./routes/service")(app);
  require("./routes/tunnel")(app);
  require("./routes/deploy")(app);

  const vpn_routes = require("./routes/vpn");
  vpn_routes.create_routes(app);

  require("./routes/environment")(app);
  require("./routes/container")(app);
  require("./routes/image")(app);

  //Create routes
  const deployment = require("./routes/deployment");
  setInterval(deployment.check_deployment_query, 5000);

  //Load other modules
  const proxy = require("./routes/proxy");
  proxy.create_routes(app);

  console.log(vpn_nodes[0].type);
  //ToDo: Only load balancers and build machines can have public domains
  if (JSON.parse(vpn_nodes[0].type).indexOf("load_balancer") != -1) {

    proxy.proxy_reload(true);
    setInterval(proxy.proxy_reload, 2000);
    setInterval(vpn_routes.check_nodes, 2000);

    global.logger.info('Connecting to Redis Monitoring Server');
    //Connect to Redis Monitoring Server
    global.redis_client_monitoring = redis_db.createClient({ url: 'redis://127.0.0.1:6378' });
    global.redis_client_monitoring.on('error', err => console.log('Redis Monitoring Client Error', err));

    while (!global.redis_client_monitoring.isOpen) {
      await global.redis_client_monitoring.connect();
      global.logger.info('Retrying to connect to Redis Monitoring Server');
    }

    //Start a websocket server
    wss.on('connection', function connection(ws) {
      ws.on('error', console.error);

      ws.on('message', function message(data) {
        console.log('received: %s', data);
      });

      ws.send('something');

    });

  } else {
    //Start websocket client
    ws_client = new WebSocket('wss://192.168.202.1.localcloud.dev'); // We start a websocket client on all non load balancer servers
    ws_client.on('error', console.error);

    ws_client.on('open', function open() {
      ws_client.isAlive = true;
      ws_client.send('heyyy!!! from a server');
    });

    ws_client.on('message', function message(data) {
      console.log('received: %s', data);
    });
  }


  //Start journalctl monitor
  journalctl.on('event', (event) => {
    /*if (ws_client.isAlive == true){
      ws_client.send(event.MESSAGE);
    }*/
    //console.log(event);
  });
  //End if a monitor

  console.log("============================================");
  console.log(await storage.get_vpn_node_by_id(global.service_node_config.server_id));
  console.log("============================================");

  //Check if service-node works
  app.get('/hey', (req, res) => {
    res.statusCode = 200;
    res.end(JSON.stringify({ message: `I'm fine!` }));
  });

  app.options('/*', (req, res) => {
    res.statusCode = 204;
    res.end();
  });

  app.listen(global.service_node_config.port, async err => {
    if (err) throw err;
    global.logger.info(`LocalCloud agent is running on port ${global.service_node_config.port}`);

    //ToDo: Move this task to another better place, but note, that the code below should be run after the webserver is started
    get_public_ip();

  });

}

async function get_public_ip(){
      //Check and update a public ip address of a vpn node
    //ToDo: Move this task to another better place, but note, that the code below should be run after the webserver is started
    try {
      const response = await fetch(`https://localcloud.dev/ip`, {
        method: 'GET',
      })
      const public_ip = await response.text();
      if (!response.ok) {
        console.error('Cannot load a public IP: ', JSON.stringify(data));
      } else {
        console.log(`Loaded Public IP: ${public_ip}, sending PUT /vpn_node`);

        try {
          const response = await fetch(`http://192.168.202.1:5005/vpn_node`, {
            method: 'PUT',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
          },
            body: JSON.stringify({
              "id": global.service_node_config.server_id,
              "public_ip": public_ip
            })
          })
          const res_data = await response.text();
          if (!response.ok) {
            console.error('Cannot send PUT /vpn_node: ', JSON.stringify(res_data));
          } else {
            console.log('Node Public Ip has been updated');
          }
        } catch (error) {
          console.error("Error:", error);
        }

      }
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
    //////////////////////////////////////////////////////////////////////////////////
}

//ToDo: rewrite api token logic, now all requests are protected by overlay network
async function generate_deploy_api_token() {

  //Lets create a new API KEY
  global.service_node_config.api_token = crypto.randomUUID(); //ToDo: We should hide api_token after a user gets it
  global.service_node_config.hashed_tokens.push(await bcrypt.hash(global.service_node_config.api_token, 10));

  global.logger.info('New API Token is generated:');
  global.logger.info(`${global.service_node_config.api_token}`);

  storage.save_config();

}
