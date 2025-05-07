// Importeer benodigde typen en eventuele helpers
import { ExecutionContext } from '@cloudflare/workers-types'; // Importeer indien nodig

// Definieer een interface voor je omgeving variabelen
interface Env {
  BOL_CLIENT_ID: string;
  BOL_CLIENT_SECRET: string;
  // Voeg hier eventueel de binding toe voor je Durable Object als je die gebruikt
  // MCP_OBJECT: DurableObjectNamespace;
}

// Definieer een structuur voor de opgeslagen token informatie
interface BolComToken {
  access_token: string;
  expiry_time: number; // Timestamp in milliseconden
  token_type: string;
  scope?: string; // Scope is optioneel in de response structuur
}

// Functie om credentials Base64 te encoderen (zoals in bronnen [48, 49, 54, 55, 60, 63])
function encodeCredentials(clientId: string, clientSecret: string): string {
  const credentials = `${clientId}:${clientSecret}`;
  // In een Worker kun je btoa gebruiken voor ASCII-strings, of TextEncoder/Decoder
  // Btoa werkt meestal voor deze simpele case
  try {
    return btoa(credentials);
  } catch (e) {
    // Fallback voor non-ASCII, hoewel onwaarschijnlijk voor client credentials
    const encoder = new TextEncoder();
    const data = encoder.encode(credentials);
    let binary = '';
    data.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
}

// Simulatie van token opslag/ophalen. Vervang dit door je Durable Object of KV logica.
// Dit zijn placeholder functies!
async function getTokenFromStorage(/* storage identifier */): Promise<BolComToken | null> {
  // Implementeer logica om token op te halen uit Durable Object state of KV
  console.log("Attempting to retrieve token from storage (placeholder)");
  // Voorbeeld: const storedToken = await storage.get<BolComToken>('bolcom_token'); return storedToken;
  return null; // Simuleer dat er nog geen token is
}

async function saveTokenToStorage(token: BolComToken /*, storage identifier */): Promise<void> {
  // Implementeer logica om token op te slaan in Durable Object state of KV
  console.log("Saving token to storage (placeholder)", token);
  // Voorbeeld: await storage.put('bolcom_token', token);
}

// Functie om de access token op te halen of te vernieuwen

export async function getAccessToken(env: Env /*, storage identifier */): Promise<string> {
  const now = Date.now();
  // Haal de token op uit opslag (placeholder)
  let token = await getTokenFromStorage(/* storage identifier */);

  // Controleer of de token geldig is (verloopt niet binnen de volgende 120 seconden, zoals in bron [49, 55])
  // Houd rekening met een buffer, bijv. 2 minuten = 120 * 1000 ms
  const validityBuffer = 120 * 1000;

  if (token && token.expiry_time > now + validityBuffer) {
    console.log("Using valid cached token.");
    return token.access_token;
  }

  console.log("Token invalid or not found. Requesting new token.");

  // Token is ongeldig of bestaat niet, vraag een nieuwe aan
  const base64Credentials = encodeCredentials(env.BOL_CLIENT_ID, env.BOL_CLIENT_SECRET);
  const tokenUrl = 'https://login.bol.com/token?grant_type=client_credentials'; // [50, 56, 60, 63]

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${base64Credentials}`, // [50, 56, 60, 63]
      'Content-Type': 'application/x-www-form-urlencoded', // [50, 56, 60, 63]
    },
  };

  try {
    const response = await fetch(tokenUrl, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching Bol.com token: ${response.status} ${response.statusText} - ${errorText}`); // [50, 57, 59, 61, 64]
      throw new Error(`Failed to get Bol.com access token: ${response.statusText}`);
    }

    const data: any = await response.json(); // [50, 57, 61, 64]

    const newBolComToken: BolComToken = {
      access_token: data.access_token,
      expiry_time: now + data.expires_in * 1000, // expires_in is in seconden [50, 57, 61, 64]
      token_type: data.token_type, // [50, 57, 61, 64]
      scope: data.scope, // [50, 57, 61, 64]
    };

    // Sla de nieuwe token op (placeholder)
    await saveTokenToStorage(newBolComToken /*, storage identifier */);

    console.log("Successfully obtained and saved new token.");
    return newBolComToken.access_token;

  } catch (error) {
    console.error("Exception while fetching Bol.com token:", error);
    throw error;
  }
}

// Je zou een klasse kunnen maken die de opslag en de get/refresh logica omvat
// Bijvoorbeeld, als je een Durable Object gebruikt voor token opslag:

/*
// In src/auth.ts (of een aparte token_storage.ts)
export class TokenStorage {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    // Kunnen env hier doorgeven als credentials nodig zijn, maar beter via getBolComAccessToken
  }

  async getToken(): Promise<BolComToken | null> {
     const storedToken = await this.storage.get<BolComToken>('bolcom_token');
     return storedToken || null;
  }

  async saveToken(token: BolComToken): Promise<void> {
     await this.storage.put('bolcom_token', token);
  }

   // Je getAccessToken functie zou dan een instantie van TokenStorage meekrijgen
   // getAccessToken(env: Env, tokenStorage: TokenStorage): Promise<string> { ... }
}
*/