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
sudo sed -i "/#\$nrconf{restart} = 'i';/s/.*/\$nrconf{restart} = 'a';/" /etc/needrestart/needrestart.conf

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

sudo iptables -I FORWARD -p tcp ! -i cni-podman0 -o cni-podman0 -j ACCEPT #to accept connections to podman containers with enabled ufw - https://stackoverflow.com/questions/70870689/configure-ufw-for-podman-on-port-443

echo iptables-persistent iptables-persistent/autosave_v4 boolean true | sudo debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | sudo debconf-set-selections
DEBIAN_FRONTEND=noninteractive sudo apt-get -y install iptables-persistent

#Install npm & node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - 
DEBIAN_FRONTEND=noninteractive sudo apt-get install -y nodejs
sudo npm install -g npm

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

#Clone LocalCloud service-node
git clone https://coded-sh@bitbucket.org/coded-sh/service-node.git 

#Install Nebula
cd $HOME

#Get architecture
OSArch=$(uname -m)
if [ "$OSArch" = "aarch64" ]; then
    wget https://github.com/slackhq/nebula/releases/download/v1.6.1/nebula-linux-arm64.tar.gz 
    tar -xzf nebula-linux-arm64.tar.gz
    rm nebula-linux-arm64.tar.gz
else
    wget https://github.com/slackhq/nebula/releases/download/v1.6.1/nebula-linux-amd64.tar.gz 
    tar -xzf nebula-linux-amd64.tar.gz
    rm nebula-linux-amd64.tar.gz
fi

sudo chmod +x nebula
sudo mkdir /etc/nebula

#Install Redis
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get -y install redis-stack-server

if [ "$1" = "join" ]; then

    echo "Downloading a zip archive with Nebula certificates"
    DEBIAN_FRONTEND=noninteractive  sudo apt-get install unzip
    wget $2 -O deployed-join-vpn.zip
    unzip -o deployed-join-vpn.zip
    sudo mv config.yaml /etc/nebula/config.yaml
    sudo mv ca.crt /etc/nebula/ca.crt
    sudo mv host.crt /etc/nebula/host.crt
    sudo mv host.key /etc/nebula/host.key

    sudo rm deployed-join-vpn.zip
    
    sudo ufw allow from 192.168.202.0/24

    #Start Nebula
    #ToDo: Move to systemd
    cd $HOME
    sudo pm2 start ./nebula --name nebula -- -config /etc/nebula/config.yaml

    #Use Redis instance as a replica
    sudo echo -e "\nreplica-read-only no\nreplicaof 192.168.202.1 6379" >> /etc/redis-stack.conf
    sudo systemctl restart redis-stack-server

    #Wait until this Redis replica is synchronized with the master, we check if a replica is synchronized by "vpn_nodes" key
    echo "Redis replica synchronization"
    timeout 15 bash -c 'while [[ "$(redis-cli exists vpn_nodes)" != "1" ]]; do sleep 1; done' || false
    if [ "$(redis-cli exists vpn_nodes)" != "1" ]; then
        echo "Cannot synchronize Redis replica with the master. Try to rebuild this server, add a new node in Deploy CLI and run this script again."
        exit 1
    else
        echo "Redis replica has been synchronized with the master instance"
    fi

    #We don't set a public domain for the non-first server now because the current version has just one load balancer and build machine
    #Will be improved in next versions
    cd $HOME/service-node
    npm install
    sudo pm2 start index.js --name service-node 

else

    echo "Generate new Nebula certificates"
    sudo chmod +x nebula-cert

    server_ip="$(curl ifconfig.me)"
    UUID=$(openssl rand -hex 5)

    sudo ./nebula-cert ca -name "Local Cloud" -duration 34531h

    sudo ./nebula-cert sign -name "$UUID" -ip "192.168.202.1/24"
    #./nebula-cert sign -name "local_machine_1" -ip "192.168.202.2/24" -groups "devs"

    cp service-node/public/provision/nebula_lighthouse_config.yaml lighthouse_config.yaml
    sed -i -e "s/{{lighthouse_ip}}/$server_ip/g" lighthouse_config.yaml

    cp service-node/public/provision/nebula_node_config.yaml node_config.yaml
    sed -i -e "s/{{lighthouse_ip}}/$server_ip/g" node_config.yaml

    sudo mv lighthouse_config.yaml /etc/nebula/config.yaml
    sudo mv ca.crt /etc/nebula/ca.crt
    sudo mv ca.key /etc/nebula/ca.key
    sudo mv $UUID.crt /etc/nebula/host.crt
    sudo mv $UUID.key /etc/nebula/host.key
    
    #Start Nebula
    #ToDo: Move to systemd
    cd $HOME
    sudo pm2 start ./nebula --name nebula -- -config /etc/nebula/config.yaml

    #Redis config for replicas
    sudo echo -e "\nreplica-read-only no\nbind 127.0.0.1 192.168.202.1\nprotected-mode no" >> /etc/redis-stack.conf
    sudo systemctl restart redis-stack-server

    #We set a public domain for the first server
    cd $HOME/service-node
    npm install
    sudo SERVICE_NODE_DOMAIN=$1  pm2 start index.js --name service-node 

fi

#Wait until service-node agent is started
echo "Waiting when the service-node agent is online"

timeout 10 bash -c 'while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' localhost:5005/hey)" != "200" ]]; do sleep 1; done' || false

#Save PM2 to launch service-node and nebula after rebooting
sudo pm2 startup
sudo pm2 save

if [ "$1" = "join" ]; then
    echo "LocalCloud agent is installed. Use CLI to deploy services and apps on this server. This server will should be listed in Servers menu item in CLI."
else

    #Start Podman container registry, in the current version the first server/root server is a build machine as well
    #We'll add special build nodes/machines in next version
    podman container run -dt -p 7000:5000 --name depl-registry --volume depl-registry:/var/lib/registry:Z docker.io/library/registry:2
    sudo iptables -I FORWARD -p tcp ! -i cni-podman0 -o cni-podman0 -s 192.168.202.0/24 --dport 5000 -j ACCEPT
    sudo netfilter-persistent save

    #Start Registry container on every boot
    podman generate systemd --new --name depl-registry > /etc/systemd/system/depl-registry.service
    systemctl enable depl-registry
    systemctl start depl-registry

    #Generate VPN certificates for the first local machine with full access
    #    .---------- constant part!
    #    vvvv vvvv-- the code from above
    GREEN='\033[0;32m'
    NC='\033[0m' # No Color
    zip_url=$(curl -s -d '{"name":"local_machine","type":"local_machine"}' -H "Content-Type: application/json" -X POST http://localhost:5005/vpn_node | python3 -c "import sys,json;obj=json.load(sys.stdin);print(obj['zip_url']);")
    echo "${GREEN}+---------------------------------------+${NC}"
    echo ""
    echo "Service Node Agent has been installed. To deploy a first project:"
    echo ""
    echo "- install Deploy CLI on your local machine (on your laptop, iMac, Desktop computer etc.). Run in Terminal/Console (NPM should be installed on your system):"
    echo ""
    echo "    npm install -g https://github.com/localcloud-dev/localcloud-cli"
    echo ""
    echo "- check that Deployed CLI is installed:"
    echo ""
    echo "    deploy -v"
    echo ""
    echo "Note: If you see a message like 'command not found: deploy' try to install Deployed CLI with sudo: 'sudo npm install -g https://github.com/localcloud-dev/localcloud-cli'"
    echo ""
    echo "- connect your local machine to your LocalCloud VPN (this server is already in this network). Run in Terminal/Console on your local machine:"
    echo ""
    echo "    sudo deploy -j $zip_url"
    echo ""
    echo "If everything goes well you'll see menu:"
    echo ""
    echo "    - Add service"
    echo "    - Manage services"
    echo "    - Servers / Local machines"
    echo "    - Localhost tunnels"
    echo ""
    echo "Select Add service and follow instructions to deploy your first project."
    echo ""

fi

#Reboot (optional)
#reboot