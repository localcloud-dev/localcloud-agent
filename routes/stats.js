/*
    stats.js
    Methods for deploying projects
*/

module.exports = function (app) {

    app.get('/stats/:hook_key', function (req, res) {
        if (req.params.hook_key != global.cluster_config.hook_key) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Invalid token. Check that a hook url you added to this git repository is correct." }));
          return;
        }
        res.statusCode = 200;
        res.end(JSON.stringify(global.stats));
      });

}