import { getAccessToken } from './auth'; // Importeer de functie uit je auth bestand
import { Env } from './index'; // Importeer je Env type uit index.ts

const BOL_API_BASE_URL = 'https://api.bol.com/retailer';

export async function callBolApi(
    endpoint: string,
    method: string,
    env: Env, // Cloudflare Worker environment met geheimen
    options: {
        headers?: Record<string, string>;
        query?: Record<string, any>;
        body?: any;
        contentType?: string;
    } = {}
): Promise<any> {
    try {
        // Stap 1: Verkrijg het toegangstoken.
        // De getAccessToken functie in src/auth.ts moet dit afhandelen,
        // inclusief het vernieuwen indien nodig.
        const accessToken = await getAccessToken(env); // Gebruik de env voor secrets

        // Stap 2: Definieer de volledige URL inclusief query parameters.
        const url = new URL(`${BOL_API_BASE_URL}${endpoint}`);
        if (options.query) {
            Object.keys(options.query).forEach(key =>
                url.searchParams.append(key, options.query[key])
            );
        }

        // Stap 3: Definieer de headers, inclusief authenticatie en content type.
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.retailer.v10+json', // Standaard JSON acceptatie [2, etc.]
            ...options.headers,
        };

        // Stel de Content-Type header in indien een body aanwezig is
        if (options.body && method !== 'GET' && method !== 'HEAD') {
            headers['Content-Type'] = options.contentType || 'application/vnd.retailer.v10+json'; 
        }


        // Stap 4: Maak de fetch opties aan.
        const fetchOptions: RequestInit = {
            method: method,
            headers: headers,
            body: options.body ? JSON.stringify(options.body) : undefined, // JSON body indien aanwezig
        };

        // Stap 5: Voer de fetch call uit.
        console.log(`Calling BOL API: ${method} ${url}`);
        const response = await fetch(url.toString(), fetchOptions);

        // Stap 6: Verwerk het antwoord.
        // API fouten zoals 400 Bad Request of 404 Not Found afhandelen [2, 5, 15, 17, etc.]
        if (!response.ok) {
            let errorText = await response.text();
            console.error(`BOL API Error: ${response.status} - ${errorText}`);
            // Gooi een specifieke fout die in de MCP tool kan worden afgehandeld
            throw new Error(`BOL API Error: ${response.status} - ${errorText}`);
        }

        // Bij succesvolle request (200 OK, 202 Accepted, 207 Multi-Status) [2, 6, 152, etc.]
        // Controleer op 204 No Content
        if (response.status === 204) {
             return null; // Of een passend 'leeg' antwoord
        }

        // Sommige endpoints retourneren PDF of andere types [3-5]. Pas dit aan indien nodig.
        const contentType = response.headers.get('Content-Type');
        if (contentType?.includes('application/json') || contentType?.includes('application/vnd.retailer.v10+json')) {
             return await response.json();
        } else if (contentType?.includes('application/pdf') || contentType?.includes('application/vnd.retailer.v10+pdf')) {
             // Retourneer de Blob of ArrayBuffer voor PDF handling
             return await response.blob(); // Of await response.arrayBuffer()
        } else {
            // Onbekend content type, log of gooi fout
            console.warn(`Unexpected content type received: ${contentType}`);
            return await response.text(); // Of gooi een fout
        }


    } catch (error) {
        console.error('Error calling BOL API:', error);
        throw error; // Gooi de fout opnieuw om in de tool af te handelen
    }
}

// Voorbeeld functies voor specifieke endpoints:

/**
 * Haalt een gepagineerde lijst van factuurverzoeken op.
 * @param env - Cloudflare Worker environment
 * @param page - Paginanummer (integer, >= 1, default 1) [6]
 * @param shipmentId - Filteren op shipment ID (string) [6]
 * @param state - Filteren op staat (OPEN, UPLOAD_ERROR, ALL) [6]
 * @returns Gepagineerde lijst van factuurverzoeken
 */
export async function getInvoiceRequests(
    env: Env,
    page?: number,
    shipmentId?: string,
    state?: 'OPEN' | 'UPLOAD_ERROR' | 'ALL'
): Promise<any> {
    const query: Record<string, any> = {};
    if (page !== undefined) query.page = page;
    if (shipmentId !== undefined) query['shipment-id'] = shipmentId; [6]
    if (state !== undefined) query.state = state; [6]

    return callBolApi('/invoices', 'GET', env, { query }); [6]
}

/**
 * Haalt de specificatie van een factuur op basis van factuur ID.
 * @param env - Cloudflare Worker environment
 * @param invoiceId - ID van de factuur (string, vereist) [3]
 * @param page - Paginanummer voor transacties lijst (integer, >= 1) [3]
 * @param acceptContentType - Gewenste content type (JSON, PDF, HTML) [4, 5]
 * @returns Factuur specificatie of PDF/HTML data
 */
export async function getInvoiceDetails(
    env: Env,
    invoiceId: string,
    page?: number,
    acceptContentType: 'application/vnd.retailer.v10+json' | 'application/vnd.retailer.v10+pdf' | 'text/html' = 'application/vnd.retailer.v10+json'
): Promise<any> {
    const query: Record<string, any> = {};
    if (page !== undefined) query.page = page; [3]

    const headers = {
         'Accept': acceptContentType, // Specifieke acceptatie voor factuurformaten [3-5]
    };

    // Het pad is /retailer/invoices/{invoice-id} [3]
    return callBolApi(`/invoices/${invoiceId}`, 'GET', env, { query, headers }); [3]
}


/**
 * Haalt commissiedetails op voor een enkel product met een specifiek EAN.
 * Roept de GET /retailer/commission/{ean} endpoint aan. [2-4]
 * Vereist OAuth2 authenticatie. [2]
 *
 * @param {Env} env - Het omgevingsobject.
 * @param {string} ean - Het EAN nummer van het product. [2]
 * @param {number} unitPrice - De verkoopprijs van het product. [2] Moet met punt en 2 decimalen. [3]
 * @param {'NEW' | 'AS_NEW' | 'GOOD' | 'REASONABLE' | 'MODERATE'} [condition='NEW'] - De conditie van het offer. [2] Defaults to NEW. [2]
 * @returns {Promise<SingleCommissionResponse | null>} De commissiedetails of null bij falen.
 */
export async function getCommissionSingle(
    env: Env,
    ean: string,
    unitPrice: number,
    condition: 'NEW' | 'AS_NEW' | 'GOOD' | 'REASONABLE' | 'MODERATE' = 'NEW'
): Promise<SingleCommissionResponse | null> {
    try {
        // De endpoint path is /retailer/commission/{ean} [3]
        // unit-price en condition zijn query parameters [2]
        const queryParams = {
            'unit-price': unitPrice, // CallBolApi zal dit formatteren naar 2 decimalen met punt [3]
            condition: condition // [2]
        };

        const data: SingleCommissionResponse = await callBolApi(
            `/commission/${ean}`, // Endpoint path met EAN [3]
            'GET', // GET methode [3]
            env,
            { queryParams } // Query parameters [2]
        );

        console.log("Bol.com single commission data succesvol ontvangen.");
        return data;

    } catch (e: any) {
        console.error("Fout bij ophalen single Bol.com commissie:", e.message);
        return null;
    }
}

/**
 * Haalt commissiedetails op voor een lijst van producten in bulk.
 * Roept de POST /retailer/commission endpoint aan. [4-6]
 * Vereist OAuth2 authenticatie. [5]
 *
 * @param {Env} env - Het omgevingsobject.
 * @param {CommissionBulkProduct[]} products - Een array van producten met EAN, unitPrice en optioneel condition. Max 100 items. [5]
 * @returns {Promise<any | null>} De response van de bulk call (kan 200 of 207 zijn) of null bij falen. [6-8]
 */
export async function postCommissionsBulk(
     env: Env,
     products: CommissionBulkProduct[] // Input structuur met EAN, prijs, conditie
): Promise<any | null> {
    // Controleer het aantal items (1-100) [5]
    if (products.length === 0 || products.length > 100) {
        console.error(`Aantal EANs moet tussen 1 en 100 liggen voor bulk request, nu: ${products.length}`);
        throw new Error(`Aantal EANs moet tussen 1 en 100 liggen voor bulk request, nu: ${products.length}.`);
    }

    try {
        // De request body moet de key 'commissionQueries' bevatten [5]
        // en elk object moet 'ean', 'unitPrice' en optioneel 'condition' hebben [5]
        // unitPrice moet geformatteerd worden naar string met 2 decimalen en punt [3]
        const requestBody = {
             commissionQueries: products.map(p => ({
                 ean: p.ean, // [5]
                 unitPrice: parseFloat(p.unitPrice.toFixed(2)), // Formatteer prijs [3, 5] - parseFloat om zeker te zijn dat het een nummer blijft
                 condition: p.condition || 'NEW' // [5]. API default is NEW [2]
             }))
        };

        // Endpoint is POST /retailer/commission [4, 6]
        const data = await callBolApi(
            '/commission', // Endpoint path [6]
            'POST', // POST methode [6]
            env,
            {
                body: requestBody, // Request body [5]
                contentType: 'application/vnd.retailer.v10+json' // Vereiste content type [6]
            }
        );

        console.log("Bol.com bulk commission data succesvol ontvangen.");
        return data; // De response structuur is afhankelijk van het specifieke endpoint, kan anders zijn dan single [6, 8]

    } catch (e: any) {
        console.error("Fout bij ophalen bulk Bol.com commissie:", e.message);
        return null;
    }
}


/**
 * Haalt een gepagineerde lijst van orders op voor de retailer.
 * @param env - Cloudflare Worker environment
 * @param page - Paginanummer (integer, >= 1, default 1) [8]
 * @param fulfilmentMethod - Filter op fulfilment methode (FBR, FBB, ALL, default FBR) [8]
 * @param status - Filter op order status (OPEN, SHIPPED, ALL, default OPEN) [8]
 * @returns Gepagineerde lijst van orders
 */

export async function getOrdersList(accessToken: string, params: any) { // Functienaam aangepast naar getOrdersList
    let url = 'https://api.bol.com/retailer/orders?';
    // Hier de logica om de URL met parameters op te bouwen, vergelijkbaar met je fetch_orders code
    if (params.fulfilmentMethod) url += `fulfilment-method=${params.fulfilmentMethod}&`;
    if (params.status) url += `status=${params.status}&`;
    if (params.latestChangeDate) url += `latest-change-date=${params.latestChangeDate}&`;
    // ...etc.

    let options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`, // OAuth2 Authorisatie [1, etc.]
            'Accept': 'application/vnd.retailer.v10+json' // Content type [3, 8, 12, 15]
        }
    };

    // Hier de fetch logica, vergelijkbaar met je fetch_orders code [2, 3, 7-10]
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error: ${response.status} - ${errorText}`); // Afhandelen van API fouten [5]
            throw new Error(`API Error: ${response.status}`);
        }
        const data = await response.json(); // Verwerken van JSON response [16]
        return data.orders; // Of de volledige data, afhankelijk van wat de tool nodig heeft
    } catch (error) {
        console.error("Error fetching orders:", error);
        throw error; // Geef de fout door
    }
}

export async function getSingleOrder(accessToken: string, orderId: string) { // Functienaam aangepast naar getSingleOrder
    let url = `https://api.bol.com/retailer/orders/${orderId}`; // Endpoint voor enkele order [11, 14, 17]

   let options = {
       method: 'GET',
       headers: {
           'Authorization': `Bearer ${accessToken}`, // OAuth2 Authorisatie [1, etc.]
           'Accept': 'application/vnd.retailer.v10+json' // Content type [12, 15]
       }
   };

   // Hier de fetch logica, vergelijkbaar met je fetch_single_order code [11, 12, 14, 15]
    try {
       const response = await fetch(url, options);
        if (!response.ok) {
           const errorText = await response.text();
           console.error(`API Error: ${response.status} - ${errorText}`); // Afhandelen van API fouten [5]
           throw new Error(`API Error: ${response.status}`);
       }
       const data = await response.json(); // Verwerken van JSON response [16]
       return data;
   } catch (error) {
       console.error("Error fetching single order:", error);
       throw error; // Geef de fout door
   }
}

/**
 * Haalt de details van een specifieke order op.
 * @param env - Cloudflare Worker environment
 * @param orderId - ID van de order (string, vereist) [11]
 * @returns Order details
 */
export async function getOrderDetails(
    env: Env,
    orderId: string
): Promise<any> {
    // Endpoint is get/retailer/orders/{order-id} [11]
    return callBolApi(`/orders/${orderId}`, 'GET', env); [11]
}

// Voeg hier eventueel meer helperfuncties toe voor andere API's zoals Shipments [12, 13], Returns [14, 15], etc.
// ...
