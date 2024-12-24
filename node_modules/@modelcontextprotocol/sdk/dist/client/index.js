import { Protocol } from "../shared/protocol.js";
import { CallToolResultSchema, CompleteResultSchema, EmptyResultSchema, GetPromptResultSchema, InitializeResultSchema, LATEST_PROTOCOL_VERSION, ListPromptsResultSchema, ListResourcesResultSchema, ListResourceTemplatesResultSchema, ListToolsResultSchema, ReadResourceResultSchema, SUPPORTED_PROTOCOL_VERSIONS } from "../types.js";
/**
 * An MCP client on top of a pluggable transport.
 *
 * The client will automatically begin the initialization flow with the server when connect() is called.
 *
 * To use with custom types, extend the base Request/Notification/Result types and pass them as type parameters:
 *
 * ```typescript
 * // Custom schemas
 * const CustomRequestSchema = RequestSchema.extend({...})
 * const CustomNotificationSchema = NotificationSchema.extend({...})
 * const CustomResultSchema = ResultSchema.extend({...})
 *
 * // Type aliases
 * type CustomRequest = z.infer<typeof CustomRequestSchema>
 * type CustomNotification = z.infer<typeof CustomNotificationSchema>
 * type CustomResult = z.infer<typeof CustomResultSchema>
 *
 * // Create typed client
 * const client = new Client<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomClient",
 *   version: "1.0.0"
 * })
 * ```
 */
export class Client extends Protocol {
    /**
     * Initializes this client with the given name and version information.
     */
    constructor(_clientInfo) {
        super();
        this._clientInfo = _clientInfo;
    }
    async connect(transport) {
        await super.connect(transport);
        const result = await this.request({
            method: "initialize",
            params: {
                protocolVersion: LATEST_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: this._clientInfo,
            },
        }, InitializeResultSchema);
        if (result === undefined) {
            throw new Error(`Server sent invalid initialize result: ${result}`);
        }
        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
            throw new Error(`Server's protocol version is not supported: ${result.protocolVersion}`);
        }
        this._serverCapabilities = result.capabilities;
        this._serverVersion = result.serverInfo;
        await this.notification({
            method: "notifications/initialized",
        });
    }
    /**
     * After initialization has completed, this will be populated with the server's reported capabilities.
     */
    getServerCapabilities() {
        return this._serverCapabilities;
    }
    /**
     * After initialization has completed, this will be populated with information about the server's name and version.
     */
    getServerVersion() {
        return this._serverVersion;
    }
    async ping() {
        return this.request({ method: "ping" }, EmptyResultSchema);
    }
    async complete(params, onprogress) {
        return this.request({ method: "completion/complete", params }, CompleteResultSchema, onprogress);
    }
    async setLoggingLevel(level) {
        return this.request({ method: "logging/setLevel", params: { level } }, EmptyResultSchema);
    }
    async getPrompt(params, onprogress) {
        return this.request({ method: "prompts/get", params }, GetPromptResultSchema, onprogress);
    }
    async listPrompts(params, onprogress) {
        return this.request({ method: "prompts/list", params }, ListPromptsResultSchema, onprogress);
    }
    async listResources(params, onprogress) {
        return this.request({ method: "resources/list", params }, ListResourcesResultSchema, onprogress);
    }
    async listResourceTemplates(params, onprogress) {
        return this.request({ method: "resources/templates/list", params }, ListResourceTemplatesResultSchema, onprogress);
    }
    async readResource(params, onprogress) {
        return this.request({ method: "resources/read", params }, ReadResourceResultSchema, onprogress);
    }
    async subscribeResource(params) {
        return this.request({ method: "resources/subscribe", params }, EmptyResultSchema);
    }
    async unsubscribeResource(params) {
        return this.request({ method: "resources/unsubscribe", params }, EmptyResultSchema);
    }
    async callTool(params, resultSchema = CallToolResultSchema, onprogress) {
        return this.request({ method: "tools/call", params }, resultSchema, onprogress);
    }
    async listTools(params, onprogress) {
        return this.request({ method: "tools/list", params }, ListToolsResultSchema, onprogress);
    }
    async sendRootsListChanged() {
        return this.notification({ method: "notifications/roots/list_changed" });
    }
}
//# sourceMappingURL=index.js.map