import { Protocol } from "../shared/protocol.js";
import { CreateMessageResultSchema, EmptyResultSchema, InitializedNotificationSchema, InitializeRequestSchema, LATEST_PROTOCOL_VERSION, ListPromptsRequestSchema, ListResourcesRequestSchema, ListRootsResultSchema, ListToolsRequestSchema, SetLevelRequestSchema, SUPPORTED_PROTOCOL_VERSIONS } from "../types.js";
/**
 * An MCP server on top of a pluggable transport.
 *
 * This server will automatically respond to the initialization flow as initiated from the client.
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
 * // Create typed server
 * const server = new Server<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomServer",
 *   version: "1.0.0"
 * })
 * ```
 */
export class Server extends Protocol {
    /**
     * Initializes this server with the given name and version information.
     */
    constructor(_serverInfo) {
        super();
        this._serverInfo = _serverInfo;
        this.setRequestHandler(InitializeRequestSchema, (request) => this._oninitialize(request));
        this.setNotificationHandler(InitializedNotificationSchema, () => { var _a; return (_a = this.oninitialized) === null || _a === void 0 ? void 0 : _a.call(this); });
    }
    async _oninitialize(request) {
        const requestedVersion = request.params.protocolVersion;
        this._clientCapabilities = request.params.capabilities;
        this._clientVersion = request.params.clientInfo;
        return {
            protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION,
            capabilities: this.getCapabilities(),
            serverInfo: this._serverInfo,
        };
    }
    /**
     * After initialization has completed, this will be populated with the client's reported capabilities.
     */
    getClientCapabilities() {
        return this._clientCapabilities;
    }
    /**
     * After initialization has completed, this will be populated with information about the client's name and version.
     */
    getClientVersion() {
        return this._clientVersion;
    }
    getCapabilities() {
        return {
            prompts: this._requestHandlers.has(ListPromptsRequestSchema.shape.method.value)
                ? {}
                : undefined,
            resources: this._requestHandlers.has(ListResourcesRequestSchema.shape.method.value)
                ? {}
                : undefined,
            tools: this._requestHandlers.has(ListToolsRequestSchema.shape.method.value)
                ? {}
                : undefined,
            logging: this._requestHandlers.has(SetLevelRequestSchema.shape.method.value)
                ? {}
                : undefined,
        };
    }
    async ping() {
        return this.request({ method: "ping" }, EmptyResultSchema);
    }
    async createMessage(params, onprogress) {
        return this.request({ method: "sampling/createMessage", params }, CreateMessageResultSchema, onprogress);
    }
    async listRoots(params, onprogress) {
        return this.request({ method: "roots/list", params }, ListRootsResultSchema, onprogress);
    }
    async sendLoggingMessage(params) {
        return this.notification({ method: "notifications/message", params });
    }
    async sendResourceUpdated(params) {
        return this.notification({
            method: "notifications/resources/updated",
            params,
        });
    }
    async sendResourceListChanged() {
        return this.notification({
            method: "notifications/resources/list_changed",
        });
    }
    async sendToolListChanged() {
        return this.notification({ method: "notifications/tools/list_changed" });
    }
    async sendPromptListChanged() {
        return this.notification({ method: "notifications/prompts/list_changed" });
    }
}
//# sourceMappingURL=index.js.map