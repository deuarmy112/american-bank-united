const apiHandler = require('../../api/[...path].js');

module.exports = (req, res) => {
    const requestPath = req.url.split('?')[0].replace(/^\/api\/?/, '');
    req.url = `/api/auth/${requestPath.replace(/^auth\/?/, '')}`;
    return apiHandler(req, res);
};