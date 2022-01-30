/*
	auth.js
	Methods for managing authorization
*/
const superagent = require('superagent');

const Parse = require('parse/node');
const ParseAppId = process.env.PARSE_APP_ID;
Parse.initialize(ParseAppId);
Parse.serverURL = process.env.PARSE_SERVER_URL;

class Auth {
    async handleAllReqs(req, res) {
        //Check that request has a token
        let token = req.headers['authorization'];

        if (!token) {
            res.statusCode = 401;
            res.end(JSON.stringify({ message: "Unable to authenticate you.", id: "unauthorized" }));
            return null;
        }

        //Check if a token is valid and get an user by token
        try {
            const res = await superagent.get(Parse.serverURL + '/users/me').send({}).set({ 'X-Parse-Application-Id': ParseAppId, 'X-Parse-Session-Token': token }).set('accept', 'json');
            console.log(res.statusCode);
            if (res.statusCode == 200) {
                res.statusCode = 200;
                return res.body;
            } else {
                res.statusCode = 401;
                res.end(JSON.stringify({ message: "Unable to authenticate you.", id: "unauthorized" }));
                return null;
            }
        } catch (err) {
            res.statusCode = 401;
            res.end(JSON.stringify({ message: "Unable to authenticate you.", id: "unauthorized", add_info: err }));
            return null;
        }
    }
}
module.exports = Auth;