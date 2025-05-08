import { z } from "zod"; // Importeren voor parameterdefinitie
// Importeren van de bol.com API helper functies voor orders
// (Aangenomen dat deze functies bestaan in bol-api.ts op basis van de API docs)
import { getOrdersList, getSingleOrder } from "../bol-api";
import { Env } from "../index"; // Importeren van het Env type

// Definieer de Zod schema's voor de parameters van de tools

// Parameters voor getOrdersList tool (voor het ophalen van een lijst van orders)
const GetOrdersListParams = z.object({
    page: z.number().int().positive().optional().describe('Het paginanummer van de lijst met orders. Standaard is 1.'), // Standaard is 1
    fulfilmentMethod: z.enum(['FBR', 'FBB', 'ALL']).optional().describe('Filter orders op fulfillment methode. "FBR" voor Fulfilled by the Retailer, "FBB" voor Fulfilled by bol.com, "ALL" voor beide. Standaard is FBR, maar "ALL" kan nuttig zijn voor BI.'),
    status: z.enum(['OPEN', 'SHIPPED', 'ALL']).optional().describe('Filter orders op status. "OPEN" voor openstaande orders, "SHIPPED" voor verzonden orders, "ALL" voor alle statussen. Standaard is OPEN.'),
    latestChangeDate: z.string().optional().describe('Filter orders op laatste wijzigingsdatum (YYYY-MM-DD).'),
});

// Parameters voor getSingleOrder tool (voor het ophalen van een enkele order)
const GetSingleOrderParams = z.object({
    orderId: z.string().describe('Het verplichte ID van de order die opgehaald moet worden.'),
});

// Definieer en exporteer de tools gerelateerd aan de Orders API
export const ordersTools = [
    {
        name: 'getOrdersList',
        description: 'Haalt een gepagineerde lijst van orders op. Kan gefilterd worden op paginanummer, fulfilment methode (FBR/FBB/ALL) en status (OPEN/SHIPPED/ALL). Nuttig voor overzichten en batchverwerking van orderinformatie.',
        parameters: GetOrdersListParams,
        execute: async (params: z.infer<typeof GetOrdersListParams>, env: Env) => {
            try {
                // Roep de helper functie aan voor de orders lijst
                // De API verwacht query parameters zoals page, fulfilment-method, status
                // latest-change-date is ook een potentiële filter
                const data = await getOrdersList(env, params.page, params.fulfilmentMethod, params.status, params.latestChangeDate);

                // Retourneer de data als JSON voor de AI om te analyseren
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
        description: 'Haalt gedetailleerde informatie op voor een specifieke order met het gegeven order ID. Geeft inzicht in de bestelde items, prijzen (inclusief volumekorting) en fulfillment methode voor die specifieke order.',
        parameters: GetSingleOrderParams,
        execute: async (params: z.infer<typeof GetSingleOrderParams>, env: Env) => {
            try {
                // Roep de helper functie aan voor een enkele order
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
