const apiHandler = require('../../[...path].js');

module.exports = (req, res) => {
    req.url = '/api/admin/accounts/pending';
    return apiHandler(req, res);
};
