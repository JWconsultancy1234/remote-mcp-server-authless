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
        return btoa(credentials); // Browser's btoa for encoding credentials
    } catch (e) {
        // Fallback for environments where btoa might fail
        const encoder = new TextEncoder();
        const data = encoder.encode(credentials);
        let binary = '';
        data.forEach(byte => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary); // Encode in base64
    }
}

async function getTokenFromStorage(env: Env): Promise<BolComToken | null> {
    // Use MCP_OBJECT Durable Object storage
    const id = env.MCP_OBJECT.idFromName('bolcom_token');
    const stub = env.MCP_OBJECT.get(id);

    // Correct the URL path for Durable Object requests (removing localhost)
    const response = await stub.fetch(new Request('/get-token'));  // Assuming you're handling /get-token in Durable Object
    if (response.status === 404) {
        return null;
    }
    return await response.json();  // Return token from Durable Object
}

async function saveTokenToStorage(env: Env, token: BolComToken): Promise<void> {
    // Use MCP_OBJECT Durable Object storage
    const id = env.MCP_OBJECT.idFromName('bolcom_token');
    const stub = env.MCP_OBJECT.get(id);

    // Correct the URL path for Durable Object requests (removing localhost)
    await stub.fetch(new Request('/save-token', {
        method: 'POST',
        body: JSON.stringify(token),
    }));
}

export async function getAccessToken(env: Env): Promise<string> {
    const now = Date.now();
    let token = await getTokenFromStorage(env);
    const validityBuffer = 120 * 1000; // Buffer time to account for token expiry

    // Use cached token if it’s still valid
    if (token && token.expiry_time > now + validityBuffer) {
        console.log("Using valid cached token.");
        return token.access_token;
    }

    console.log("Token invalid or not found. Requesting new token.");

    // Encode client credentials
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
        // Fetch new token from Bol.com API
        const response = await fetch(tokenUrl, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error fetching Bol.com token: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error(`Failed to get Bol.com access token: ${response.statusText}`);
        }

        // Parse token from response
        const data: any = await response.json();
        const newBolComToken: BolComToken = {
            access_token: data.access_token,
            expiry_time: now + data.expires_in * 1000,
            token_type: data.token_type,
            scope: data.scope,
        };

        // Save new token to Durable Object storage
        await saveTokenToStorage(env, newBolComToken);
        console.log("Successfully obtained and saved new token.");
        return newBolComToken.access_token;
    } catch (error) {
        console.error("Exception while fetching Bol.com token:", error);
        throw error;
    }
}
