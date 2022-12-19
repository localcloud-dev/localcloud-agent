#!/bin/sh

#Parameters
#$1 - domain

#wait until another process are trying updating the system
while sudo fuser /var/{lib/{dpkg,apt/lists},cache/apt/archives}/lock >/dev/null 2>&1; do sleep 1; done
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 1; done

#Open only necessary ports
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw allow 9418
sudo ufw allow 4242
sudo ufw allow from 192.168.202.2 #IP address of the first local machine inside VPN (based on Nebula)
sudo ufw --force enable

#Install Podman
DEBIAN_FRONTEND=noninteractive  sudo apt-get update
DEBIAN_FRONTEND=noninteractive  sudo apt-get -y install podman

echo "unqualified-search-registries = [\"docker.io\"]" >> $HOME/.config/containers/registries.conf 

#Install npm & node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - 
DEBIAN_FRONTEND=noninteractive  sudo apt-get install -y nodejs

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
pm2 startup
pm2 save

#Install Nebula
cd $HOME
wget https://github.com/slackhq/nebula/releases/download/v1.6.1/nebula-linux-amd64.tar.gz 
tar -xzf nebula-linux-amd64.tar.gz
chmod +x nebula
chmod +x nebula-cert

./nebula-cert ca -name "Myorganization, Inc" -duration 34531h

./nebula-cert sign -name "lighthouse_1" -ip "192.168.202.1/24"
./nebula-cert sign -name "local_machine_1" -ip "192.168.202.2/24" -groups "devs"

server_ip="$(curl ifconfig.me)"

cp service-node/public/provision/nebula_lighthouse_config.yaml lighthouse_config.yaml
sed -i -e "s/{{lighthouse_ip}}/$server_ip/g" lighthouse_config.yaml

cp service-node/public/provision/nebula_node_config.yaml node_config.yaml
sed -i -e "s/{{lighthouse_ip}}/$server_ip/g" node_config.yaml

mkdir /etc/nebula
cp lighthouse_config.yaml /etc/nebula/config.yaml
cp ca.crt /etc/nebula/ca.crt
cp lighthouse_1.crt /etc/nebula/host.crt
cp lighthouse_1.key /etc/nebula/host.key

./nebula -config /etc/nebula/config.yaml &

#Reboot (optional)

echo "Deployed.cc Node Service is installed\n"
echo "Run \"deploy\" in your Terminal to deploy the first project\n"

#reboot