import { z } from "zod"; // Importeren voor parameterdefinitie
// Importeren van de bol.com API helper functies
import { getInvoiceRequests, getInvoiceDetails } from "../bol-api";
import { Env } from "../index"; // Importeren van het Env type

// Definieer de Zod schema's voor de parameters van de tools

// Parameters voor getInvoiceList tool
const GetInvoiceListParams = z.object({
    page: z.number().int().positive().optional().describe('Het paginanummer om op te vragen (>= 1). Standaard is 1.'),
    shipmentId: z.string().optional().describe('Filter de factuurverzoeken op een specifiek shipment ID.'),
    state: z.enum(['OPEN', 'UPLOAD_ERROR', 'ALL']).optional().describe('Filter de factuurverzoeken op status (OPEN, UPLOAD_ERROR, ALL). Standaard is ALL.'),
});

// Parameters voor getInvoiceDetails tool
const GetInvoiceDetailsParams = z.object({
    invoiceId: z.string().describe('Het verplichte ID van de factuur waarvan de details moeten worden opgehaald.'),
    page: z.number().int().positive().optional().describe('Het paginanummer voor de lijst van transacties binnen de factuurspecificatie (>= 1).'),
});

// Definieer en exporteer de tools gerelateerd aan de Invoices API
export const invoicesTools = [
    {
        name: 'getInvoiceList',
        description: 'Haalt een gepagineerde lijst van factuurverzoeken op van bol.com. Kan gefilterd worden op pagina, shipment ID en status.',
        parameters: GetInvoiceListParams,
        execute: execute: async (params: z.infer<typeof GetInvoiceListParams>, env: Env) => {
    try {
        const data = await getInvoiceRequests(env, params.page, params.shipmentId, params.state);
        return {
            content: [{ type: 'json', json: data }],
        };
    } catch (error: any) {
        console.error('Error in getInvoiceList tool:', error);
        return {
            content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van de factuurlijst: ${error.message}.` }],
        };
    }
},

    },
    {
        name: 'getInvoiceDetails',
        description: 'Haalt de gedetailleerde JSON specificatie op voor een specifieke bol.com factuur aan de hand van het factuur ID. Bevat een gepagineerde lijst van transacties.',
        parameters: GetInvoiceDetailsParams,
        execute: async ({ params, env }: { params: z.infer<typeof GetInvoiceDetailsParams>, env: Env }) => {
            try {
                // Roep de helper functie aan uit bol-api.ts.
                // We vragen expliciet het JSON formaat op voor verwerking door de AI.
                const data = await getInvoiceDetails(env, params.invoiceId, params.page, 'application/vnd.retailer.v10+json'); [4, 5] // Specificeer JSON content type [5-9]

                // Retourneer de data als JSON
                return {
                    content: [{ type: 'json', json: data }]
                };
            } catch (error: any) {
                // Handel fouten af
                 console.error(`Error in getInvoiceDetails tool for ID ${params.invoiceId}:`, error);
                 // Specifieke foutafhandeling kan hier, zoals controleren op 404 Not Found [7]
                let errorMessage = error.message;
                 // API fouten worden door callBolApi al gelogd en geworpen, dus hier vangen en doorgeven volstaat.
                return {
                    content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van de factuurdetails voor ID ${params.invoiceId}: ${errorMessage}.` }]
                };
            }
        },
    },
    // Voeg hier eventueel meer tools voor Invoices API toe
];
