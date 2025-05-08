// src/auth.ts
import { Env } from './types';

interface BolComToken {
    access_token: string;
    expiry_time: number;
    token_type: string;
    scope?: string;
}

// Encode credentials to base64 (used in Authorization header)
function encodeCredentials(clientId: string, clientSecret: string): string {
    const credentials = `${clientId}:${clientSecret}`;
    try {
        return btoa(credentials); // Using browser's btoa
    } catch (e) {
        // Fallback for environments where btoa may fail
        const encoder = new TextEncoder();
        const data = encoder.encode(credentials);
        let binary = '';
        data.forEach(byte => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary); // Encode in base64
    }
}

// Fetch token from Durable Object storage
async function getTokenFromStorage(env: Env): Promise<BolComToken | null> {
    // Ensure that the Durable Object is correctly bound
    const id = env.MCP_OBJECT.idFromName('bolcom_token');
    const stub = env.MCP_OBJECT.get(id);
    
    // Ensure that you're using the correct request path for your Durable Object
    const response = await stub.fetch('/get-token'); // Assuming '/get-token' route is correctly handled

    if (response.status === 404) {
        return null; // Token not found, return null
    }

    return await response.json(); // Return the token data
}

// Save token to Durable Object storage
async function saveTokenToStorage(env: Env, token: BolComToken): Promise<void> {
    const id = env.MCP_OBJECT.idFromName('bolcom_token');
    const stub = env.MCP_OBJECT.get(id);

    // Ensure you're using the correct path for saving the token
    await stub.fetch('/save-token', {
        method: 'POST',
        body: JSON.stringify(token),
    });
}

// Main function to get or fetch the access token
export async function getAccessToken(env: Env): Promise<string> {
    const now = Date.now();
    let token = await getTokenFromStorage(env);
    const validityBuffer = 120 * 1000; // Buffer to account for slight expiry differences

    // If token is valid, return it
    if (token && token.expiry_time > now + validityBuffer) {
        console.log("Using valid cached token.");
        return token.access_token;
    }

    console.log("Token invalid or not found. Requesting new token.");

    // Encode credentials to base64 for Authorization header
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
        // Fetch new token from Bol.com
        const response = await fetch(tokenUrl, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error fetching Bol.com token: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error(`Failed to get Bol.com access token: ${response.statusText}`);
        }

        // Parse response to get token details
        const data: any = await response.json();
        const newBolComToken: BolComToken = {
            access_token: data.access_token,
            expiry_time: now + data.expires_in * 1000, // Expiry time in ms
            token_type: data.token_type,
            scope: data.scope,
        };

        // Save token in Durable Object storage
        await saveTokenToStorage(env, newBolComToken);
        console.log("Successfully obtained and saved new token.");
        return newBolComToken.access_token;
    } catch (error) {
        console.error("Exception while fetching Bol.com token:", error);
        throw error; // Rethrow the error to handle it at a higher level
    }
}
