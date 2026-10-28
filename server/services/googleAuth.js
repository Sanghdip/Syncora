import { OAuth2Client } from "google-auth-library";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!CLIENT_ID) {
  console.warn("⚠️  GOOGLE_CLIENT_ID not set — Google login will fail");
}

const client = new OAuth2Client(CLIENT_ID);

export async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing Google credential");
  }
  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Invalid Google token payload");
  if (!payload.sub) throw new Error("Google token missing subject");
  if (payload.email_verified !== true) {
    throw new Error("Google email is not verified");
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: true,
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture || null,
  };
}