// src/tools/invoices.ts
import { z } from "zod";
import { getInvoiceRequests, getInvoiceDetails } from "../bol-api";
import { Env } from "../types";

const GetInvoiceListParams = z.object({
    page: z.number().int().positive().default(1).describe('Het paginanummer om op te vragen (>= 1). Standaard is 1.'),
    shipmentId: z.string().optional().describe('Filter de factuurverzoeken op een specifiek shipment ID.'),
    state: z.enum(['OPEN', 'UPLOAD_ERROR', 'ALL']).default('ALL').describe('Filter de factuurverzoeken op status (OPEN, UPLOAD_ERROR, ALL). Standaard is ALL.'),
});

const GetInvoiceDetailsParams = z.object({
    invoiceId: z.string().describe('Het verplichte ID van de factuur waarvan de details moeten worden opgehaald.'),
    page: z.number().int().positive().default(1).describe('Het paginanummer voor de lijst van transacties binnen de factuurspecificatie (>= 1).'),
});

// Log schema shapes
console.log("GetInvoiceListParams shape:", Object.keys(GetInvoiceListParams._def.shape()));
console.log("GetInvoiceDetailsParams shape:", Object.keys(GetInvoiceDetailsParams._def.shape()));

export const invoicesTools = [
    {
        name: 'getInvoiceList',
        description: 'Haalt een gepagineerde lijst van factuurverzoeken op van bol.com.',
        parameters: GetInvoiceListParams,
        execute: async (params: z.infer<typeof GetInvoiceListParams>, env: Env) => {
            try {
                const data = await getInvoiceRequests(env, params.page, params.shipmentId, params.state);
                return { content: [{ type: 'json', json: data }] };
            } catch (error: any) {
                console.error('Error in getInvoiceList tool:', error);
                return { content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van de factuurlijst: ${error.message || error}.` }] };
            }
        },
    },
    {
        name: 'getInvoiceDetails',
        description: 'Haalt de gedetailleerde JSON specificatie op voor een specifieke bol.com factuur.',
        parameters: GetInvoiceDetailsParams,
        execute: async (params: z.infer<typeof GetInvoiceDetailsParams>, env: Env) => {
            try {
                const data = await getInvoiceDetails(env, params.invoiceId, params.page, 'application/vnd.retailer.v10+json');
                return { content: [{ type: 'json', json: data }] };
            } catch (error: any) {
                console.error(`Error in getInvoiceDetails tool for ID ${params.invoiceId}:`, error);
                return { content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van de factuurdetails voor ID ${params.invoiceId}: ${error.message || error}.` }] };
            }
        },
    },
];

console.log("Exporting invoicesTools:", JSON.stringify(invoicesTools.map(t => ({
    name: t.name,
    parametersShape: t.parameters?._def?.typeName === "ZodObject" ? Object.keys(t.parameters._def.shape()) : "unknown",
    hasExecute: !!t.execute,
})), null, 2));
