// Authentication middleware for Daedalus

export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  console.log('requireAdmin check:', {
    hasSession: !!req.session,
    userId: req.session?.userId,
    role: req.session?.role,
    fullSession: req.session
  });

  if (!req.session || !req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.session || !req.session.userId || !['admin', 'user'].includes(req.session.role)) {
    return res.status(403).json({ error: 'User or admin access required' });
  }
  next();
}
