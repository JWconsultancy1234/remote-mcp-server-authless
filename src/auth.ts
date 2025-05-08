// src/auth.ts
import { Env } from './types';

interface BolComToken {
    access_token: string;
    expiry_time: number;
    token_type: string;
    scope?: string;
}

function encodeCredentials(clientId: string, clientSecret: string): string {
    const credentials = `${clientId}:${clientSecret}`;
    try {
        return btoa(credentials);
    } catch (e) {
        const encoder = new TextEncoder();
        const data = encoder.encode(credentials);
        let binary = '';
        data.forEach(byte => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }
}

async function getTokenFromStorage(env: Env): Promise<BolComToken | null> {
    // Use MCP_OBJECT Durable Object storage
    const id = env.MCP_OBJECT.idFromName('bolcom_token');
    const stub = env.MCP_OBJECT.get(id);
    const response = await stub.fetch(new Request('http://localhost/get-token'));
    if (response.status === 404) {
        return null;
    }
    return await response.json();
}

async function saveTokenToStorage(env: Env, token: BolComToken): Promise<void> {
    // Use MCP_OBJECT Durable Object storage
    const id = env.MCP_OBJECT.idFromName('bolcom_token');
    const stub = env.MCP_OBJECT.get(id);
    await stub.fetch(new Request('http://localhost/save-token', {
        method: 'POST',
        body: JSON.stringify(token),
    }));
}

export async function getAccessToken(env: Env): Promise<string> {
    const now = Date.now();
    let token = await getTokenFromStorage(env);
    const validityBuffer = 120 * 1000;

    if (token && token.expiry_time > now + validityBuffer) {
        console.log("Using valid cached token.");
        return token.access_token;
    }

    console.log("Token invalid or not found. Requesting new token.");
    const base64Credentials = encodeCredentials(env.BOL_CLIENT_ID, env.BOL_CLIENT_SECRET);
    const tokenUrl = 'https://login.bol.com/token?grant_type=client_credentials';

    const options: RequestInit = {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${base64Credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    };

    try {
        const response = await fetch(tokenUrl, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error fetching Bol.com token: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error(`Failed to get Bol.com access token: ${response.statusText}`);
        }

        const data: any = await response.json();
        const newBolComToken: BolComToken = {
            access_token: data.access_token,
            expiry_time: now + data.expires_in * 1000,
            token_type: data.token_type,
            scope: data.scope,
        };

        await saveTokenToStorage(env, newBolComToken);
        console.log("Successfully obtained and saved new token.");
        return newBolComToken.access_token;
    } catch (error) {
        console.error("Exception while fetching Bol.com token:", error);
        throw error;
    }
}
