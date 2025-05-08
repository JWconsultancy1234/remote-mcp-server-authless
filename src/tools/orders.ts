// src/tools/orders.ts
import { z } from "zod";
import { Env } from "../types";

const GetOrdersListParams = z.object({
    page: z.number().int().positive().optional().describe('Het paginanummer van de lijst met orders. Standaard is 1.'),
    fulfilmentMethod: z.enum(['FBR', 'FBB', 'ALL']).optional().describe('Filter orders op fulfillment methode. "FBR" voor Fulfilled by the Retailer, "FBB" voor Fulfilled by bol.com, "ALL" voor beide. Standaard is FBR, maar "ALL" kan nuttig zijn voor BI.'),
    status: z.enum(['OPEN', 'SHIPPED', 'ALL']).optional().describe('Filter orders op status. "OPEN" voor openstaande orders, "SHIPPED" voor verzonden orders, "ALL" voor alle statussen. Standaard is OPEN.'),
    latestChangeDate: z.string().optional().describe('Filter orders op laatste wijzigingsdatum (YYYY-MM-DD).'),
});

const GetSingleOrderParams = z.object({
    orderId: z.string().describe('Het verplichte ID van de order die opgehaald moet worden.'),
});

// Log schema shapes
console.log("GetOrdersListParams shape:", Object.keys(GetOrdersListParams._def.shape()));
console.log("GetSingleOrderParams shape:", Object.keys(GetSingleOrderParams._def.shape()));

export const ordersTools = [
    {
        name: 'getOrdersList',
        description: 'Haalt een gepagineerde lijst van orders op.',
        parameters: GetOrdersListParams,
        execute: async (params: z.infer<typeof GetOrdersListParams>, env: Env) => {
            console.log("Mock execute for getOrdersList:", params);
            return { content: [{ type: 'json', json: { mock: true, params } }] };
        },
    },
    {
        name: 'getSingleOrder',
        description: 'Haalt gedetailleerde informatie op voor een specifieke order.',
        parameters: GetSingleOrderParams,
        execute: async (params: z.infer<typeof GetSingleOrderParams>, env: Env) => {
            console.log("Mock execute for getSingleOrder:", params);
            return { content: [{ type: 'json', json: { mock: true, params } }] };
        },
    },
];

console.log("Exporting ordersTools:", JSON.stringify(ordersTools.map(t => ({
    name: t.name,
    parametersShape: t.parameters?._def?.typeName === "ZodObject" ? Object.keys(t.parameters._def.shape()) : "unknown",
    hasExecute: !!t.execute,
})), null, 2));
