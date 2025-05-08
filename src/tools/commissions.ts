// src/tools/commissions.ts
import { z } from "zod";
import { getCommissionSingle, postCommissionsBulk } from "../bol-api";
import { Env } from "../types";

const GetCommissionSingleParams = z.object({
    ean: z.string().describe('Het verplichte EAN-nummer van het product waarvoor commissie berekend moet worden.'),
    unitPrice: z.number().positive().describe('De verplichte verkoopprijs van het product (inclusief BTW), gebruikt voor commissieberekening. Moet groter zijn dan 0.'),
    condition: z.enum(['NEW', 'AS_NEW', 'GOOD', 'REASONABLE', 'MODERATE']).optional().describe('De conditie van het offer. Gebruik dit filter om commissies voor tweedehands producten op te vragen. Standaard is NEW.'),
});

const ProductBulkItem = z.object({
    ean: z.string().describe('Het EAN-nummer van het product.'),
    unitPrice: z.number().positive().describe('De verkoopprijs van het product (inclusief BTW).'),
    condition: z.enum(['NEW', 'AS_NEW', 'GOOD', 'REASONABLE', 'MODERATE']).optional().describe('De conditie van het offer. Standaard is NEW.'),
});

const GetCommissionsBulkParams = z.object({
    products: z.array(ProductBulkItem).min(1).max(100).describe('Een verplichte lijst van minimaal 1 en maximaal 100 producten, elk gespecificeerd met EAN, unitPrice en optionele condition. De API berekent commissies voor elk product in deze lijst.'),
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
                    })),
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
