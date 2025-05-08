// src/tools/orders.ts
import { z } from "zod";
import { getOrdersList, getSingleOrder } from "../bol-api";
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
                return { content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van order details voor Order ID ${params.orderId}: ${error
