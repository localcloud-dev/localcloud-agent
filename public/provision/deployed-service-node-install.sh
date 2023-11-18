#!/bin/sh

#Parameters
#$1 - domain
#or
#$1 - join
#$2 - url to download a zip archive with certificates

if [ -z "$1" ]
then
  echo ""
  echo ""
  echo "No domain is specified in the command. Use 'curl https://localcloud.dev/install | sh -s your_domain'.  Where your_domain is, for example, localcloud.domain.com; DNS A record for this domain name should be pointed to IP address of this server. The domain will be used for adding new servers/local machines and for deployment webhooks (for example, for deploying changes after you push code to GitHub/Bitbucket). More information can be found at https://localcloud.dev/docs"
  echo ""
  echo ""
  exit 0
fi

echo "Installing LocalCloud Agent ..."


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

#Install Docker
DEBIAN_FRONTEND=noninteractive sudo apt-get update
DEBIAN_FRONTEND=noninteractive sudo apt-get install -y ca-certificates curl gnupg 
DEBIAN_FRONTEND=noninteractive sudo install -y -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
DEBIAN_FRONTEND=noninteractive sudo apt-get update
DEBIAN_FRONTEND=noninteractive sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

#Set Docker with UFW
sudo wget -O /usr/local/bin/ufw-docker https://github.com/chaifeng/ufw-docker/raw/master/ufw-docker
sudo chmod +x /usr/local/bin/ufw-docker
ufw-docker install
sudo systemctl restart ufw

sudo echo -e "{\"insecure-registries\" : [\"192.168.202.1:7000\"]}" >> /etc/docker/daemon.json
sudo systemctl restart docker


#echo iptables-persistent iptables-persistent/autosave_v4 boolean true | sudo debconf-set-selections
#echo iptables-persistent iptables-persistent/autosave_v6 boolean true | sudo debconf-set-selections
#DEBIAN_FRONTEND=noninteractive sudo apt-get -y install iptables-persistent

#Install npm & node.js
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
DEBIAN_FRONTEND=noninteractive sudo apt-get update
DEBIAN_FRONTEND=noninteractive sudo apt-get install nodejs -y
sudo npm install -g npm

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

#Clone LocalCloud agent
git clone https://github.com/localcloud-dev/localcloud-agent.git

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
mv nebula /usr/local/bin/nebula
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
    sudo echo -e "[Unit]\nDescription=Nebula overlay networking tool\nWants=basic.target network-online.target nss-lookup.target time-sync.target\nAfter=basic.target network.target network-online.target\nBefore=sshd.service" >> /etc/systemd/system/localcloud-nebula.service
    sudo echo -e "[Service]\nSyslogIdentifier=nebula\nExecReload=/bin/kill -HUP $MAINPID\nExecStart=/usr/local/bin/nebula -config /etc/nebula/config.yaml\nRestart=always" >> /etc/systemd/system/localcloud-nebula.service
    sudo echo -e "[Install]\nWantedBy=multi-user.target" >> /etc/systemd/system/localcloud-nebula.service
    sudo systemctl enable localcloud-nebula.service
    sudo systemctl start localcloud-nebula.service

    #Use Redis instance as a replica
    sudo echo -e "\nreplica-read-only no\nreplicaof 192.168.202.1 6379" >> /etc/redis-stack.conf
    sudo systemctl restart redis-stack-server
    
    #Waiting for Redis
    PONG=`redis-cli -h 127.0.0.1 -p 6379 ping | grep PONG`
    while [ -z "$PONG" ]; do
        sleep 1
        echo "Retry Redis ping... "
        PONG=`redis-cli -h 127.0.0.1 -p 6379 ping | grep PONG`
    done

    #Wait until this Redis replica is synchronized with the master, we check if a replica is synchronized by "vpn_nodes" key
    echo "Redis replica synchronization"
    timeout 15 bash -c 'while [[ "$(redis-cli dbsize)" == "0" ]]; do sleep 1; done' || false
    if [[ "$(redis-cli dbsize)" == "0" ]]; then
        echo "Cannot synchronize Redis replica with the master. Try to rebuild this server, add a new node in Deploy CLI and run this script again."
        exit 1
    else
        echo "Redis replica has been synchronized with the master instance"
    fi

    #We don't set a public domain for the non-first server now because the current version has just one load balancer and build machine
    #Will be improved in next versions
    cd $HOME/service-node
    npm install

    sudo echo -e "[Unit]\nDescription=LocalCloud Agent\nWants=basic.target network-online.target nss-lookup.target time-sync.target\nAfter=basic.target network.target network-online.target" >> /etc/systemd/system/localcloud-agent.service
    sudo echo -e "[Service]\nSyslogIdentifier=localcloud-agent\nExecStart=/usr/bin/node $HOME/service-node/index.js\nRestart=always" >> /etc/systemd/system/localcloud-agent.service
    sudo echo -e "[Install]\nWantedBy=multi-user.target" >> /etc/systemd/system/localcloud-agent.service
    sudo systemctl enable localcloud-agent.service
    sudo systemctl start localcloud-agent.service

else

    echo "Generate new Nebula certificates"
    sudo chmod +x nebula-cert

    server_ip="$(curl https://ipinfo.io/ip)"
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
    sudo echo -e "[Unit]\nDescription=Nebula overlay networking tool\nWants=basic.target network-online.target nss-lookup.target time-sync.target\nAfter=basic.target network.target network-online.target\nBefore=sshd.service" >> /etc/systemd/system/localcloud-nebula.service
    sudo echo -e "[Service]\nSyslogIdentifier=nebula\nExecReload=/bin/kill -HUP $MAINPID\nExecStart=/usr/local/bin/nebula -config /etc/nebula/config.yaml\nRestart=always" >> /etc/systemd/system/localcloud-nebula.service
    sudo echo -e "[Install]\nWantedBy=multi-user.target" >> /etc/systemd/system/localcloud-nebula.service
    sudo systemctl enable localcloud-nebula.service
    sudo systemctl start localcloud-nebula.service

    #Redis config for replicas
    sudo echo -e "\nreplica-read-only no\nbind 127.0.0.1 192.168.202.1\nprotected-mode no" >> /etc/redis-stack.conf
    sudo systemctl restart redis-stack-server

    #Start LocalCloud agent
    #We set a public domain for the first server
    cd $HOME/service-node
    npm install

    sudo echo -e "[Unit]\nDescription=LocalCloud Agent\nWants=basic.target network-online.target nss-lookup.target time-sync.target\nAfter=basic.target network.target network-online.target" >> /etc/systemd/system/localcloud-agent.service
    sudo echo -e "[Service]\nSyslogIdentifier=localcloud-agent\nExecStart=/usr/bin/node $HOME/service-node/index.js\nRestart=always\nEnvironment=SERVICE_NODE_DOMAIN=$1" >> /etc/systemd/system/localcloud-agent.service
    sudo echo -e "[Install]\nWantedBy=multi-user.target" >> /etc/systemd/system/localcloud-agent.service
    sudo systemctl enable localcloud-agent.service
    sudo systemctl start localcloud-agent.service

fi

#Wait until service-node agent is started
echo "Waiting when LocalCloud agent is online"

timeout 10 bash -c 'while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' localhost:5005/hey)" != "200" ]]; do sleep 1; done' || false

#Install LocalCloud CLI
npm install -g https://github.com/localcloud-dev/localcloud-cli

if [ "$1" = "join" ]; then
    echo ""
    echo ""
    echo "==================================================================================="
    echo ""
    echo "LocalCloud agent is installed. Use CLI on the first server to deploy services and apps on this server. "
    echo ""
    echo "==================================================================================="
    echo ""
    echo ""
else

    cd $HOME

    #Download TLS certificates for the web console
    sudo wget https://localcloud.dev/local_vpn_certificate -O /etc/ssl/vpn_fullchain.pem
    sudo wget https://localcloud.dev/local_vpn_key -O /etc/ssl/vpn_private.key

    caddy reload

    #Start Docker container registry, in the current version the first server/root server is a build machine as well
    #We'll add special build nodes/machines in next version
    sudo docker container run -dt -p 7000:5000 --name depl-registry --volume depl-registry:/var/lib/registry:Z docker.io/library/registry:2

    echo ""
    echo ""
    echo "==================================================================================="
    echo ""
    echo ""
    echo "LocalCloud agent is installed. Use LocalCloud CLI to manage servers, local machines, services, apps, deployments and localhost tunnels. Check localcloud.dev/docs/cli for more information."
    echo ""
    echo "To run LocalCloud CLI:"
    echo ""
    echo "      localcloud"
    echo ""
    echo ""
    echo "==================================================================================="
    echo ""
    echo ""
fi

#Reboot (optional)
#reboot