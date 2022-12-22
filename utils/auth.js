const bcrypt = require('bcrypt');

async function validate_token(token){
    return await bcrypt.compare(token, global.service_node_config.hashed_token);
}

module.exports = {validate_token}