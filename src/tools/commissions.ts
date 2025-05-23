// src/tools/commissions.ts
import { z } from "zod";
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

// Log schema shapes
console.log("GetCommissionSingleParams shape:", Object.keys(GetCommissionSingleParams._def.shape()));
console.log("ProductBulkItem shape:", Object.keys(ProductBulkItem._def.shape()));
console.log("GetCommissionsBulkParams shape:", Object.keys(GetCommissionsBulkParams._def.shape()));

export const commissionsTools = [
    {
        name: 'getCommissionSingle',
        description: 'Haalt gedetailleerde commissie- en reductie-informatie op voor een enkel product.',
        parameters: GetCommissionSingleParams,
        execute: async (params: z.infer<typeof GetCommissionSingleParams>, env: Env) => {
            console.log("Mock execute for getCommissionSingle:", params);
            return { content: [{ type: 'json', json: { mock: true, params } }] };
        },
    },
    {
        name: 'getCommissionsBulk',
        description: 'Haalt commissie- en reductie-informatie op voor een lijst van producten in bulk.',
        parameters: GetCommissionsBulkParams,
        execute: async (params: z.infer<typeof GetCommissionsBulkParams>, env: Env) => {
            console.log("Mock execute for getCommissionsBulk:", params);
            return { content: [{ type: 'json', json: { mock: true, params } }] };
        },
    },
];

console.log("Exporting commissionsTools:", JSON.stringify(commissionsTools.map(t => ({
    name: t.name,
    parametersShape: t.parameters?._def?.typeName === "ZodObject" ? Object.keys(t.parameters._def.shape()) : "unknown",
    hasExecute: !!t.execute,
})), null, 2));
