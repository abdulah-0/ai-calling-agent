import telnyx from 'telnyx';
import EventEmitter from 'events';

export class TelnyxService extends EventEmitter {
    private client: any;
    private apiKey: string;

    constructor() {
        super();
        this.apiKey = process.env.TELNYX_API_KEY || '';
        if (!this.apiKey) {
            console.error('TELNYX_API_KEY is missing');
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const telnyxClient = require('telnyx');
        this.client = telnyxClient(this.apiKey);
    }

    public async handleWebhook(event: any) {
        try {
            const { event_type, payload } = event.data;
            const callControlId = payload.call_control_id;

            console.log(`Telnyx Event: ${event_type} | Call ID: ${callControlId}`);

            switch (event_type) {
                case 'call.initiated':
                    await this.answerCall(callControlId);
                    break;

                case 'call.answered':
                    this.emit('call.answered', payload);
                    await this.startMediaStream(callControlId);
                    break;

                case 'call.hangup':
                    this.emit('call.hangup', payload);
                    break;

                default:
                    console.log(`Unhandled event type: ${event_type}`);
            }
        } catch (error) {
            console.error('Error handling Telnyx webhook:', error);
        }
    }

    private async answerCall(callControlId: string) {
        try {
            console.log(`Answering call: ${callControlId}`);
            await this.client.calls.answer({ call_control_id: callControlId });
        } catch (error) {
            console.error('Error answering call:', error);
        }
    }

    private async startMediaStream(callControlId: string) {
        try {
            const domain = process.env.DOMAIN || 'localhost:3000';
            const streamUrl = `wss://${domain}/media/telnyx`;

            console.log(`Starting media stream to: ${streamUrl}`);

            await this.client.calls.fork_media_stream({
                call_control_id: callControlId,
                stream_url: streamUrl,
                stream_track: 'both_tracks', // Stream both inbound and outbound audio
            });
        } catch (error) {
            console.error('Error starting media stream:', error);
        }
    }

    public async hangupCall(callControlId: string) {
        try {
            await this.client.calls.hangup({ call_control_id: callControlId });
        } catch (error) {
            console.error('Error hanging up call:', error);
        }
    }

    public async speak(callControlId: string, text: string, voice: string = 'en-US-Wavenet-A', language: string = 'en-US') {
        try {
            console.log(`Speaking on call ${callControlId}: "${text}" (${voice})`);
            await this.client.calls.speak({
                call_control_id: callControlId,
                payload: text,
                voice: voice,
                language: language
            });
        } catch (error) {
            console.error('Error speaking on call:', error);
        }
    }

    public async makeCall(to: string, from: string, clientState: any = null) {
        try {
            const domain = process.env.DOMAIN || 'localhost:3000';
            const streamUrl = `wss://${domain}/media/telnyx`;

            console.log(`Initiating outbound call to ${to} from ${from}`);

            const callParams: any = {
                connection_id: process.env.TELNYX_CONNECTION_ID,
                to: to,
                from: from,
                stream_url: streamUrl,
                stream_track: 'inbound_track',
            };

            if (clientState) {
                callParams.client_state = Buffer.from(JSON.stringify(clientState)).toString('base64');
            }

            const { data: call } = await this.client.calls.create(callParams);

            console.log(`Outbound call initiated: ${call.call_control_id}`);
            return call;
        } catch (error) {
            console.error('Error making outbound call:', error);
            throw error;
        }
    }
}
