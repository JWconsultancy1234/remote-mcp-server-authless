// orders.ts
import { z } from "zod";
import { getOrdersList, getSingleOrder } from "../bol-api";
import { Env } from "../types";

const GetOrdersListParams = z.object({
    page: z.number().int().positive().optional().describe('...'),
    fulfilmentMethod: z.enum(['FBR', 'FBB', 'ALL']).optional().describe('...'),
    status: z.enum(['OPEN', 'SHIPPED', 'ALL']).optional().describe('...'),
    latestChangeDate: z.string().optional().describe('...'),
});

const GetSingleOrderParams = z.object({
    orderId: z.string().describe('...'),
});

export const ordersTools = [
    {
        name: 'getOrdersList',
        description: 'Haalt een gepagineerde lijst van orders op...',
        parameters: GetOrdersListParams,
        execute: async (params: z.infer<typeof GetOrdersListParams>, env: Env) => {
            try {
                const data = await getOrdersList(env, params.page, params.fulfilmentMethod, params.status, params.latestChangeDate);
                return { content: [{ type: 'json', json: data }] };
            } catch (error: any) {
                console.error('Error in getOrdersList tool:', error);
                return { content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van de orders lijst: ${error.message}.` }] };
            }
        },
    },
    {
        name: 'getSingleOrder',
        description: 'Haalt gedetailleerde informatie op voor een specifieke order...',
        parameters: GetSingleOrderParams,
        execute: async (params: z.infer<typeof GetSingleOrderParams>, env: Env) => {
            try {
                const data = await getSingleOrder(env, params.orderId);
                return { content: [{ type: 'json', json: data }] };
            } catch (error: any) {
                console.error('Error in getSingleOrder tool for Order ID', params.orderId, ':', error);
                return { content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van order details voor Order ID ${params.orderId}: ${error.message}.` }] };
            }
        },
    },
];

console.log("Exporting ordersTools:", ordersTools);
