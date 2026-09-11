const apiHandler = require('../../../[...path].js');

module.exports = (req, res) => {
    const requestPath = req.url.split('?')[0].replace(/^\/api\/?/, '');
    const accountId = requestPath.split('/').filter(Boolean).slice(-2, -1)[0];
    req.url = `/api/admin/accounts/${accountId}/adjust-balance`;
    return apiHandler(req, res);
};