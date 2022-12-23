const bcrypt = require('bcrypt');

async function validate_token(headers){
    const token = headers["api-token"];
    return await bcrypt.compare(token, global.service_node_config.hashed_token);
}

module.exports = {validate_token}