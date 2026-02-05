import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseService {
    public client: SupabaseClient;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
            console.error('Supabase credentials missing');
        }

        this.client = createClient(supabaseUrl, supabaseKey);
    }

    // Call Management
    async createCall(data: {
        organization_id: string;
        call_control_id: string;
        direction: 'inbound' | 'outbound';
        from_number: string;
        to_number: string;
        metadata?: any;
    }) {
        const { data: call, error } = await this.client
            .from('calls')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return call;
    }

    async updateCall(callId: string, updates: any) {
        const { data, error } = await this.client
            .from('calls')
            .update(updates)
            .eq('id', callId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async getCallByControlId(callControlId: string) {
        const { data, error } = await this.client
            .from('calls')
            .select('*')
            .eq('call_control_id', callControlId)
            .single();

        if (error) return null;
        return data;
    }

    // Conversation Management
    async addMessage(callId: string, role: 'user' | 'assistant', content: string, metadata?: any) {
        const { data, error } = await this.client
            .from('conversations')
            .insert([{ call_id: callId, role, content, metadata }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async getConversationHistory(callId: string) {
        const { data, error } = await this.client
            .from('conversations')
            .select('*')
            .eq('call_id', callId)
            .order('timestamp', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    // Save transcript (for real-time conversation)
    async saveTranscript(callId: string, speaker: 'human' | 'ai', text: string, confidence: number = 1.0) {
        const { data, error } = await this.client
            .from('call_transcripts')
            .insert([{
                call_id: callId,
                speaker,
                text,
                confidence
            }])
            .select()
            .single();

        if (error) {
            console.error('Error saving transcript:', error);
            return null;
        }
        return data;
    }

    // Call Summary
    async createCallSummary(data: {
        call_id: string;
        transcript: string;
        summary: string;
        sentiment?: string;
        lead_score?: number;
        action_items?: any[];
        extracted_data?: any;
    }) {
        const { data: summary, error } = await this.client
            .from('call_summaries')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return summary;
    }

    // Campaign Management
    async createCampaign(data: {
        organization_id: string;
        name: string;
        from_number: string;
        settings?: any;
    }) {
        const { data: campaign, error } = await this.client
            .from('campaigns')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return campaign;
    }

    async addCampaignContacts(campaignId: string, contacts: any[]) {
        const contactsWithCampaign = contacts.map(c => ({
            ...c,
            campaign_id: campaignId
        }));

        const { data, error } = await this.client
            .from('campaign_contacts')
            .insert(contactsWithCampaign)
            .select();

        if (error) throw error;
        return data;
    }

    async getNextCampaignContact(campaignId: string) {
        const { data, error } = await this.client
            .from('campaign_contacts')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (error) return null;
        return data;
    }

    async updateCampaignContact(contactId: string, updates: any) {
        const { data, error } = await this.client
            .from('campaign_contacts')
            .update(updates)
            .eq('id', contactId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Call Events (for real-time tracking)
    async logCallEvent(callId: string, eventType: string, eventData?: any) {
        const { data, error } = await this.client
            .from('call_events')
            .insert([{ call_id: callId, event_type: eventType, event_data: eventData }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Analytics
    async getCallStats(organizationId: string, startDate?: Date, endDate?: Date) {
        let query = this.client
            .from('calls')
            .select('*')
            .eq('organization_id', organizationId);

        if (startDate) {
            query = query.gte('start_time', startDate.toISOString());
        }
        if (endDate) {
            query = query.lte('start_time', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;

        const stats = {
            total_calls: data?.length || 0,
            completed_calls: data?.filter(c => c.status === 'completed').length || 0,
            failed_calls: data?.filter(c => c.status === 'failed').length || 0,
            total_duration: data?.reduce((sum, c) => sum + (c.duration || 0), 0) || 0,
            total_cost: data?.reduce((sum, c) => sum + (parseFloat(c.cost) || 0), 0) || 0,
            avg_duration: 0
        };

        stats.avg_duration = stats.completed_calls > 0
            ? Math.round(stats.total_duration / stats.completed_calls)
            : 0;

        return stats;
    }

    // Real-time subscriptions
    subscribeToCallEvents(callId: string, callback: (payload: any) => void) {
        return this.client
            .channel(`call-events-${callId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'call_events',
                filter: `call_id=eq.${callId}`
            }, callback)
            .subscribe();
    }

    subscribeToActiveCalls(organizationId: string, callback: (payload: any) => void) {
        return this.client
            .channel(`active-calls-${organizationId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'calls',
                filter: `organization_id=eq.${organizationId}`
            }, callback)
            .subscribe();
    }
}
