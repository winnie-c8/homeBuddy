import "@lovable.dev/ai-gateway";

/* The MIT License

Copyright (c) OpenAI (https://openai.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */
declare namespace ModelContract_a738949d5a7e663e {
export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        GatewayClientDelegation: {
            type?: ("client" | "") | null;
        };
        GatewayHeartbeatRequest: {
            event_id?: string | null;
            
            type: "gateway.heartbeat";
        };
        GatewayLiveAudio: {
            output?: components["schemas"]["GatewayLiveAudioOutput"] | null;
        };
        GatewayLiveAudioOutput: {
            voice?: string;
        };
        GatewayLiveSession: {
            audio?: components["schemas"]["GatewayLiveAudio"] | null;
            delegation?: components["schemas"]["GatewayClientDelegation"] | null;
            input?: components["schemas"]["LiveInitialItem"][] | null;
            instructions?: string | null;
            
            model: "openai/gpt-live-1";
            
            store?: false;
        };
        GatewayLiveTransport: {
            sdp: string;
            
            type: "webrtc";
        };
        GatewayLiveUpdateSession: {
            delegation?: components["schemas"]["GatewayClientDelegation"] | null;
        };
        LiveCommentaryAppendParam: {
            content: string;
            delegation_id: string | null;
            event_id?: string | null;
            
            type: "session.commentary.append";
        };
        LiveEvent: components["schemas"]["Output_LiveServerEvent"] | components["schemas"]["LiveSessionCreated"] | components["schemas"]["LiveHeartbeatAcknowledged"] | components["schemas"]["LiveSessionIdle"] | components["schemas"]["LiveSessionResumed"] | components["schemas"]["LiveSessionClosing"] | components["schemas"]["LiveGatewayError"];
        LiveGatewayError: {
            error: {
                code?: string | null;
                message: string;
                metadata?: {
                    provider_name?: unknown;
                    raw?: unknown;
                };
                param?: unknown;
                type?: string;
            };
            
            type: "gateway.error";
        };
        LiveHeartbeatAcknowledged: {
            
            type: "gateway.heartbeat.ack";
        };
        LiveInitialAssistantMessageItemParam: {
            content: (components["schemas"]["LiveInitialTextContentPartParam"] | components["schemas"]["LiveInitialOutputTextContentPartParam"])[] | string;
            id?: string | null;
            
            role: "assistant";
            status?: components["schemas"]["LiveInitialMessageStatus"] | null;
            
            type?: "message";
        };
        LiveInitialDeveloperMessageItemParam: {
            content: components["schemas"]["LiveInitialInputTextContentPartParam"][] | string;
            id?: string | null;
            
            role: "developer";
            status?: components["schemas"]["LiveInitialMessageStatus"] | null;
            
            type?: "message";
        };
        LiveInitialInputTextContentPartParam: {
            text: string;
            
            type: "input_text";
        };
        LiveInitialItem: components["schemas"]["LiveInitialDeveloperMessageItemParam"] | components["schemas"]["LiveInitialUserMessageItemParam"] | components["schemas"]["LiveInitialAssistantMessageItemParam"];
        
        LiveInitialMessageStatus: "incomplete" | "completed";
        LiveInitialOutputTextContentPartParam: {
            text: string;
            
            type: "output_text";
        };
        LiveInitialTextContentPartParam: {
            text: string;
            
            type: "text";
        };
        LiveInitialUserMessageItemParam: {
            content: components["schemas"]["LiveInitialInputTextContentPartParam"][] | string;
            id?: string | null;
            
            role: "user";
            status?: components["schemas"]["LiveInitialMessageStatus"] | null;
            
            type?: "message";
        };
        LiveInputAudioMuteParam: {
            event_id?: string | null;
            
            type: "session.input_audio.mute";
        };
        LiveInputAudioUnmuteParam: {
            event_id?: string | null;
            
            type: "session.input_audio.unmute";
        };
        LiveInstructionsAppendParam: {
            content: string;
            delegation_id: string | null;
            event_id?: string | null;
            
            type: "session.instructions.append";
        };
        LiveRequest: components["schemas"]["LiveStartRequest"] | components["schemas"]["LiveUpdateRequest"] | components["schemas"]["LiveInstructionsAppendParam"] | components["schemas"]["LiveThinkingAppendParam"] | components["schemas"]["LiveCommentaryAppendParam"] | components["schemas"]["LiveInputAudioMuteParam"] | components["schemas"]["LiveInputAudioUnmuteParam"] | components["schemas"]["LiveSessionCloseParam"] | components["schemas"]["GatewayHeartbeatRequest"];
        LiveResponse: components["schemas"]["LiveSessionCreated"];
        LiveSessionCloseParam: {
            event_id?: string | null;
            
            type: "session.close";
        };
        LiveSessionClosing: {
            reason: string;
            
            type: "gateway.session.closing";
        };
        LiveSessionCreated: {
            session: {
                id: string;
            };
            transport: components["schemas"]["Output_LiveWebRTCTransport"];
            
            type: "gateway.session.created";
        };
        
        LiveSessionIdle: {
            
            closes_in_seconds: number;
            
            idle_seconds: number;
            
            type: "gateway.session.idle";
        };
        
        LiveSessionResumed: {
            session: {
                id: string;
            };
            
            type: "gateway.session.resumed";
        };
        LiveStartRequest: {
            event_id?: string | null;
            session: components["schemas"]["GatewayLiveSession"];
            transport: components["schemas"]["GatewayLiveTransport"];
            
            type: "session.start";
        };
        LiveThinkingAppendParam: {
            content: string;
            delegation_id: string | null;
            event_id?: string | null;
            
            type: "session.thinking.append";
        };
        LiveUpdateRequest: {
            event_id?: string | null;
            session: components["schemas"]["GatewayLiveUpdateSession"];
            
            type: "session.update";
        };
        Output_LiveAllowedServerEventParam: {
            response_event?: string;
            type: string;
        };
        Output_LiveAudioFormat: components["schemas"]["Output_LiveSessionAudioFormatPCMParam"] | components["schemas"]["Output_LiveSessionAudioFormatPCMUParam"] | components["schemas"]["Output_LiveSessionAudioFormatPCMAParam"];
        Output_LiveClientConfigParam: {
            data_channel: components["schemas"]["Output_LiveDataChannelConfigParam"];
        };
        Output_LiveClientDelegationParam: {
            
            type: "client";
        };
        Output_LiveCommentaryAppended: {
            client_event_id?: string;
            end_ms: number;
            event_id: string;
            start_ms: number;
            
            type: "session.commentary.appended";
        };
        Output_LiveContextWindowUsage: {
            usage_ratio: number;
        };
        Output_LiveCustomVoiceParam: {
            id: string;
        };
        Output_LiveDataChannelConfigParam: {
            allowed_client_events?: "all" | string[];
            allowed_server_events?: "all" | components["schemas"]["Output_LiveAllowedServerEventParam"][];
        };
        Output_LiveDelegationCreated: {
            client_event_id?: string;
            delegation: components["schemas"]["Output_LiveDelegationItem"];
            event_id: string;
            offset_ms: number;
            
            type: "session.delegation.created";
        };
        Output_LiveDelegationItem: {
            id: string;
            response_id?: string;
            target: "client" | "responses";
            
            type: "delegation";
        };
        Output_LiveDelegationReasoningInputParam: {
            effort?: components["schemas"]["Output_LiveReasoningEffort"] | null;
            summary?: components["schemas"]["Output_LiveReasoningSummary"] | null;
        };
        Output_LiveDelegationTextInputParam: {
            verbosity?: components["schemas"]["Output_LiveTextVerbosity"] | null;
        };
        Output_LiveErrorEvent: {
            client_event_id?: string;
            error: components["schemas"]["Output_LiveLiveError"];
            event_id: string;
            
            type: "error";
        };
        Output_LiveFunctionToolChoiceParam: {
            name: string;
            
            type: "function";
        };
        Output_LiveFunctionToolInputParam: {
            description?: string | null;
            name: string;
            parameters?: {
                [key: string]: unknown;
            } | null;
            strict?: boolean | null;
            
            type: "function";
        };
        Output_LiveInfoEvent: {
            client_event_id?: string;
            code: string;
            event_id: string;
            message: string;
            
            type: "info";
        };
        Output_LiveInitialAssistantMessageItemParam: {
            content: (components["schemas"]["Output_LiveInitialTextContentPartParam"] | components["schemas"]["Output_LiveInitialOutputTextContentPartParam"])[];
            id?: string | null;
            
            role: "assistant";
            status?: components["schemas"]["Output_LiveInitialMessageStatus"] | null;
            
            type?: "message";
        };
        Output_LiveInitialDeveloperMessageItemParam: {
            content: components["schemas"]["Output_LiveInitialInputTextContentPartParam"][];
            id?: string | null;
            
            role: "developer";
            status?: components["schemas"]["Output_LiveInitialMessageStatus"] | null;
            
            type?: "message";
        };
        Output_LiveInitialInputTextContentPartParam: {
            text: string;
            
            type?: "input_text";
        };
        Output_LiveInitialItem: components["schemas"]["Output_LiveInitialDeveloperMessageItemParam"] | components["schemas"]["Output_LiveInitialUserMessageItemParam"] | components["schemas"]["Output_LiveInitialAssistantMessageItemParam"];
        
        Output_LiveInitialMessageStatus: "incomplete" | "completed";
        Output_LiveInitialOutputTextContentPartParam: {
            text: string;
            
            type: "output_text";
        };
        Output_LiveInitialSessionAudioOutputParam: {
            voice?: (string | ("alloy" | "ash" | "ballad" | "beacon" | "bossa" | "brise" | "cedar" | "cinder" | "coral" | "delta" | "echo" | "flitz" | "gleam" | "harema" | "juni" | "marin" | "meridian" | "nira" | "noeul" | "nuri" | "quartz" | "ripple" | "sage" | "shimmer" | "shitan" | "sillage" | "stone" | "tempo" | "verse" | "vesper" | "willow")) | components["schemas"]["Output_LiveCustomVoiceParam"];
        };
        Output_LiveInitialSessionAudioParam: {
            format?: components["schemas"]["Output_LiveAudioFormat"];
            output?: components["schemas"]["Output_LiveInitialSessionAudioOutputParam"];
        };
        Output_LiveInitialTextContentPartParam: {
            text: string;
            
            type?: "text";
        };
        Output_LiveInitialUserMessageItemParam: {
            content: components["schemas"]["Output_LiveInitialInputTextContentPartParam"][];
            id?: string | null;
            
            role: "user";
            status?: components["schemas"]["Output_LiveInitialMessageStatus"] | null;
            
            type?: "message";
        };
        Output_LiveInputAudioAppend: {
            audio: string;
            
            type: "session.input_audio.append";
        };
        Output_LiveInputAudioMuted: {
            client_event_id?: string;
            event_id: string;
            
            type: "session.input_audio.muted";
        };
        Output_LiveInputAudioUnmuted: {
            client_event_id?: string;
            event_id: string;
            
            type: "session.input_audio.unmuted";
        };
        Output_LiveInputTranscriptDelta: {
            client_event_id?: string;
            delta: string;
            end_ms: number;
            event_id: string;
            start_ms: number;
            
            type: "session.input_transcript.delta";
        };
        Output_LiveInstructionsAppended: {
            client_event_id?: string;
            end_ms: number;
            event_id: string;
            start_ms: number;
            
            type: "session.instructions.appended";
        };
        Output_LiveLiveError: {
            client_event_id?: string;
            code: string;
            message: string;
            param?: string;
            type: string;
        };
        Output_LiveMCPToolChoiceParam: {
            name: string;
            server_label: string;
            
            type: "mcp";
        };
        Output_LiveOutputAudioDelta: {
            delta: string;
            end_ms?: number;
            start_ms?: number;
            
            type: "session.output_audio.delta";
        };
        Output_LiveOutputTranscriptDelta: {
            client_event_id?: string;
            delta: string;
            end_ms: number;
            event_id: string;
            start_ms: number;
            
            type: "session.output_transcript.delta";
        };
        
        Output_LiveReasoningEffort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
        
        Output_LiveReasoningSummary: "concise" | "detailed" | "auto";
        Output_LiveResponseEvent: {
            client_event_id?: string;
            delegation_id?: string | null;
            event: {
                [key: string]: unknown;
            };
            event_id: string;
            
            type: "response.event";
        };
        Output_LiveResponsesDelegationParam: {
            responses: components["schemas"]["Output_LiveResponsesDelegationSettingsInputParam"];
            
            type: "responses";
        };
        Output_LiveResponsesDelegationSettingsInputParam: {
            instructions?: string | null;
            max_output_tokens?: number | null;
            model: string;
            parallel_tool_calls?: boolean | null;
            reasoning?: components["schemas"]["Output_LiveDelegationReasoningInputParam"] | null;
            service_tier?: components["schemas"]["Output_LiveResponsesServiceTier"] | null;
            text?: components["schemas"]["Output_LiveDelegationTextInputParam"] | null;
            tool_choice?: components["schemas"]["Output_LiveToolChoiceEnum"] | components["schemas"]["Output_LiveFunctionToolChoiceParam"] | components["schemas"]["Output_LiveMCPToolChoiceParam"];
            tools?: (components["schemas"]["Output_LiveFunctionToolInputParam"] | components["schemas"]["Output_LiveWebSearchToolInputParam"])[];
        };
        
        Output_LiveResponsesServiceTier: "auto" | "default" | "fast_tier_temp_pilot" | "flex" | "priority" | "ultrafast";
        Output_LiveServerEvent: components["schemas"]["Output_LiveServerEvent-2"];
        "Output_LiveServerEvent-2": components["schemas"]["Output_LiveSessionStarted"] | components["schemas"]["Output_LiveSessionUpdated"] | components["schemas"]["Output_LiveInputAudioMuted"] | components["schemas"]["Output_LiveInputAudioUnmuted"] | components["schemas"]["Output_LiveInstructionsAppended"] | components["schemas"]["Output_LiveThinkingAppended"] | components["schemas"]["Output_LiveCommentaryAppended"] | components["schemas"]["Output_LiveInputAudioAppend"] | components["schemas"]["Output_LiveOutputAudioDelta"] | components["schemas"]["Output_LiveInputTranscriptDelta"] | components["schemas"]["Output_LiveOutputTranscriptDelta"] | components["schemas"]["Output_LiveDelegationCreated"] | components["schemas"]["Output_LiveResponseEvent"] | components["schemas"]["Output_LiveSessionUsageUpdated"] | components["schemas"]["Output_LiveSessionClosed"] | components["schemas"]["Output_LiveErrorEvent"] | components["schemas"]["Output_LiveInfoEvent"] | components["schemas"]["Output_LiveTransportDTMFReceived"] | components["schemas"]["Output_LiveTransportDTMFSend"] | components["schemas"]["Output_LiveTransportRinging"] | components["schemas"]["Output_LiveTransportAnswered"] | components["schemas"]["Output_LiveTransportFailed"];
        Output_LiveSessionAudioFormatPCMAParam: {
            rate: number;
            
            type: "audio/pcma";
        };
        Output_LiveSessionAudioFormatPCMParam: {
            
            rate: 16000 | 24000;
            
            type: "audio/pcm";
        };
        Output_LiveSessionAudioFormatPCMUParam: {
            rate: number;
            
            type: "audio/pcmu";
        };
        Output_LiveSessionClosed: {
            client_event_id?: string;
            event_id: string;
            reason: "close_requested" | "expired" | "content" | "remote_hangup" | "connection_lost";
            session: components["schemas"]["Output_LiveSessionResourceParam"];
            
            type: "session.closed";
            usage: components["schemas"]["Output_LiveSessionUsage"];
        };
        Output_LiveSessionResourceParam: {
            audio?: components["schemas"]["Output_LiveInitialSessionAudioParam"];
            client?: components["schemas"]["Output_LiveClientConfigParam"];
            delegation?: (components["schemas"]["Output_LiveClientDelegationParam"] | components["schemas"]["Output_LiveResponsesDelegationParam"]) | null;
            expires_at: number;
            id: string;
            input?: components["schemas"]["Output_LiveInitialItem"][];
            instructions?: string | null;
            model: components["schemas"]["Output_ModelIdsLive"];
            
            status: "active";
            store?: boolean;
        };
        Output_LiveSessionStarted: {
            client_event_id?: string;
            event_id: string;
            session: components["schemas"]["Output_LiveSessionResourceParam"];
            
            type: "session.started";
        };
        Output_LiveSessionUpdated: {
            client_event_id?: string;
            event_id: string;
            session: components["schemas"]["Output_LiveSessionResourceParam"];
            
            type: "session.updated";
        };
        Output_LiveSessionUsage: {
            seconds: number;
        };
        Output_LiveSessionUsageUpdated: {
            client_event_id?: string;
            context_window?: components["schemas"]["Output_LiveContextWindowUsage"];
            event_id: string;
            
            type: "session.usage.updated";
            usage: components["schemas"]["Output_LiveSessionUsage"];
        };
        
        Output_LiveTextVerbosity: "low" | "medium" | "high";
        Output_LiveThinkingAppended: {
            client_event_id?: string;
            end_ms: number;
            event_id: string;
            start_ms: number;
            
            type: "session.thinking.appended";
        };
        
        Output_LiveToolChoiceEnum: "auto" | "none" | "required";
        Output_LiveTransportAnswered: {
            event_id: string;
            session_id: string;
            
            type: "transport.answered";
        };
        Output_LiveTransportCallError: {
            code: string;
            message: string;
            param?: string;
            
            type: "call_error";
        };
        Output_LiveTransportDTMFReceived: {
            event: string;
            event_id: string;
            
            type: "transport.dtmf.received";
        };
        Output_LiveTransportDTMFSend: {
            client_event_id?: string;
            event: string;
            event_id: string;
            
            type: "transport.dtmf.send";
        };
        Output_LiveTransportFailed: {
            error: components["schemas"]["Output_LiveTransportCallError"];
            event_id: string;
            session_id: string;
            
            type: "transport.failed";
        };
        Output_LiveTransportRinging: {
            event_id: string;
            session_id: string;
            
            type: "transport.ringing";
        };
        Output_LiveWebRTCTransport: {
            sdp: string;
            
            type: "webrtc";
        };
        Output_LiveWebSearchToolInputParam: {
            
            type: "web_search";
        };
        Output_ModelIdsLive: string | "gpt-live-1";
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;

}
declare module "@lovable.dev/ai-gateway" {
  interface GeneratedModelsBySurface {
    "chat-completions": "google/gemini-2.5-flash" | "google/gemini-2.5-flash-image" | "google/gemini-2.5-flash-lite" | "google/gemini-2.5-pro" | "google/gemini-3-flash-preview" | "google/gemini-3-pro-image" | "google/gemini-3.1-flash-image" | "google/gemini-3.1-flash-lite" | "google/gemini-3.1-pro-preview" | "google/gemini-3.5-flash" | "google/gemini-3.6-flash" | "google/gemini-3.7-flash" | "google/gemini-3.8-flash" | "openai/chat-latest" | "openai/gpt-5" | "openai/gpt-5-mini" | "openai/gpt-5-nano" | "openai/gpt-5.2" | "openai/gpt-5.4" | "openai/gpt-5.4-mini" | "openai/gpt-5.4-nano" | "openai/gpt-5.5" | "openai/gpt-5.6-luna" | "openai/gpt-5.6-sol" | "openai/gpt-5.6-terra" | "openai/gpt-6-astra";
    "responses": "openai/chat-latest" | "openai/gpt-5" | "openai/gpt-5-mini" | "openai/gpt-5-nano" | "openai/gpt-5.2" | "openai/gpt-5.4" | "openai/gpt-5.4-mini" | "openai/gpt-5.4-nano" | "openai/gpt-5.4-pro" | "openai/gpt-5.5" | "openai/gpt-5.5-pro" | "openai/gpt-5.6-luna" | "openai/gpt-5.6-sol" | "openai/gpt-5.6-terra" | "openai/gpt-6-astra";
    "messages": never;
    "interactions": never;
    "image-generation": "google/gemini-2.5-flash-image" | "google/gemini-3-pro-image" | "google/gemini-3.1-flash-image" | "google/gemini-3.1-flash-lite-image" | "openai/gpt-image-1-mini" | "openai/gpt-image-2";
    "image-edit": "openai/gpt-image-1-mini" | "openai/gpt-image-2";
    "embeddings": "google/gemini-embedding-001" | "google/gemini-embedding-2" | "openai/text-embedding-3-large" | "openai/text-embedding-3-small";
    "speech": "google/gemini-2.5-flash-lite-preview-tts" | "google/gemini-2.5-flash-tts" | "google/gemini-2.5-pro-tts" | "google/gemini-3.1-flash-tts-preview" | "openai/gpt-4o-mini-tts";
    "transcription": "google/gemini-3.5-transcribe" | "openai/gpt-4o-mini-transcribe" | "openai/gpt-4o-transcribe";
    "music": never;
    "videos": "google/gemini-omni-1.1-flash" | "google/veo-3.1" | "google/veo-3.1-fast" | "google/veo-3.1-lite";
    "systemone": never;
    "live": "openai/gpt-live-1";
  }
  interface LiveFieldsByModel {
    "openai/gpt-live-1": ModelContract_a738949d5a7e663e.components["schemas"]["LiveRequest"];
  }
  interface LiveResponseByModel {
    "openai/gpt-live-1": ModelContract_a738949d5a7e663e.components["schemas"]["LiveResponse"];
  }
  interface LiveEventByModel {
    "openai/gpt-live-1": ModelContract_a738949d5a7e663e.components["schemas"]["LiveEvent"];
  }
}
