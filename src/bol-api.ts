// src/bol-api.ts
import { getAccessToken } from './auth';
import { Env } from './types';

const BOL_API_BASE_URL = 'https://api.bol.com/retailer';

// Placeholder types (replace with actual definitions if available)
interface SingleCommissionResponse {
    // Define based on Bol.com API response
}

interface CommissionBulkProduct {
    ean: string;
    unitPrice: number;
    condition?: 'NEW' | 'AS_NEW' | 'GOOD' | 'REASONABLE' | 'MODERATE';
}

export async function callBolApi(
    endpoint: string,
    method: string,
    env: Env,
    options: {
        headers?: Record<string, string>;
        query?: Record<string, any>;
        body?: any;
        contentType?: string;
    } = {}
): Promise<any> {
    try {
        const accessToken = await getAccessToken(env);
        const url = new URL(`${BOL_API_BASE_URL}${endpoint}`);
        if (options.query) {
            Object.keys(options.query).forEach(key => url.searchParams.append(key, options.query[key]));
        }

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.retailer.v10+json',
            ...options.headers,
        };

        if (options.body && method !== 'GET' && method !== 'HEAD') {
            headers['Content-Type'] = options.contentType || 'application/vnd.retailer.v10+json';
        }

        const fetchOptions: RequestInit = {
            method: method,
            headers: headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
        };

        console.log(`Calling BOL API: ${method} ${url}`);
        const response = await fetch(url.toString(), fetchOptions);

        if (!response.ok) {
            let errorText = await response.text();
            console.error(`BOL API Error: ${response.status} - ${errorText}`);
            throw new Error(`BOL API Error: ${response.status} - ${errorText}`);
        }

        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get('Content-Type');
        if (contentType?.includes('application/json') || contentType?.includes('application/vnd.retailer.v10+json')) {
            return await response.json();
        } else if (contentType?.includes('application/pdf') || contentType?.includes('application/vnd.retailer.v10+pdf')) {
            return await response.blob();
        } else {
            console.warn(`Unexpected content type received: ${contentType}`);
            return await response.text();
        }
    } catch (error) {
        console.error('Error calling BOL API:', error);
        throw error;
    }
}

export async function getInvoiceRequests(
    env: Env,
    page?: number,
    shipmentId?: string,
    state?: 'OPEN' | 'UPLOAD_ERROR' | 'ALL'
): Promise<any> {
    const query: Record<string, any> = {};
    if (page !== undefined) query.page = page;
    if (shipmentId !== undefined) query['shipment-id'] = shipmentId;
    if (state !== undefined) query.state = state;

    return callBolApi('/invoices', 'GET', env, { query });
}

export async function getInvoiceDetails(
    env: Env,
    invoiceId: string,
    page?: number,
    acceptContentType: 'application/vnd.retailer.v10+json' | 'application/vnd.retailer.v10+pdf' | 'text/html' = 'application/vnd.retailer.v10+json'
): Promise<any> {
    const query: Record<string, any> = {};
    if (page !== undefined) query.page = page;

    const headers = {
        'Accept': acceptContentType,
    };

    return callBolApi(`/invoices/${invoiceId}`, 'GET', env, { query, headers });
}

export async function getCommissionSingle(
    env: Env,
    ean: string,
    unitPrice: number,
    condition: 'NEW' | 'AS_NEW' | 'GOOD' | 'REASONABLE' | 'MODERATE' = 'NEW'
): Promise<SingleCommissionResponse | null> {
    try {
        const query = {
            'unit-price': unitPrice,
            condition: condition,
        };

        const data: SingleCommissionResponse = await callBolApi(`/commission/${ean}`, 'GET', env, { query });
        console.log("Bol.com single commission data succesvol ontvangen.");
        return data;
    } catch (e: any) {
        console.error("Fout bij ophalen single Bol.com commissie:", e.message);
        return null;
    }
}

export async function postCommissionsBulk(
    env: Env,
    products: CommissionBulkProduct[]
): Promise<any | null> {
    if (products.length === 0 || products.length > 100) {
        console.error(`Aantal EANs moet tussen 1 en 100 liggen voor bulk request, nu: ${products.length}`);
        throw new Error(`Aantal EANs moet tussen 1 en 100 liggen voor bulk request, nu: ${products.length}.`);
    }

    try {
        const requestBody = {
            commissionQueries: products.map(p => ({
                ean: p.ean,
                unitPrice: parseFloat(p.unitPrice.toFixed(2)),
                condition: p.condition || 'NEW',
            })),
        };

        const data = await callBolApi('/commission', 'POST', env, {
            body: requestBody,
            contentType: 'application/vnd.retailer.v10+json',
        });

        console.log("Bol.com bulk commission data succesvol ontvangen.");
        return data;
    } catch (e: any) {
        console.error("Fout bij ophalen bulk Bol.com commissie:", e.message);
        return null;
    }
}

export async function getOrdersList(
    env: Env,
    page?: number,
    fulfilmentMethod?: 'FBR' | 'FBB' | 'ALL',
    status?: 'OPEN' | 'SHIPPED' | 'ALL',
    latestChangeDate?: string
): Promise<any> {
    const query: Record<string, any> = {};
    if (page !== undefined) query.page = page;
    if (fulfilmentMethod !== undefined) query['fulfilment-method'] = fulfilmentMethod;
    if (status !== undefined) query.status = status;
    if (latestChangeDate !== undefined) query['latest-change-date'] = latestChangeDate;

    const data = await callBolApi('/orders', 'GET', env, { query });
    return data.orders || data; // Adjust based on actual API response
}

export async function getSingleOrder(
    env: Env,
    orderId: string
): Promise<any> {
    return callBolApi(`/orders/${orderId}`, 'GET', env);
}

// Remove getOrderDetails if unused
