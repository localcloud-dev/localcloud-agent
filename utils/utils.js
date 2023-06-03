
function get_vpn_node_info(server_id){
    let vpn_node = global.vpn_nodes.find(node => {
        return node.id === server_id
    })

    return vpn_node;
}

module.exports = {get_vpn_node_info}

