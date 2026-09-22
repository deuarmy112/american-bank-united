const apiHandler = require('../../../../[...path].js');

module.exports = (req, res) => {
    const requestPath = req.url.split('?')[0].replace(/^\/api\/?/, '');
    const parts = requestPath.split('/').filter(Boolean);
    const usersIndex = parts.indexOf('users');
    const userId = usersIndex >= 0 ? parts[usersIndex + 1] : '';
    req.url = `/api/admin/users/${userId}/status`;
    return apiHandler(req, res);
};
