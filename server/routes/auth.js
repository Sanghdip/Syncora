import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import * as Users from '../models/users.js';

const router = express.Router();

// Disable caching for all /api/auth/* responses so browsers never serve a stale
// "logged out" body after login.
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
  || 'http://localhost:4000/api/auth/google/callback';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

const oauthClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// ---------------------------------------------------------------------------
// POST /api/auth/guest
// ---------------------------------------------------------------------------
router.post('/guest', async (req, res) => {
  try {
    const user = await Users.createGuest();
    req.session.userId = user.id;
    req.session.save(err => {
      if (err) {
        console.error('Session save failed:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }
      res.json({ user: Users.toPublicUser(user) });
    });
  } catch (err) {
    console.error('Guest login error:', err);
    res.status(500).json({ error: 'Guest login failed', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
router.get('/me', async (req, res) => {
  try {
    if (req.session?.userId) {
      const row = await Users.findById(req.session.userId);
      if (row) return res.json({ user: Users.toPublicUser(row) });
      req.session.userId = null;
    }
    res.json({ user: null });
  } catch (err) {
    console.error('/me error:', err);
    res.status(500).json({ error: '/me failed', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('nr.sid');
    res.json({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/google — redirect flow
// ---------------------------------------------------------------------------
router.get('/google', (req, res) => {
  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

// ---------------------------------------------------------------------------
// POST /api/auth/google — GSI credential flow
// ---------------------------------------------------------------------------
router.post('/google', async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: 'Missing credential' });
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const emailVerified = payload.email_verified;
    const name = payload.name;
    const picture = payload.picture;

    let user = await Users.findByGoogleId(googleId);

    if (user) {
      await Users.touchLastLogin(user.id);
      user = await Users.findById(user.id);
    } else {
      const currentUserId = req.session?.userId;
      const currentUser = currentUserId ? await Users.findById(currentUserId) : null;

      if (currentUser && currentUser.is_guest) {
        user = await Users.upgradeGuestToGoogle(currentUser.id, {
          googleId, email, emailVerified, name, picture,
        });
      } else {
        user = await Users.createGoogleUser({
          googleId, email, emailVerified, name, picture,
        });
      }
    }

    req.session.userId = user.id;
    req.session.save(err => {
      if (err) {
        console.error('Session save failed:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }
      res.json({ user: Users.toPublicUser(user) });
    });
  } catch (err) {
    console.error('Google verify error:', err);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/google/callback — redirect flow callback
// ---------------------------------------------------------------------------
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const emailVerified = payload.email_verified;
    const name = payload.name;
    const picture = payload.picture;

    let user = await Users.findByGoogleId(googleId);

    if (user) {
      await Users.touchLastLogin(user.id);
      user = await Users.findById(user.id);
    } else {
      const currentUserId = req.session?.userId;
      const currentUser = currentUserId ? await Users.findById(currentUserId) : null;

      if (currentUser && currentUser.is_guest) {
        user = await Users.upgradeGuestToGoogle(currentUser.id, {
          googleId, email, emailVerified, name, picture,
        });
      } else {
        user = await Users.createGoogleUser({
          googleId, email, emailVerified, name, picture,
        });
      }
    }

    req.session.userId = user.id;
    req.session.save(err => {
      if (err) {
        console.error('Session save failed:', err);
        return res.status(500).send('Session save failed');
      }
      res.redirect(CLIENT_ORIGIN);
    });
  } catch (err) {
    console.error('Google callback error:', err);
    res.status(500).send('Google login failed');
  }
});

export default router;