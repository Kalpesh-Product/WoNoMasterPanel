// Tags requests with the module name shown in the logs table. Controllers can
// merge richer detail (page, changes, creditsUsed, publishState) into
// req.logContext later; auditLogger reads it when the response finishes.
const setLogModule = (module) => (req, res, next) => {
  req.logContext = { ...(req.logContext || {}), module };
  next();
};

module.exports = { setLogModule };
