const apiHandler = require('../../../[...path].js');

module.exports = (req, res) => {
    req.url = `/api/admin/accounts/${req.query.id}/reject`;
    return apiHandler(req, res);
};
