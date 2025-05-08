import { z } from "zod"; // Importeren voor parameterdefinitie
// Importeren van de bol.com API helper functies voor commissions
// (Aangenomen dat deze functies bestaan in bol-api.ts op basis van de API docs)
import { getCommissionSingle, postCommissionsBulk } from "../bol-api";
import { Env } from "../index"; // Importeren van het Env type

// Definieer de Zod schema's voor de parameters van de tools

// Parameters voor getCommissionSingle tool (voor het enkele EAN endpoint)
const GetCommissionSingleParams = z.object({
    ean: z.string().describe('Het verplichte EAN-nummer van het product waarvoor commissie berekend moet worden.'),
    unitPrice: z.number().positive().describe('De verplichte verkoopprijs van het product (inclusief BTW), gebruikt voor commissieberekening. Moet groter zijn dan 0.'),
    condition: z.enum(['NEW', 'AS_NEW', 'GOOD', 'REASONABLE', 'MODERATE']).optional().describe('De conditie van het offer. Gebruik dit filter om commissies voor tweedehands producten op te vragen. Standaard is NEW.'),
});

// Schema voor een enkel product item in de lijst voor de bulk commissie aanvraag
const ProductBulkItem = z.object({
    ean: z.string().describe('Het EAN-nummer van het product.'),
    unitPrice: z.number().positive().describe('De verkoopprijs van het product (inclusief BTW).'),
    condition: z.enum(['NEW', 'AS_NEW', 'GOOD', 'REASONABLE', 'MODERATE']).optional().describe('De conditie van het offer. Standaard is NEW.'),
});

// Parameters voor getCommissionsBulk tool (voor het bulk/BETA endpoint)
const GetCommissionsBulkParams = z.object({
    products: z.array(ProductBulkItem).min(1).max(100).describe('Een verplichte lijst van minimaal 1 en maximaal 100 producten, elk gespecificeerd met EAN, unitPrice en optionele condition. De API berekent commissies voor elk product in deze lijst.'), // Max 100 items volgens bronnen [2, 5]
});

// Definieer en exporteer de tools gerelateerd aan de Commissions API
export const commissionsTools = [
    {
        name: 'getCommissionSingle',
        description: 'Haalt gedetailleerde commissie- en reductie-informatie op voor een enkel product door het EAN, de verkoopprijs en optioneel de conditie op te geven. Dit is nuttig voor het berekenen van de variabele kosten per specifiek productoffer.',
        parameters: GetCommissionSingleParams,
        execute: async (params: z.infer<typeof GetCommissionSingleParams>, env: Env) => {
            try {
                // Roep de helper functie aan voor het enkele EAN endpoint
                // De API verwacht 'unit-price' als query parameter
                const data = await getCommissionSingle(env, params.ean, params.unitPrice, params.condition);

                // Retourneer de data als JSON voor de AI om te analyseren
                return {
                    content: [{ type: 'json', json: data }]
                };
            } catch (error: any) {
                // Handel API of andere fouten af
                console.error('Error in getCommissionSingle tool for EAN', params.ean, ':', error);
                return {
                    content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van commissie details voor EAN ${params.ean}: ${error.message}.` }]
                };
            }
        },
    },
    {
        name: 'getCommissionsBulk',
        description: 'Haalt commissie- en reductie-informatie op voor een lijst van producten in bulk (maximaal 100). Dit is een BETA endpoint en kan gedeeltelijke resultaten retourneren (207 Multi-Status). Ideaal voor batchverwerking en analyse van winstgevendheid over een assortiment.',
        parameters: GetCommissionsBulkParams,
        execute: async (params: z.infer<typeof GetCommissionsBulkParams>, env: Env) => {
            try {
                // De helper functie moet de request body in het verwachte formaat krijgen
                // Het formaat is { "products": [ { "ean": "...", "unitPrice": ..., "condition": "..." }, ... ] }
                const requestBody = {
                    products: params.products.map(product => ({
                        ean: product.ean,
                        unitPrice: product.unitPrice,
                        ...(product.condition && { condition: product.condition }),
                    }))
                };

                // Roep de helper functie aan voor het bulk/BETA endpoint
                const data = await postCommissionsBulk(env, requestBody);

                // De API kan 207 Multi-status retourneren
                return {
                    content: [{ type: 'json', json: data }]
                };
            } catch (error: any) {
                // Handel fouten af
                console.error('Error in getCommissionsBulk tool:', error);
                return {
                    content: [{ type: 'text', text: `Er is een fout opgetreden bij het ophalen van commissie details in bulk: ${error.message}.` }]
                };
            }
        },
    },
    // Voeg hier eventueel meer tools voor Commissions API toe
];
