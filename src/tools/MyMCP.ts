// In src/tools/MyMCP.ts

export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "Bol.com Retailer Tools",
    version: "1.0",
  });
  private initialized = false; // Declared but needs to be managed
  private registeredTools = new Set<string>(); // Declared but needs to be managed

  constructor(state: DurableObjectState, env: Env) {
    // Constructor body here, potentially restoring state
    super(state, env); // Call super constructor if necessary
  }

  async init() {
    // Check if already initialized
    if (this.initialized) {
      console.log("MCP server already initialized, skipping tool registration.");
      return; // Exit early if already initialized
    }

    console.log("Initializing MCP and registering tools..."); // Log before registration

    // Code to register tools goes here
    // Bijvoorbeeld:
    // invoicesTools.forEach(tool => this.server.tool(tool.name, tool.description, tool.parameters, async (params) => { /* execute logic */ }));
    // commissionsTools.forEach(...);
    // ordersTools.forEach(...);

    // Assuming your tools are defined elsewhere and imported, loop through them
    const toolsToRegister = [
      ...invoicesTools,
      ...commissionsTools,
      ...ordersTools,
      // Voeg hier alle andere tool arrays toe
    ];

    toolsToRegister.forEach(tool => {
      console.log(`Registering tool: ${tool.name}`); // Log each tool registration attempt
      this.server.tool(tool.name, tool.description, tool.parameters, tool.executeFunction); // Vervang tool.executeFunction met de daadwerkelijke functie
      this.registeredTools.add(tool.name); // Optioneel: voeg toe aan de set
    });

    console.log(`Successfully added ${this.registeredTools.size} tools to the MCP server.`); // Log after registration

    // Set the initialized flag to true after successful registration
    this.initialized = true;
  }

  // Andere methodes van je MyMCP klasse...
}
