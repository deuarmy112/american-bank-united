const apiHandler = require('../../[...path].js');

module.exports = (req, res) => {
    const requestPath = req.url.split('?')[0].replace(/^\/api\/?/, '');
    req.url = `/api/admin/users/${requestPath.split('/').pop()}`;
    return apiHandler(req, res);
};
