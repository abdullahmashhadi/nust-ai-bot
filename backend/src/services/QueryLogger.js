const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Query Logger Service
 * Logs user interactions and manages feedback-based learning
 */
class QueryLogger {
  /**
   * Check if query contains temporal keywords (date-specific)
   */
  static isTimelessQuery(query) {
    const temporalKeywords = [
      'when', 'deadline', 'date', 'dates',
      '2024', '2025', '2026', '2027', '2028',
      'current', 'this year', 'next year', 'latest',
      'fee', 'fees', 'cost', 'costs', 'tuition',
      'today', 'now', 'recent', 'upcoming'
    ];
    
    const queryLower = query.toLowerCase();
    const hasTemporal = temporalKeywords.some(keyword => 
      queryLower.includes(keyword)
    );
    
    // Return true if NO temporal keywords found
    return !hasTemporal;
  }

  /**
   * Log a query-response pair
   */
  static async logQuery(conversationId, query, response, metadata = {}) {
    try {
      const isTimeless = this.isTimelessQuery(query);
      
      const { data, error } = await supabase
        .from('query_logs')
        .insert({
          conversation_id: conversationId,
          query: query.trim(),
          response: response.trim(),
          feedback: 'neutral',
          is_timeless: isTimeless,
          metadata: metadata,
        })
        .select()
        .single();

      if (error) {
        console.error('Error logging query:', error);
        return null;
      }

      console.log(`📝 Query logged (ID: ${data.id}, Timeless: ${isTimeless})`);
      return data;
    } catch (error) {
      console.error('Error in logQuery:', error);
      return null;
    }
  }

  /**
   * Update feedback for a query
   */
  static async updateFeedback(queryId, feedback) {
    try {
      const { data, error } = await supabase
        .from('query_logs')
        .update({ feedback })
        .eq('id', queryId)
        .select()
        .single();

      if (error) {
        console.error('Error updating feedback:', error);
        return null;
      }

      console.log(`👍 Feedback updated for query ${queryId}: ${feedback}`);
      return data;
    } catch (error) {
      console.error('Error in updateFeedback:', error);
      return null;
    }
  }

  /**
   * Get timeless queries with positive feedback that haven't been added to KB
   */
  static async getQueriesForKnowledgeBase(limit = 20) {
    try {
      const { data, error } = await supabase
        .from('query_logs')
        .select('*')
        .eq('feedback', 'positive')
        .eq('is_timeless', true)
        .eq('added_to_kb', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching queries for KB:', error);
        return [];
      }

      console.log(`📚 Found ${data.length} queries ready for knowledge base`);
      return data;
    } catch (error) {
      console.error('Error in getQueriesForKnowledgeBase:', error);
      return [];
    }
  }

  /**
   * Mark query as added to knowledge base
   */
  static async markAddedToKB(queryId) {
    try {
      const { error } = await supabase
        .from('query_logs')
        .update({ added_to_kb: true })
        .eq('id', queryId);

      if (error) {
        console.error('Error marking query as added to KB:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAddedToKB:', error);
      return false;
    }
  }

  /**
   * Get feedback statistics
   */
  static async getFeedbackStats() {
    try {
      const { data, error } = await supabase
        .from('query_logs')
        .select('feedback, is_timeless');

      if (error) {
        console.error('Error fetching stats:', error);
        return null;
      }

      const stats = {
        total: data.length,
        positive: data.filter(q => q.feedback === 'positive').length,
        negative: data.filter(q => q.feedback === 'negative').length,
        neutral: data.filter(q => q.feedback === 'neutral').length,
        timeless: data.filter(q => q.is_timeless).length,
        temporal: data.filter(q => !q.is_timeless).length,
      };

      return stats;
    } catch (error) {
      console.error('Error in getFeedbackStats:', error);
      return null;
    }
  }

  /**
   * Clean up expired temporal queries
   */
  static async cleanupExpired() {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_queries');

      if (error) {
        console.error('Error cleaning up expired queries:', error);
        return 0;
      }

      console.log(`🧹 Cleaned up ${data} expired queries`);
      return data;
    } catch (error) {
      console.error('Error in cleanupExpired:', error);
      return 0;
    }
  }
}

module.exports = { QueryLogger };
