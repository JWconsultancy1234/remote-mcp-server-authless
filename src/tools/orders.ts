// src/tools/orders.ts

import { z } from "zod"; // Importeren voor parameterdefinitie
// Importeren van de bol.com API helper functies voor orders
// (Aangenomen dat deze functies bestaan in bol-api.ts op basis van de API docs)
import { getOrdersList, getSingleOrder } from "../bol-api";
import { Env } from "../index"; // Importeren van het Env type

// Definieer de Zod schema's voor de parameters van de tools

// Parameters voor getOrdersList tool (voor het ophalen van een lijst van orders)
const GetOrdersListParams = z.object({
    page: z.number().int().positive().optional().describe('Het paginanummer van de lijst met orders. Standaard is 1.'), // Standaard is 1 [4, 5]
    fulfilmentMethod: z.enum(['FBR', 'FBB', 'ALL']).optional().describe('Filter orders op fulfillment methode. "FBR" voor Fulfilled by the Retailer, "FBB" voor Fulfilled by bol.com, "ALL" voor beide. Standaard is FBR, maar "ALL" kan nuttig zijn voor BI.'), // Standaard is FBR [4]
    status: z.enum(['OPEN', 'SHIPPED', 'ALL']).optional().describe('Filter orders op status. "OPEN" voor openstaande orders, "SHIPPED" voor verzonden orders, "ALL" voor alle statussen. Standaard is OPEN.'), // Standaard is OPEN [4, 6]
    latestChangeDate: z.string().optional().describe('Filter orders op laatste wijzigingsdatum (YYYY-MM-DD).'), // Gebaseerd op Airtable voorbeeld [5] - kan nuttig zijn voor incrementele updates. Let op: API docs specificeren niet dit exacte parameterformaat, maar AirTable voorbeeld suggereert iets vergelijkbaars. Controleren in officiële docs is aanbevolen.
});

// Parameters voor getSingleOrder tool (voor het ophalen van een enkele order)
const GetSingleOrderParams = z.object({
    orderId: z.string().describe('Het verplichte ID van de order die opgehaald moet worden.'), // Vereist path parameter [1]
});

// Definieer en exporteer de tools gerelateerd aan de Orders API
export const ordersTools = [
    {
        name: 'getOrdersList',
        description: 'Haalt een gepagineerde lijst van orders op. Kan gefilterd worden op paginanummer, fulfilment methode (FBR/FBB/ALL) en status (OPEN/SHIPPED/ALL). Nuttig voor overzichten en batchverwerking van orderinformatie.', // Beschrijving gebaseerd op [3-5]
        parameters: GetOrdersListParams,
        execute: async ({ params, env }: { params: z.infer<typeof GetOrdersListParams>, env: Env }) => {
            try {
                // Roep de helper functie aan voor de orders lijst
                // De API verwacht query parameters zoals page, fulfilment-method, status
                // latest-change-date is ook een potentiële filter [5]
                const data = await getOrdersList(env, params.page, params.fulfilmentMethod, params.status, params.latestChangeDate);

                // Retourneer de data als JSON voor de AI om te analyseren
                // De response bevat o.a. orderId, orderItems (met unitPrice), fulfilmentMethod etc. [1, 4]
                return {
                    content: [{ type: 'json', json: data }]
                };
            } catch (error: any) {
                // Handel API of andere fouten af
                console.error('Error in getOrdersList tool:', error);
                return {
                    content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van de orders lijst: ${error.message}.` }]
                };
            }
        },
    },
    {
        name: 'getSingleOrder',
        description: 'Haalt gedetailleerde informatie op voor een specifieke order met het gegeven order ID. Geeft inzicht in de bestelde items, prijzen (inclusief volumekorting) en fulfillment methode voor die specifieke order.', // Beschrijving gebaseerd op [1, 3]
        parameters: GetSingleOrderParams,
        execute: async ({ params, env }: { params: z.infer<typeof GetSingleOrderParams>, env: Env }) => {
            try {
                // Roep de helper functie aan voor een enkele order
                // Het orderId is een path parameter voor dit endpoint [1]
                const data = await getSingleOrder(env, params.orderId);

                // Retourneer de data als JSON
                return {
                    content: [{ type: 'json', json: data }]
                };
            } catch (error: any) {
                // Handel fouten af
                console.error('Error in getSingleOrder tool for Order ID', params.orderId, ':', error);
                return {
                    content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van order details voor Order ID ${params.orderId}: ${error.message}.` }]
                };
            }
        },
    },
    // Voeg hier eventueel meer tools voor Orders API toe
];