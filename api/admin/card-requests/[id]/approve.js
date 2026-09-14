const apiHandler = require('../../../[...path].js');

module.exports = (req, res) => {
    const requestPath = req.url.split('?')[0].replace(/^\/api\/?/, '');
    const requestId = requestPath.split('/').filter(Boolean).slice(-2, -1)[0];
    req.url = `/api/admin/card-requests/${requestId}/approve`;
    return apiHandler(req, res);
};
