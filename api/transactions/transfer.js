const apiHandler = require('../../api/[...path]');

module.exports = async (req, res) => {
    req.url = `/api/transactions/transfer${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
    return apiHandler(req, res);
};
