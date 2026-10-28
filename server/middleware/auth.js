export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!req.user) {
    return res.status(401).json({ error: "Session user not found" });
  }
  next();
}

export function attachUser(req, res, next) {
  req.user = null;
  if (req.session?.userId) {
    const { findById, toPublicUser } = req._userModel;
    const row = findById(req.session.userId);
    if (row) req.user = toPublicUser(row);
    else req.session.userId = null;
  }
  next();
}

// For Socket.IO
export function socketAttachUser(sessionMiddleware) {
  return (socket, next) => {
    sessionMiddleware(socket.request, {}, () => {
      const sess = socket.request.session;
      if (!sess?.userId) return next(new Error("Not authenticated"));
      next();
    });
  };
}