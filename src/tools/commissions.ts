// commissions.ts
import { z } from "zod";
import { getCommissionSingle, postCommissionsBulk } from "../bol-api";
import { Env } from "../types";

const GetCommissionSingleParams = z.object({
    ean: z.string().describe('...'),
    unitPrice: z.number().positive().describe('...'),
    condition: z.enum(['NEW', 'AS_NEW', 'GOOD', 'REASONABLE', 'MODERATE']).optional().describe('...'),
});

const ProductBulkItem = z.object({
    ean: z.string().describe('...'),
    unitPrice: z.number().positive().describe('...'),
    condition: z.enum(['NEW', 'AS_NEW', 'GOOD', 'REASONABLE', 'MODERATE']).optional().describe('...'),
});

const GetCommissionsBulkParams = z.object({
    products: z.array(ProductBulkItem).min(1).max(100).describe('...'),
});

export const commissionsTools = [
    {
        name: 'getCommissionSingle',
        description: 'Haalt gedetailleerde commissie- en reductie-informatie op voor een enkel product...',
        parameters: GetCommissionSingleParams,
        execute: async (params: z.infer<typeof GetCommissionSingleParams>, env: Env) => {
            try {
                const data = await getCommissionSingle(env, params.ean, params.unitPrice, params.condition);
                return { content: [{ type: 'json', json: data }] };
            } catch (error: any) {
                console.error('Error in getCommissionSingle tool for EAN', params.ean, ':', error);
                return { content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van commissie details voor EAN ${params.ean}: ${error.message}.` }] };
            }
        },
    },
    {
        name: 'getCommissionsBulk',
        description: 'Haalt commissie- en reductie-informatie op voor een lijst van producten in bulk...',
        parameters: GetCommissionsBulkParams,
        execute: async (params: z.infer<typeof GetCommissionsBulkParams>, env: Env) => {
            try {
                const requestBody = {
                    products: params.products.map(product => ({
                        ean: product.ean,
                        unitPrice: product.unitPrice,
                        ...(product.condition && { condition: product.condition }),
                    }))
                };
                const data = await postCommissionsBulk(env, requestBody);
                return { content: [{ type: 'json', json: data }] };
            } catch (error: any) {
                console.error('Error in getCommissionsBulk tool:', error);
                return { content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van commissie details in bulk: ${error.message}.` }] };
            }
        },
    },
];

console.log("Exporting commissionsTools:", commissionsTools);
