function requireAuth(req, res, next) {
  if (req.session && req.session.angel && req.session.angel.jwtToken) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
}

module.exports = { requireAuth };
