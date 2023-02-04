#!/bin/sh

#Parameters
#$1 - domain
#or
#$1 - join
#$2 - url to download a zip archive with certificates

#wait until another process are trying updating the system
while sudo fuser /var/{lib/{dpkg,apt/lists},cache/apt/archives}/lock >/dev/null 2>&1; do sleep 1; done
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 1; done

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

echo "unqualified-search-registries = [\"docker.io\"]" >> $HOME/.config/containers/registries.conf 

#Install npm & node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - 
DEBIAN_FRONTEND=noninteractive  sudo apt-get install -y nodejs
npm install -g npm@9.2.0

#Install PM2
npm install pm2@latest -g

#Generate SSH keys
ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa

ssh-keyscan bitbucket.org >> ~/.ssh/known_hosts
ssh-keyscan github.com >> ~/.ssh/known_hosts

#Install Caddy Server
DEBIAN_FRONTEND=noninteractive sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
DEBIAN_FRONTEND=noninteractive sudo apt -y install caddy

#Install Deployed.cc service-node
git clone https://coded-sh@bitbucket.org/coded-sh/service-node.git
cd service-node
npm install
SERVICE_NODE_DOMAIN=$1  pm2 start index.js --name service-node 

#Install Nebula
cd $HOME
wget https://github.com/slackhq/nebula/releases/download/v1.6.1/nebula-linux-amd64.tar.gz 
tar -xzf nebula-linux-amd64.tar.gz
chmod +x nebula
mkdir /etc/nebula

if [ "$1" = "join" ]; then
    echo "Downloading a zip archive with Nebula certificates"
    DEBIAN_FRONTEND=noninteractive  sudo apt-get install unzip
    wget $2 -O deployed-join-vpn.zip
    unzip -o deployed-join-vpn.zip
    cp config.yaml /etc/nebula/config.yaml
    cp ca.crt /etc/nebula/ca.crt
    cp host.crt /etc/nebula/host.crt
    cp host.key /etc/nebula/host.key
    ufw allow from 192.168.202.0/24
else
    echo "Generate new Nebula certificates"
    chmod +x nebula-cert

    ./nebula-cert ca -name "Myorganization, Inc" -duration 34531h

    ./nebula-cert sign -name "lighthouse_1" -ip "192.168.202.1/24"
    #./nebula-cert sign -name "local_machine_1" -ip "192.168.202.2/24" -groups "devs"

    server_ip="$(curl ifconfig.me)"

    cp service-node/public/provision/nebula_lighthouse_config.yaml lighthouse_config.yaml
    sed -i -e "s/{{lighthouse_ip}}/$server_ip/g" lighthouse_config.yaml

    cp service-node/public/provision/nebula_node_config.yaml node_config.yaml
    sed -i -e "s/{{lighthouse_ip}}/$server_ip/g" node_config.yaml

    cp lighthouse_config.yaml /etc/nebula/config.yaml
    cp ca.crt /etc/nebula/ca.crt
    cp lighthouse_1.crt /etc/nebula/host.crt
    cp lighthouse_1.key /etc/nebula/host.key

fi

pm2 start ./nebula --name nebula -- -config /etc/nebula/config.yaml

#Save PM2 to launch service-node and nebula after rebooting
pm2 startup
pm2 save

if [ "$1" = "join" ]; then
    echo "Deployed.cc Service Node agent is installed. Use CLI to deploy services and apps on this server. This server will should be listed in Servers menu item in CLI."
else
    #Generate VPN certificates for the first local machine with full access
    #    .---------- constant part!
    #    vvvv vvvv-- the code from above
    GREEN='\033[0;32m'
    NC='\033[0m' # No Color

    certificate_output=$(curl -d '{"name":"local_machine"}' -H "Content-Type: application/json" -X POST http://localhost:5005/vpn_node)

    echo -e "${GREEN}+---------------------------------------+${NC}"
    echo "$certificate_output" | tr -d '"'
fi

#Reboot (optional)
#reboot