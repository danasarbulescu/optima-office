import express from 'express';
import { Server } from 'http';
import { exchangeCodeForTokens } from './auth';
import { TokenData } from './types';

export function startCallbackServer(
  oauthClient: any
): Promise<{ tokenData: TokenData; server: Server }> {
  return new Promise((resolve, reject) => {
    const app = express();
    let server: Server;

    app.get('/callback', async (req, res) => {
      try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const tokenData = await exchangeCodeForTokens(oauthClient, fullUrl);

        res.send(
          '<h2>Authorization successful!</h2>' +
          '<p>You can close this window and return to the terminal.</p>'
        );

        resolve({ tokenData, server });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).send(`<h2>Authorization failed</h2><p>${message}</p>`);
        reject(err);
      }
    });

    const port = parseInt(process.env.REDIRECT_URI?.split(':').pop()?.split('/')[0] || '3000', 10);
    server = app.listen(port, () => {
      console.log(`Callback server listening on port ${port}`);
    });

    server.on('error', reject);
  });
}
