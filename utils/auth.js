const bcrypt = require('bcrypt');

async function validate_token(headers){
    const token = headers["api-token"];
    var result = false;
    for await (const hashed_token of global.service_node_config.hashed_tokens) {
        result = await bcrypt.compare(token, hashed_token);
        if (result == true){
            return result;
        }
    }
    return result;
}

module.exports = {validate_token}