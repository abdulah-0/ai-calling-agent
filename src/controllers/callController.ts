import { FastifyRequest, FastifyReply } from 'fastify';
import { TelnyxService } from '../services/telnyx';
import { SupabaseService } from '../services/supabase';
import { QueueService } from '../services/queue';

const telnyxService = new TelnyxService();
const supabaseService = new SupabaseService();

export class CallController {
    // Start outbound call
    static async startCall(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { to, from, organization_id } = request.body as any;

            if (!to || !from) {
                return reply.status(400).send({ error: 'Missing required fields: to, from' });
            }

            // Create call record in database
            const call = await supabaseService.createCall({
                organization_id: organization_id || process.env.DEFAULT_ORG_ID || '',
                call_control_id: '', // Will be updated when Telnyx responds
                direction: 'outbound',
                from_number: from,
                to_number: to,
                metadata: request.body
            });

            // Initiate call via Telnyx
            const telnyxCall = await telnyxService.makeCall(to, from);

            // Update call with Telnyx call control ID
            await supabaseService.updateCall(call.id, {
                call_control_id: telnyxCall.call_control_id
            });

            return reply.send({
                success: true,
                call_id: call.id,
                call_control_id: telnyxCall.call_control_id,
                status: 'initiated'
            });
        } catch (error: any) {
            console.error('Error starting call:', error);
            return reply.status(500).send({ error: error.message });
        }
    }

    // Get call details
    static async getCall(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { call_id } = request.params as any;

            const call = await supabaseService.client
                .from('calls')
                .select('*, conversations(*), call_summaries(*)')
                .eq('id', call_id)
                .single();

            if (call.error) {
                return reply.status(404).send({ error: 'Call not found' });
            }

            return reply.send(call.data);
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    }

    // Get call statistics
    static async getStats(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { organization_id } = request.query as any;
            const orgId = organization_id || process.env.DEFAULT_ORG_ID;

            const stats = await supabaseService.getCallStats(orgId);

            return reply.send(stats);
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    }

    // List calls
    static async listCalls(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { organization_id, limit = 50, offset = 0 } = request.query as any;
            const orgId = organization_id || process.env.DEFAULT_ORG_ID;

            const { data, error } = await supabaseService.client
                .from('calls')
                .select('*')
                .eq('organization_id', orgId)
                .order('start_time', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            return reply.send({ calls: data, count: data?.length || 0 });
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    }
}

export class CampaignController {
    // Create campaign
    static async createCampaign(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { name, from_number, contacts, organization_id } = request.body as any;

            if (!name || !from_number || !contacts || contacts.length === 0) {
                return reply.status(400).send({ error: 'Missing required fields' });
            }

            const campaign = await supabaseService.createCampaign({
                organization_id: organization_id || process.env.DEFAULT_ORG_ID || '',
                name,
                from_number,
                settings: request.body
            });

            // Add contacts to campaign
            await supabaseService.addCampaignContacts(campaign.id, contacts);

            // Update total contacts count
            await supabaseService.client
                .from('campaigns')
                .update({ total_contacts: contacts.length })
                .eq('id', campaign.id);

            return reply.send({ success: true, campaign });
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    }

    // Start campaign
    static async startCampaign(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { campaign_id } = request.params as any;

            // Update campaign status
            await supabaseService.client
                .from('campaigns')
                .update({ status: 'active', started_at: new Date().toISOString() })
                .eq('id', campaign_id);

            // Get campaign details
            const { data: campaign } = await supabaseService.client
                .from('campaigns')
                .select('*')
                .eq('id', campaign_id)
                .single();

            if (!campaign) {
                return reply.status(404).send({ error: 'Campaign not found' });
            }

            // Get all pending contacts
            const { data: contacts } = await supabaseService.client
                .from('campaign_contacts')
                .select('*')
                .eq('campaign_id', campaign_id)
                .eq('status', 'pending');

            // Queue calls for all contacts
            const queueService = new QueueService(telnyxService);
            for (const contact of contacts || []) {
                await queueService.addCallJob(
                    contact.phone_number,
                    campaign.from_number,
                    Math.random() * 5000 // Stagger calls
                );
            }

            return reply.send({
                success: true,
                message: `Campaign started with ${contacts?.length || 0} contacts`
            });
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    }

    // Get campaign status
    static async getCampaign(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { campaign_id } = request.params as any;

            const { data, error } = await supabaseService.client
                .from('campaigns')
                .select('*, campaign_contacts(*)')
                .eq('id', campaign_id)
                .single();

            if (error) {
                return reply.status(404).send({ error: 'Campaign not found' });
            }

            return reply.send(data);
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    }
}
