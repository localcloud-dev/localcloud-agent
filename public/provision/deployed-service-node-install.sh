#!/bin/sh

#Parameters
#$1 - domain
#or
#$1 - join
#$2 - url to download a zip archive with certificates

#wait until another process are trying updating the system
while sudo fuser /var/{lib/{dpkg,apt/lists},cache/apt/archives}/lock >/dev/null 2>&1; do sleep 1; done
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 1; done

#Disable "Pending kernel upgrade" message. OVH cloud instances show this message very often, for
sudo sed -i "s/#\$nrconf{kernelhints} = -1;/\$nrconf{kernelhints} = -1;/g" /etc/needrestart/needrestart.conf

#Open only necessary ports
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw allow 9418
sudo ufw allow 4242
sudo ufw --force enable

#Install Podman
DEBIAN_FRONTEND=noninteractive  sudo apt-get update
DEBIAN_FRONTEND=noninteractive  sudo apt-get -y install podman

#echo "unqualified-search-registries = [\"docker.io\"]" >> $HOME/.config/containers/registries.conf 
echo "unqualified-search-registries = [\"docker.io\"]" >> /etc/containers/registries.conf 

#Install npm & node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - 
DEBIAN_FRONTEND=noninteractive sudo apt-get install -y nodejs
sudo npm install -g npm@9.2.0

#Install PM2
sudo npm install pm2@latest -g

#Generate SSH keys
sudo ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa

sudo ssh-keyscan bitbucket.org >> ~/.ssh/known_hosts
sudo ssh-keyscan github.com >> ~/.ssh/known_hosts

#Install Caddy Server
DEBIAN_FRONTEND=noninteractive sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive sudo apt -y install caddy

#Install Deployed.cc service-node
git clone https://coded-sh@bitbucket.org/coded-sh/service-node.git
cd service-node
npm install
sudo SERVICE_NODE_DOMAIN=$1  pm2 start index.js --name service-node 

#Install Nebula
cd $HOME
wget https://github.com/slackhq/nebula/releases/download/v1.6.1/nebula-linux-amd64.tar.gz 
tar -xzf nebula-linux-amd64.tar.gz
sudo chmod +x nebula
sudo mkdir /etc/nebula

if [ "$1" = "join" ]; then
    echo "Downloading a zip archive with Nebula certificates"
    DEBIAN_FRONTEND=noninteractive  sudo apt-get install unzip
    wget $2 -O deployed-join-vpn.zip
    unzip -o deployed-join-vpn.zip
    sudo cp config.yaml /etc/nebula/config.yaml
    sudo cp ca.crt /etc/nebula/ca.crt
    sudo cp host.crt /etc/nebula/host.crt
    sudo cp host.key /etc/nebula/host.key
    sudo ufw allow from 192.168.202.0/24
else
    echo "Generate new Nebula certificates"
    sudo chmod +x nebula-cert

    sudo ./nebula-cert ca -name "Myorganization, Inc" -duration 34531h

    sudo ./nebula-cert sign -name "lighthouse_1" -ip "192.168.202.1/24"
    #./nebula-cert sign -name "local_machine_1" -ip "192.168.202.2/24" -groups "devs"

    server_ip="$(curl ifconfig.me)"

    cp service-node/public/provision/nebula_lighthouse_config.yaml lighthouse_config.yaml
    sed -i -e "s/{{lighthouse_ip}}/$server_ip/g" lighthouse_config.yaml

    cp service-node/public/provision/nebula_node_config.yaml node_config.yaml
    sed -i -e "s/{{lighthouse_ip}}/$server_ip/g" node_config.yaml

    sudo cp lighthouse_config.yaml /etc/nebula/config.yaml
    sudo cp ca.crt /etc/nebula/ca.crt
    sudo cp lighthouse_1.crt /etc/nebula/host.crt
    sudo cp lighthouse_1.key /etc/nebula/host.key

fi

sudo pm2 start ./nebula --name nebula -- -config /etc/nebula/config.yaml

#Save PM2 to launch service-node and nebula after rebooting
sudo pm2 startup
sudo pm2 save

if [ "$1" = "join" ]; then
    echo "Deployed.cc Service Node agent is installed. Use CLI to deploy services and apps on this server. This server will should be listed in Servers menu item in CLI."
else
    #Generate VPN certificates for the first local machine with full access
    #    .---------- constant part!
    #    vvvv vvvv-- the code from above
    GREEN='\033[0;32m'
    NC='\033[0m' # No Color

    certificate_output=$(curl -d '{"name":"local_machine"}' -H "Content-Type: application/json" -X POST http://localhost:5005/vpn_node)

    echo "${GREEN}+---------------------------------------+${NC}"
    echo ""
    echo "Service Node Agent has been installed. To deploy a first project:"
    echo ""
    echo "- install Deploy CLI on your local machine (on your laptop, iMac, Desktop computer etc.). Run in Terminal/Console (NPM should be installed on your system):"
    echo ""
    echo "    npm install -g https://github.com/deployed-cc/deployed-cli"
    echo ""
    echo "- check that Deployed CLI is installed:"
    echo ""
    echo "    deploy -v"
    echo ""
    echo "Note: If you see a message like 'command not found: deploy' try to install Deployed CLI with sudo: 'sudo npm install -g https://github.com/deployed-cc/deployed-cli'"
    echo ""
    echo "- connect your local machine to Deployed.cc VPN (this server is already in this network). Run in Terminal/Console on your local machine:"
    echo ""
    echo "    deploy -j $certificate_output"
    echo ""
    echo "If everything goes well you'll see menu with 2 items:"
    echo ""
    echo "    - Add service"
    echo "    - Manage services"
    echo ""
    echo "Select Add service and follow instructions to deploy your first project."
    echo ""

fi

#Reboot (optional)
#reboot