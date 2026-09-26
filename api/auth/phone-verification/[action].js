const apiHandler = require('../../../api/[...path].js');

module.exports = (req, res) => {
    const rawAction = req.query.action || req.url.split('?')[0].split('/').pop();
    const action = Array.isArray(rawAction) ? rawAction.join('/') : String(rawAction || '');
    req.url = `/api/auth/phone-verification/${action}`;
    return apiHandler(req, res);
};
