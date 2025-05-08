// src/tools/invoices.ts
import { z } from "zod";
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
            console.log("Mock execute for getInvoiceList:", params);
            return { content: [{ type: 'json', json: { mock: true, params } }] };
        },
    },
    {
        name: 'getInvoiceDetails',
        description: 'Haalt de gedetailleerde JSON specificatie op voor een specifieke bol.com factuur.',
        parameters: GetInvoiceDetailsParams,
        execute: async (params: z.infer<typeof GetInvoiceDetailsParams>, env: Env) => {
            console.log("Mock execute for getInvoiceDetails:", params);
            return { content: [{ type: 'json', json: { mock: true, params } }] };
        },
    },
];

console.log("Exporting invoicesTools:", JSON.stringify(invoicesTools.map(t => ({
    name: t.name,
    parametersShape: t.parameters?._def?.typeName === "ZodObject" ? Object.keys(t.parameters._def.shape()) : "unknown",
    hasExecute: !!t.execute,
})), null, 2));
