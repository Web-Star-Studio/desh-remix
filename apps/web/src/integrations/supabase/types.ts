export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_template: boolean | null
          model: string
          model_override: string | null
          name: string
          skills: string[] | null
          system_prompt: string | null
          temperature: number
          temperature_override: number | null
          template_id: string | null
          tools_enabled: string[] | null
          updated_at: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          model?: string
          model_override?: string | null
          name: string
          skills?: string[] | null
          system_prompt?: string | null
          temperature?: number
          temperature_override?: number | null
          template_id?: string | null
          tools_enabled?: string[] | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          model?: string
          model_override?: string | null
          name?: string
          skills?: string[] | null
          system_prompt?: string | null
          temperature?: number
          temperature_override?: number | null
          template_id?: string | null
          tools_enabled?: string[] | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          messages: Json
          pinned: boolean
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          pinned?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          pinned?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          action_url: string | null
          created_at: string
          dismissed: boolean
          expires_at: string
          icon: string | null
          id: string
          message: string
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          dismissed?: boolean
          expires_at?: string
          icon?: string | null
          id?: string
          message: string
          severity?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          dismissed?: boolean
          expires_at?: string
          icon?: string | null
          id?: string
          message?: string
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_base_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memories: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          importance: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          importance?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          importance?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_memories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_projects: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_skills: {
        Row: {
          category: string
          created_at: string | null
          description: string
          icon: string | null
          id: string
          instructions: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          token_estimate: number | null
          trigger_description: string | null
          updated_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          icon?: string | null
          id?: string
          instructions: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          token_estimate?: number | null
          trigger_description?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          icon?: string | null
          id?: string
          instructions?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          token_estimate?: number | null
          trigger_description?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
          expires_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          data: Json
          expires_at: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
          expires_at?: string
        }
        Relationships: []
      }
      automation_events: {
        Row: {
          created_at: string
          event_data: Json
          event_source: string
          event_type: string
          id: string
          matched_rules: Json | null
          processed: boolean
          processed_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_source: string
          event_type: string
          id?: string
          matched_rules?: Json | null
          processed?: boolean
          processed_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_source?: string
          event_type?: string
          id?: string
          matched_rules?: Json | null
          processed?: boolean
          processed_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          action_result: Json
          created_at: string
          event_id: string | null
          id: string
          rule_id: string
          status: string
          trigger_data: Json
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action_result?: Json
          created_at?: string
          event_id?: string | null
          id?: string
          rule_id: string
          status?: string
          trigger_data?: Json
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action_result?: Json
          created_at?: string
          event_id?: string | null
          id?: string
          rule_id?: string
          status?: string
          trigger_data?: Json
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "automation_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          enabled: boolean
          execution_count: number
          id: string
          last_executed_at: string | null
          name: string
          trigger_config: Json
          trigger_event: string | null
          trigger_type: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          enabled?: boolean
          execution_count?: number
          id?: string
          last_executed_at?: string | null
          name: string
          trigger_config?: Json
          trigger_event?: string | null
          trigger_type: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          enabled?: boolean
          execution_count?: number
          id?: string
          last_executed_at?: string | null
          name?: string
          trigger_config?: Json
          trigger_event?: string | null
          trigger_type?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_preferences: {
        Row: {
          alert_enabled: boolean
          alert_threshold: number
          auto_purchase_enabled: boolean
          auto_purchase_package_id: string | null
          auto_purchase_threshold: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_enabled?: boolean
          alert_threshold?: number
          auto_purchase_enabled?: boolean
          auto_purchase_package_id?: string | null
          auto_purchase_threshold?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_enabled?: boolean
          alert_threshold?: number
          auto_purchase_enabled?: boolean
          auto_purchase_package_id?: string | null
          auto_purchase_threshold?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_preferences_auto_purchase_package_id_fkey"
            columns: ["auto_purchase_package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string
          author_role: string | null
          category: string
          content_md: string
          cover_image: string | null
          created_at: string
          excerpt: string
          faq: Json
          featured: boolean
          id: string
          keywords: string[]
          meta_description: string | null
          meta_title: string | null
          og_image: string | null
          published_at: string | null
          reading_minutes: number
          slug: string
          status: string
          tags: string[]
          title: string
          toc: Json
          updated_at: string
          views_count: number
        }
        Insert: {
          author_name?: string
          author_role?: string | null
          category?: string
          content_md: string
          cover_image?: string | null
          created_at?: string
          excerpt: string
          faq?: Json
          featured?: boolean
          id?: string
          keywords?: string[]
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number
          slug: string
          status?: string
          tags?: string[]
          title: string
          toc?: Json
          updated_at?: string
          views_count?: number
        }
        Update: {
          author_name?: string
          author_role?: string | null
          category?: string
          content_md?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string
          faq?: Json
          featured?: boolean
          id?: string
          keywords?: string[]
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          toc?: Json
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      broadcast_dismissals: {
        Row: {
          broadcast_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_dismissals_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          action_url: string | null
          active: boolean
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          message: string
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          active?: boolean
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          message: string
          title: string
          type?: string
        }
        Update: {
          action_url?: string | null
          active?: boolean
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      calendar_events_cache: {
        Row: {
          attendees: Json | null
          composio_synced_at: string | null
          created_at: string | null
          description: string | null
          end_at: string | null
          event_id: string
          id: string
          location: string | null
          start_at: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          attendees?: Json | null
          composio_synced_at?: string | null
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          event_id: string
          id?: string
          location?: string | null
          start_at?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          attendees?: Json | null
          composio_synced_at?: string | null
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          event_id?: string
          id?: string
          location?: string | null
          start_at?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      composio_action_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          method: string
          path: string
          service: string
          status: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          method: string
          path: string
          service: string
          status?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          method?: string
          path?: string
          service?: string
          status?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      composio_user_emails: {
        Row: {
          created_at: string | null
          email: string
          id: string
          toolkit: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          toolkit?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          toolkit?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      connections: {
        Row: {
          category: string
          created_at: string
          id: string
          integration_id: string
          name: string
          platform: string
          status: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id: string
          integration_id: string
          name: string
          platform: string
          status?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          integration_id?: string
          name?: string
          platform?: string
          status?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_interactions: {
        Row: {
          contact_id: string
          created_at: string
          description: string | null
          id: string
          interaction_date: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          description?: string | null
          id?: string
          interaction_date?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          description?: string | null
          id?: string
          interaction_date?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          addresses: Json
          avatar_url: string | null
          birthday: string | null
          company: string | null
          company_description: string | null
          company_industry: string | null
          company_logo_url: string | null
          company_size: string | null
          contact_type: string
          created_at: string
          custom_fields: Json
          email: string | null
          emails: Json
          favorited: boolean
          google_etag: string | null
          google_resource_name: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          phones: Json
          role: string | null
          social_links: Json
          tags: string[] | null
          updated_at: string
          user_id: string
          website: string | null
          workspace_id: string | null
        }
        Insert: {
          addresses?: Json
          avatar_url?: string | null
          birthday?: string | null
          company?: string | null
          company_description?: string | null
          company_industry?: string | null
          company_logo_url?: string | null
          company_size?: string | null
          contact_type?: string
          created_at?: string
          custom_fields?: Json
          email?: string | null
          emails?: Json
          favorited?: boolean
          google_etag?: string | null
          google_resource_name?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          phones?: Json
          role?: string | null
          social_links?: Json
          tags?: string[] | null
          updated_at?: string
          user_id: string
          website?: string | null
          workspace_id?: string | null
        }
        Update: {
          addresses?: Json
          avatar_url?: string | null
          birthday?: string | null
          company?: string | null
          company_description?: string | null
          company_industry?: string | null
          company_logo_url?: string | null
          company_size?: string | null
          contact_type?: string
          created_at?: string
          custom_fields?: Json
          email?: string | null
          emails?: Json
          favorited?: boolean
          google_etag?: string | null
          google_resource_name?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          phones?: Json
          role?: string | null
          social_links?: Json
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          website?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          credits_granted: number
          id: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          credits_granted?: number
          id?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          credits_granted?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          stripe_coupon_id: string | null
          stripe_promotion_code_id: string | null
          type: string
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          type?: string
          used_count?: number
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          type?: string
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          active: boolean
          credits: number
          id: string
          name: string
          price_brl: number
          stripe_price_id: string | null
          trial_eligible: boolean
          unit_price: number | null
        }
        Insert: {
          active?: boolean
          credits: number
          id?: string
          name: string
          price_brl: number
          stripe_price_id?: string | null
          trial_eligible?: boolean
          unit_price?: number | null
        }
        Update: {
          active?: boolean
          credits?: number
          id?: string
          name?: string
          price_brl?: number
          stripe_price_id?: string | null
          trial_eligible?: boolean
          unit_price?: number | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action: string
          amount: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      data_reset_log: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          module: string
          records_deleted: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          module: string
          records_deleted?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          module?: string
          records_deleted?: number
          user_id?: string
        }
        Relationships: []
      }
      email_automations: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          last_run_at: string | null
          name: string
          target_audience: string
          template_slug: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          target_audience?: string
          template_slug?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          target_audience?: string
          template_slug?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_cleanup_sessions: {
        Row: {
          emails_cleaned: number
          emails_scanned: number
          groups_detail: Json
          groups_found: number
          id: string
          scan_mode: string
          scanned_at: string
          user_id: string
        }
        Insert: {
          emails_cleaned?: number
          emails_scanned?: number
          groups_detail?: Json
          groups_found?: number
          id?: string
          scan_mode?: string
          scanned_at?: string
          user_id: string
        }
        Update: {
          emails_cleaned?: number
          emails_scanned?: number
          groups_detail?: Json
          groups_found?: number
          id?: string
          scan_mode?: string
          scanned_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_rate_limits: {
        Row: {
          email_type: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          email_type: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          email_type?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          status: string
          subject: string
          template_slug: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          status?: string
          subject: string
          template_slug?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          status?: string
          subject?: string
          template_slug?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_snoozes: {
        Row: {
          created_at: string | null
          from_name: string | null
          gmail_id: string
          id: string
          original_labels: string[] | null
          restored: boolean | null
          snooze_until: string
          subject: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          from_name?: string | null
          gmail_id: string
          id?: string
          original_labels?: string[] | null
          restored?: boolean | null
          snooze_until: string
          subject?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          from_name?: string | null
          gmail_id?: string
          id?: string
          original_labels?: string[] | null
          restored?: boolean | null
          snooze_until?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          active: boolean
          body_html: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          subject_template: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body_html?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          subject_template?: string
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body_html?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          subject_template?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      emails_cache: {
        Row: {
          body_preview: string | null
          composio_synced_at: string | null
          created_at: string | null
          from_email: string | null
          from_name: string | null
          gmail_id: string
          has_attachment: boolean | null
          id: string
          is_read: boolean | null
          labels: Json | null
          received_at: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          body_preview?: string | null
          composio_synced_at?: string | null
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_id: string
          has_attachment?: boolean | null
          id?: string
          is_read?: boolean | null
          labels?: Json | null
          received_at?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          body_preview?: string | null
          composio_synced_at?: string | null
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_id?: string
          has_attachment?: boolean | null
          id?: string
          is_read?: boolean | null
          labels?: Json | null
          received_at?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          module: string | null
          resolved: boolean | null
          severity: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          module?: string | null
          resolved?: boolean | null
          severity?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          module?: string | null
          resolved?: boolean | null
          severity?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      file_folders: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_smart: boolean | null
          name: string
          parent_id: string | null
          smart_rules: Json | null
          sort_order: number | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_smart?: boolean | null
          name: string
          parent_id?: string | null
          smart_rules?: Json | null
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_smart?: boolean | null
          name?: string
          parent_id?: string | null
          smart_rules?: Json | null
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "file_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      file_inbox: {
        Row: {
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          imported_file_id: string | null
          metadata: Json | null
          mime_type: string
          r2_temp_key: string | null
          sender: string | null
          size_bytes: number
          source: string
          source_label: string | null
          source_reference: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          imported_file_id?: string | null
          metadata?: Json | null
          mime_type?: string
          r2_temp_key?: string | null
          sender?: string | null
          size_bytes?: number
          source?: string
          source_label?: string | null
          source_reference?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          imported_file_id?: string | null
          metadata?: Json | null
          mime_type?: string
          r2_temp_key?: string | null
          sender?: string | null
          size_bytes?: number
          source?: string
          source_label?: string | null
          source_reference?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_inbox_imported_file_id_fkey"
            columns: ["imported_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_links: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          file_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          file_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          file_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_share_links: {
        Row: {
          created_at: string | null
          download_count: number
          expires_at: string | null
          file_id: string
          id: string
          is_active: boolean
          max_downloads: number | null
          password_hash: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          download_count?: number
          expires_at?: string | null
          file_id: string
          id?: string
          is_active?: boolean
          max_downloads?: number | null
          password_hash?: string | null
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          download_count?: number
          expires_at?: string | null
          file_id?: string
          id?: string
          is_active?: boolean
          max_downloads?: number | null
          password_hash?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_share_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          ai_category: string | null
          ai_processing_status: string | null
          ai_suggested_links: Json | null
          ai_summary: string | null
          ai_tags: string[] | null
          content_hash: string | null
          created_at: string | null
          expires_at: string | null
          extension: string | null
          folder_id: string | null
          id: string
          is_favorite: boolean | null
          is_latest_version: boolean | null
          is_trashed: boolean | null
          metadata: Json | null
          mime_type: string
          name: string
          ocr_status: string | null
          ocr_text: string | null
          original_name: string
          parent_file_id: string | null
          size_bytes: number
          source: string
          source_id: string | null
          storage_path: string
          thumbnail_url: string | null
          trashed_at: string | null
          updated_at: string | null
          user_id: string
          version: number | null
          workspace_id: string | null
        }
        Insert: {
          ai_category?: string | null
          ai_processing_status?: string | null
          ai_suggested_links?: Json | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          content_hash?: string | null
          created_at?: string | null
          expires_at?: string | null
          extension?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          is_latest_version?: boolean | null
          is_trashed?: boolean | null
          metadata?: Json | null
          mime_type: string
          name: string
          ocr_status?: string | null
          ocr_text?: string | null
          original_name: string
          parent_file_id?: string | null
          size_bytes?: number
          source?: string
          source_id?: string | null
          storage_path: string
          thumbnail_url?: string | null
          trashed_at?: string | null
          updated_at?: string | null
          user_id: string
          version?: number | null
          workspace_id?: string | null
        }
        Update: {
          ai_category?: string | null
          ai_processing_status?: string | null
          ai_suggested_links?: Json | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          content_hash?: string | null
          created_at?: string | null
          expires_at?: string | null
          extension?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          is_latest_version?: boolean | null
          is_trashed?: boolean | null
          metadata?: Json | null
          mime_type?: string
          name?: string
          ocr_status?: string | null
          ocr_text?: string | null
          original_name?: string
          parent_file_id?: string | null
          size_bytes?: number
          source?: string
          source_id?: string | null
          storage_path?: string
          thumbnail_url?: string | null
          trashed_at?: string | null
          updated_at?: string | null
          user_id?: string
          version?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "file_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_parent_file_id_fkey"
            columns: ["parent_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_goals: {
        Row: {
          color: string
          created_at: string
          current: number
          id: string
          name: string
          target: number
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          current?: number
          id?: string
          name: string
          target?: number
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          current?: number
          id?: string
          name?: string
          target?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_recurring: {
        Row: {
          active: boolean
          amount: number
          category: string
          created_at: string
          day_of_month: number
          description: string
          id: string
          source: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          category?: string
          created_at?: string
          day_of_month?: number
          description: string
          id?: string
          source?: string
          type?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string
          created_at?: string
          day_of_month?: number
          description?: string
          id?: string
          source?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_recurring_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          account_name: string | null
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          external_id: string | null
          id: string
          source: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          account_name?: string | null
          amount: number
          category?: string
          created_at?: string
          date?: string
          description: string
          external_id?: string | null
          id?: string
          source?: string
          type: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          account_name?: string | null
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          external_id?: string | null
          id?: string
          source?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          available_balance: number | null
          connection_id: string | null
          created_at: string | null
          credit_limit: number | null
          currency: string | null
          current_balance: number | null
          id: string
          institution_name: string | null
          last_synced_at: string | null
          name: string | null
          provider_account_id: string
          raw_data: Json | null
          type: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          available_balance?: number | null
          connection_id?: string | null
          created_at?: string | null
          credit_limit?: number | null
          currency?: string | null
          current_balance?: number | null
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          name?: string | null
          provider_account_id: string
          raw_data?: Json | null
          type?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          available_balance?: number | null
          connection_id?: string | null
          created_at?: string | null
          credit_limit?: number | null
          currency?: string | null
          current_balance?: number | null
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          name?: string | null
          provider_account_id?: string
          raw_data?: Json | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_connections: {
        Row: {
          created_at: string | null
          id: string
          institution_logo_url: string | null
          institution_name: string | null
          last_synced_at: string | null
          provider: string
          provider_connection_id: string
          raw_metadata: Json | null
          status: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          institution_logo_url?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          provider: string
          provider_connection_id: string
          raw_metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          institution_logo_url?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          provider?: string
          provider_connection_id?: string
          raw_metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_insights: {
        Row: {
          connection_id: string | null
          created_at: string
          data: Json
          fetched_at: string
          id: string
          insight_type: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          data?: Json
          fetched_at?: string
          id?: string
          insight_type: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          data?: Json
          fetched_at?: string
          id?: string
          insight_type?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_insights_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_investment_transactions: {
        Row: {
          amount: number
          brokerage_number: string | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          investment_id: string | null
          net_amount: number | null
          provider_transaction_id: string
          quantity: number | null
          raw_data: Json | null
          trade_date: string | null
          type: string
          user_id: string
          value: number | null
        }
        Insert: {
          amount: number
          brokerage_number?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          investment_id?: string | null
          net_amount?: number | null
          provider_transaction_id: string
          quantity?: number | null
          raw_data?: Json | null
          trade_date?: string | null
          type: string
          user_id: string
          value?: number | null
        }
        Update: {
          amount?: number
          brokerage_number?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          investment_id?: string | null
          net_amount?: number | null
          provider_transaction_id?: string
          quantity?: number | null
          raw_data?: Json | null
          trade_date?: string | null
          type?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_investment_transactions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "financial_investments"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_investments: {
        Row: {
          connection_id: string | null
          cost_basis: number | null
          created_at: string | null
          currency: string | null
          current_value: number | null
          id: string
          last_synced_at: string | null
          name: string | null
          provider_investment_id: string | null
          quantity: number | null
          raw_data: Json | null
          ticker: string | null
          type: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          connection_id?: string | null
          cost_basis?: number | null
          created_at?: string | null
          currency?: string | null
          current_value?: number | null
          id?: string
          last_synced_at?: string | null
          name?: string | null
          provider_investment_id?: string | null
          quantity?: number | null
          raw_data?: Json | null
          ticker?: string | null
          type?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          connection_id?: string | null
          cost_basis?: number | null
          created_at?: string | null
          currency?: string | null
          current_value?: number | null
          id?: string
          last_synced_at?: string | null
          name?: string | null
          provider_investment_id?: string | null
          quantity?: number | null
          raw_data?: Json | null
          ticker?: string | null
          type?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_investments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_investments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_loans: {
        Row: {
          cet: number | null
          connection_id: string | null
          contract_amount: number | null
          contract_date: string | null
          contract_number: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          due_installments: number | null
          id: string
          installment_periodicity: string | null
          last_synced_at: string | null
          loan_type: string | null
          outstanding_balance: number | null
          paid_installments: number | null
          product_name: string | null
          provider_loan_id: string
          raw_data: Json | null
          status: string | null
          total_installments: number | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          cet?: number | null
          connection_id?: string | null
          contract_amount?: number | null
          contract_date?: string | null
          contract_number?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          due_installments?: number | null
          id?: string
          installment_periodicity?: string | null
          last_synced_at?: string | null
          loan_type?: string | null
          outstanding_balance?: number | null
          paid_installments?: number | null
          product_name?: string | null
          provider_loan_id: string
          raw_data?: Json | null
          status?: string | null
          total_installments?: number | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          cet?: number | null
          connection_id?: string | null
          contract_amount?: number | null
          contract_date?: string | null
          contract_number?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          due_installments?: number | null
          id?: string
          installment_periodicity?: string | null
          last_synced_at?: string | null
          loan_type?: string | null
          outstanding_balance?: number | null
          paid_installments?: number | null
          product_name?: string | null
          provider_loan_id?: string
          raw_data?: Json | null
          status?: string | null
          total_installments?: number | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_loans_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_loans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payment_intents: {
        Row: {
          created_at: string | null
          end_to_end_id: string | null
          error_code: string | null
          error_detail: string | null
          id: string
          provider_intent_id: string
          raw_data: Json | null
          request_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_to_end_id?: string | null
          error_code?: string | null
          error_detail?: string | null
          id?: string
          provider_intent_id: string
          raw_data?: Json | null
          request_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_to_end_id?: string | null
          error_code?: string | null
          error_detail?: string | null
          id?: string
          provider_intent_id?: string
          raw_data?: Json | null
          request_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_payment_intents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "financial_payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payment_recipients: {
        Row: {
          account_branch: string | null
          account_number: string | null
          account_type: string | null
          created_at: string | null
          id: string
          institution_name: string | null
          is_default: boolean | null
          name: string
          pix_key: string | null
          provider_recipient_id: string
          tax_number: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          account_branch?: string | null
          account_number?: string | null
          account_type?: string | null
          created_at?: string | null
          id?: string
          institution_name?: string | null
          is_default?: boolean | null
          name: string
          pix_key?: string | null
          provider_recipient_id: string
          tax_number?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          account_branch?: string | null
          account_number?: string | null
          account_type?: string | null
          created_at?: string | null
          id?: string
          institution_name?: string | null
          is_default?: boolean | null
          name?: string
          pix_key?: string | null
          provider_recipient_id?: string
          tax_number?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_payment_recipients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payment_requests: {
        Row: {
          amount: number
          callback_urls: Json | null
          created_at: string | null
          description: string | null
          id: string
          payment_type: string
          payment_url: string | null
          pix_auto_fixed_amount: number | null
          pix_auto_interval: string | null
          pix_auto_max_variable: number | null
          pix_auto_min_variable: number | null
          provider_request_id: string
          raw_data: Json | null
          recipient_id: string | null
          schedule_dates: Json | null
          schedule_occurrences: number | null
          schedule_start_date: string | null
          schedule_type: string | null
          status: string
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          callback_urls?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          payment_type?: string
          payment_url?: string | null
          pix_auto_fixed_amount?: number | null
          pix_auto_interval?: string | null
          pix_auto_max_variable?: number | null
          pix_auto_min_variable?: number | null
          provider_request_id: string
          raw_data?: Json | null
          recipient_id?: string | null
          schedule_dates?: Json | null
          schedule_occurrences?: number | null
          schedule_start_date?: string | null
          schedule_type?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          callback_urls?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          payment_type?: string
          payment_url?: string | null
          pix_auto_fixed_amount?: number | null
          pix_auto_interval?: string | null
          pix_auto_max_variable?: number | null
          pix_auto_min_variable?: number | null
          provider_request_id?: string
          raw_data?: Json | null
          recipient_id?: string | null
          schedule_dates?: Json | null
          schedule_occurrences?: number | null
          schedule_start_date?: string | null
          schedule_type?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_payment_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "financial_payment_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payment_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_scheduled_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          end_to_end_id: string | null
          error_code: string | null
          id: string
          provider_scheduled_id: string
          raw_data: Json | null
          request_id: string | null
          scheduled_date: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          end_to_end_id?: string | null
          error_code?: string | null
          id?: string
          provider_scheduled_id: string
          raw_data?: Json | null
          request_id?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          end_to_end_id?: string | null
          error_code?: string | null
          id?: string
          provider_scheduled_id?: string
          raw_data?: Json | null
          request_id?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_scheduled_payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "financial_payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_sync_logs: {
        Row: {
          accounts_synced: number | null
          connection_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          investments_synced: number | null
          provider: string
          status: string
          transactions_synced: number | null
          user_id: string
        }
        Insert: {
          accounts_synced?: number | null
          connection_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          investments_synced?: number | null
          provider: string
          status?: string
          transactions_synced?: number | null
          user_id: string
        }
        Update: {
          accounts_synced?: number | null
          connection_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          investments_synced?: number | null
          provider?: string
          status?: string
          transactions_synced?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "financial_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions_unified: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string | null
          currency: string | null
          date: string
          description: string | null
          id: string
          merchant_name: string | null
          provider_transaction_id: string
          raw_data: Json | null
          status: string | null
          subcategory: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          date: string
          description?: string | null
          id?: string
          merchant_name?: string | null
          provider_transaction_id: string
          raw_data?: Json | null
          status?: string | null
          subcategory?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string
          description?: string | null
          id?: string
          merchant_name?: string | null
          provider_transaction_id?: string
          raw_data?: Json | null
          status?: string | null
          subcategory?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_unified_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_webhook_logs: {
        Row: {
          connection_id: string | null
          created_at: string
          error_message: string | null
          event: string
          id: string
          item_id: string | null
          payload: Json
          processing_time_ms: number | null
          status: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          event: string
          id?: string
          item_id?: string | null
          payload?: Json
          processing_time_ms?: number | null
          status?: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          event?: string
          id?: string
          item_id?: string | null
          payload?: Json
          processing_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      gateway_api_key_logs: {
        Row: {
          created_at: string
          event: string
          id: string
          ip_address: string | null
          key_id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          ip_address?: string | null
          key_id: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          ip_address?: string | null
          key_id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_api_key_logs_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "user_gateway_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_labels_cache: {
        Row: {
          color_bg: string | null
          color_text: string | null
          connection_id: string
          gmail_label_id: string
          id: string
          label_type: string | null
          messages_total: number | null
          messages_unread: number | null
          name: string
          synced_at: string | null
          user_id: string
        }
        Insert: {
          color_bg?: string | null
          color_text?: string | null
          connection_id: string
          gmail_label_id: string
          id?: string
          label_type?: string | null
          messages_total?: number | null
          messages_unread?: number | null
          name: string
          synced_at?: string | null
          user_id: string
        }
        Update: {
          color_bg?: string | null
          color_text?: string | null
          connection_id?: string
          gmail_label_id?: string
          id?: string
          label_type?: string | null
          messages_total?: number | null
          messages_unread?: number | null
          name?: string
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gmail_messages_cache: {
        Row: {
          cc_emails: string[] | null
          connection_id: string | null
          date: string | null
          folder: string | null
          from_email: string | null
          from_name: string | null
          gmail_id: string
          has_attachment: boolean | null
          id: string
          is_starred: boolean | null
          is_unread: boolean | null
          label_ids: string[] | null
          snippet: string | null
          subject: string | null
          synced_at: string | null
          thread_id: string | null
          to_email: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          cc_emails?: string[] | null
          connection_id?: string | null
          date?: string | null
          folder?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_id: string
          has_attachment?: boolean | null
          id?: string
          is_starred?: boolean | null
          is_unread?: boolean | null
          label_ids?: string[] | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string | null
          thread_id?: string | null
          to_email?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          cc_emails?: string[] | null
          connection_id?: string | null
          date?: string | null
          folder?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_id?: string
          has_attachment?: boolean | null
          id?: string
          is_starred?: boolean | null
          is_unread?: boolean | null
          label_ids?: string[] | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string | null
          thread_id?: string | null
          to_email?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gmail_messages_cache_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_sync_state: {
        Row: {
          connection_id: string | null
          folder: string | null
          history_id: number | null
          id: string
          last_synced_at: string | null
          next_page_token: string | null
          sync_completed: boolean | null
          total_synced: number | null
          user_id: string
          watch_expiration: string | null
        }
        Insert: {
          connection_id?: string | null
          folder?: string | null
          history_id?: number | null
          id?: string
          last_synced_at?: string | null
          next_page_token?: string | null
          sync_completed?: boolean | null
          total_synced?: number | null
          user_id: string
          watch_expiration?: string | null
        }
        Update: {
          connection_id?: string | null
          folder?: string | null
          history_id?: number | null
          id?: string
          last_synced_at?: string | null
          next_page_token?: string | null
          sync_completed?: boolean | null
          total_synced?: number | null
          user_id?: string
          watch_expiration?: string | null
        }
        Relationships: []
      }
      note_presence: {
        Row: {
          id: string
          is_editing: boolean
          last_seen_at: string
          note_id: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          id?: string
          is_editing?: boolean
          last_seen_at?: string
          note_id: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          id?: string
          is_editing?: boolean
          last_seen_at?: string
          note_id?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      note_shares: {
        Row: {
          created_at: string
          id: string
          note_id: string
          owner_id: string
          permission: string
          shared_with_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          owner_id: string
          permission?: string
          shared_with_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          owner_id?: string
          permission?: string
          shared_with_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_broadcasts: boolean
          email_credit_alerts: boolean
          email_daily_summary: boolean
          email_event_reminders: boolean
          email_inactivity: boolean
          email_security_alerts: boolean
          email_task_reminders: boolean
          email_weekly_report: boolean
          email_welcome: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_broadcasts?: boolean
          email_credit_alerts?: boolean
          email_daily_summary?: boolean
          email_event_reminders?: boolean
          email_inactivity?: boolean
          email_security_alerts?: boolean
          email_task_reminders?: boolean
          email_weekly_report?: boolean
          email_welcome?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_broadcasts?: boolean
          email_credit_alerts?: boolean
          email_daily_summary?: boolean
          email_event_reminders?: boolean
          email_inactivity?: boolean
          email_security_alerts?: boolean
          email_task_reminders?: boolean
          email_weekly_report?: boolean
          email_welcome?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pandora_interaction_logs: {
        Row: {
          agent_id: string | null
          contact_phone: string
          conversation_id: string | null
          created_at: string
          credits_consumed: number | null
          error: string | null
          id: string
          input_text: string
          message_type: string
          output_text: string | null
          response_time_ms: number | null
          system_prompt_used: string | null
          tools_used: string[] | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          contact_phone: string
          conversation_id?: string | null
          created_at?: string
          credits_consumed?: number | null
          error?: string | null
          id?: string
          input_text: string
          message_type?: string
          output_text?: string | null
          response_time_ms?: number | null
          system_prompt_used?: string | null
          tools_used?: string[] | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          contact_phone?: string
          conversation_id?: string | null
          created_at?: string
          credits_consumed?: number | null
          error?: string | null
          id?: string
          input_text?: string
          message_type?: string
          output_text?: string | null
          response_time_ms?: number | null
          system_prompt_used?: string | null
          tools_used?: string[] | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      pandora_processing_locks: {
        Row: {
          conversation_id: string
          locked_at: string
          message_key_id: string | null
        }
        Insert: {
          conversation_id: string
          locked_at?: string
          message_key_id?: string | null
        }
        Update: {
          conversation_id?: string
          locked_at?: string
          message_key_id?: string | null
        }
        Relationships: []
      }
      pandora_sessions: {
        Row: {
          active_channel: string
          context_snapshot: Json
          created_at: string
          id: string
          last_activity_at: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          active_channel?: string
          context_snapshot?: Json
          created_at?: string
          id?: string
          last_activity_at?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          active_channel?: string
          context_snapshot?: Json
          created_at?: string
          id?: string
          last_activity_at?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pandora_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pandora_tool_calls: {
        Row: {
          channel: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input_params: Json | null
          max_retries: number
          output_result: Json | null
          retry_count: number
          session_id: string | null
          started_at: string | null
          status: string
          tool_category: string
          tool_name: string
          user_id: string
        }
        Insert: {
          channel: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_params?: Json | null
          max_retries?: number
          output_result?: Json | null
          retry_count?: number
          session_id?: string | null
          started_at?: string | null
          status?: string
          tool_category: string
          tool_name: string
          user_id: string
        }
        Update: {
          channel?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_params?: Json | null
          max_retries?: number
          output_result?: Json | null
          retry_count?: number
          session_id?: string | null
          started_at?: string | null
          status?: string
          tool_category?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pandora_tool_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pandora_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pandora_wa_audit_log: {
        Row: {
          action: string
          created_at: string
          credits_used: number | null
          id: string
          message_preview: string | null
          reason: string | null
          sender_phone: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits_used?: number | null
          id?: string
          message_preview?: string | null
          reason?: string | null
          sender_phone: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits_used?: number | null
          id?: string
          message_preview?: string | null
          reason?: string | null
          sender_phone?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_authorization_otps: {
        Row: {
          attempts: number | null
          created_at: string | null
          expires_at: string
          id: string
          otp_hash: string
          phone_number: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          otp_hash: string
          phone_number: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_hash?: string
          phone_number?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      platform_integrations: {
        Row: {
          enabled: boolean
          icon: string
          id: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          icon?: string
          id: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          icon?: string
          id?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profile_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          label: string
          mime_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          label?: string
          mime_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          label?: string
          mime_type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_workspace_id: string | null
          archive_expires_at: string | null
          archived_at: string | null
          archived_reason: string | null
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          created_at: string
          display_name: string | null
          friend_code: string | null
          id: string
          onboarding_completed: boolean
          personal_context: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_workspace_id?: string | null
          archive_expires_at?: string | null
          archived_at?: string | null
          archived_reason?: string | null
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string
          display_name?: string | null
          friend_code?: string | null
          id?: string
          onboarding_completed?: boolean
          personal_context?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_workspace_id?: string | null
          archive_expires_at?: string | null
          archived_at?: string | null
          archived_reason?: string | null
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string
          display_name?: string | null
          friend_code?: string | null
          id?: string
          onboarding_completed?: boolean
          personal_context?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_workspace_id_fkey"
            columns: ["active_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_settings: {
        Row: {
          active_provider: string
          created_at: string | null
          id: string
          pluggy_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_provider?: string
          created_at?: string | null
          id?: string
          pluggy_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_provider?: string
          created_at?: string | null
          id?: string
          pluggy_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          body: string
          created_at: string | null
          id: string
          shortcut: string | null
          sort_order: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          shortcut?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          shortcut?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          answer: string | null
          citations: Json
          created_at: string
          favorited: boolean
          filter: string
          id: string
          images: Json
          key_facts: Json
          project_id: string | null
          query: string
          related_queries: Json
          tldr: string | null
          user_id: string
        }
        Insert: {
          answer?: string | null
          citations?: Json
          created_at?: string
          favorited?: boolean
          filter?: string
          id?: string
          images?: Json
          key_facts?: Json
          project_id?: string | null
          query: string
          related_queries?: Json
          tldr?: string | null
          user_id: string
        }
        Update: {
          answer?: string | null
          citations?: Json
          created_at?: string
          favorited?: boolean
          filter?: string
          id?: string
          images?: Json
          key_facts?: Json
          project_id?: string | null
          query?: string
          related_queries?: Json
          tldr?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "search_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      search_projects: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      serp_monitor_results: {
        Row: {
          created_at: string
          diff_summary: string | null
          id: string
          monitor_id: string
          results_data: Json
        }
        Insert: {
          created_at?: string
          diff_summary?: string | null
          id?: string
          monitor_id: string
          results_data?: Json
        }
        Update: {
          created_at?: string
          diff_summary?: string | null
          id?: string
          monitor_id?: string
          results_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "serp_monitor_results_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "serp_monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      serp_monitors: {
        Row: {
          created_at: string
          enabled: boolean
          engine: string
          frequency: string
          id: string
          last_checked_at: string | null
          last_results_hash: string | null
          name: string
          notify_on_change: boolean
          params: Json
          query: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          engine?: string
          frequency?: string
          id?: string
          last_checked_at?: string | null
          last_results_hash?: string | null
          name: string
          notify_on_change?: boolean
          params?: Json
          query: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          engine?: string
          frequency?: string
          id?: string
          last_checked_at?: string | null
          last_results_hash?: string | null
          name?: string
          notify_on_change?: boolean
          params?: Json
          query?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_themes: {
        Row: {
          accent_hsl: string
          background_hsl: string | null
          created_at: string
          description: string | null
          downloads: number
          foreground_hsl: string | null
          id: string
          is_public: boolean
          likes: number
          mode: string
          name: string
          primary_hsl: string
          tags: string[] | null
          updated_at: string
          user_id: string
          wallpaper_id: string | null
        }
        Insert: {
          accent_hsl: string
          background_hsl?: string | null
          created_at?: string
          description?: string | null
          downloads?: number
          foreground_hsl?: string | null
          id?: string
          is_public?: boolean
          likes?: number
          mode?: string
          name: string
          primary_hsl: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          wallpaper_id?: string | null
        }
        Update: {
          accent_hsl?: string
          background_hsl?: string | null
          created_at?: string
          description?: string | null
          downloads?: number
          foreground_hsl?: string | null
          id?: string
          is_public?: boolean
          likes?: number
          mode?: string
          name?: string
          primary_hsl?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          wallpaper_id?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_followers: number | null
          id: string
          late_account_id: string
          platform: string
          profile_id: string | null
          status: string | null
          user_id: string
          username: string | null
          workspace_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_followers?: number | null
          id?: string
          late_account_id: string
          platform: string
          profile_id?: string | null
          status?: string | null
          user_id: string
          username?: string | null
          workspace_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_followers?: number | null
          id?: string
          late_account_id?: string
          platform?: string
          profile_id?: string | null
          status?: string | null
          user_id?: string
          username?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_ai_insights: {
        Row: {
          action_label: string
          action_type: string
          context_data: string | null
          created_at: string
          id: string
          result_text: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action_label: string
          action_type: string
          context_data?: string | null
          created_at?: string
          id?: string
          result_text: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action_label?: string
          action_type?: string
          context_data?: string | null
          created_at?: string
          id?: string
          result_text?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_ai_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_alerts: {
        Row: {
          acknowledged: boolean
          alert_type: string
          created_at: string
          id: string
          message: string
          metric_value: number | null
          platform: string | null
          severity: string
          threshold_value: number | null
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          alert_type: string
          created_at?: string
          id?: string
          message: string
          metric_value?: number | null
          platform?: string | null
          severity?: string
          threshold_value?: number | null
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          metric_value?: number | null
          platform?: string | null
          severity?: string
          threshold_value?: number | null
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_brand_profiles: {
        Row: {
          brand_voice: string | null
          business_description: string | null
          business_name: string
          competitors: Json | null
          content_pillars: Json | null
          created_at: string
          differentials: string | null
          goals: Json | null
          id: string
          keywords: Json | null
          niche: string | null
          persona_description: string | null
          persona_name: string | null
          posting_frequency: string | null
          preferred_formats: Json | null
          profile_id: string
          restrictions: string | null
          target_audience: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_voice?: string | null
          business_description?: string | null
          business_name?: string
          competitors?: Json | null
          content_pillars?: Json | null
          created_at?: string
          differentials?: string | null
          goals?: Json | null
          id?: string
          keywords?: Json | null
          niche?: string | null
          persona_description?: string | null
          persona_name?: string | null
          posting_frequency?: string | null
          preferred_formats?: Json | null
          profile_id: string
          restrictions?: string | null
          target_audience?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_voice?: string | null
          business_description?: string | null
          business_name?: string
          competitors?: Json | null
          content_pillars?: Json | null
          created_at?: string
          differentials?: string | null
          goals?: Json | null
          id?: string
          keywords?: Json | null
          niche?: string | null
          persona_description?: string | null
          persona_name?: string | null
          posting_frequency?: string | null
          preferred_formats?: Json | null
          profile_id?: string
          restrictions?: string | null
          target_audience?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_brand_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_competitors: {
        Row: {
          created_at: string
          display_name: string | null
          handle: string
          id: string
          notes: string | null
          platform: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          handle: string
          id?: string
          notes?: string | null
          platform: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          handle?: string
          id?: string
          notes?: string | null
          platform?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_competitors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_metric_snapshots: {
        Row: {
          created_at: string
          engagement: number
          followers: number
          id: string
          platform_id: string
          platform_name: string
          posts: number
          snapshot_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engagement?: number
          followers?: number
          id?: string
          platform_id: string
          platform_name: string
          posts?: number
          snapshot_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          engagement?: number
          followers?: number
          id?: string
          platform_id?: string
          platform_name?: string
          posts?: number
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          analytics: Json | null
          content: string
          created_at: string | null
          id: string
          late_post_id: string | null
          media_items: Json | null
          platforms: Json | null
          published_at: string | null
          scheduled_for: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          analytics?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          late_post_id?: string | null
          media_items?: Json | null
          platforms?: Json | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          analytics?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          late_post_id?: string | null
          media_items?: Json | null
          platforms?: Json | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          late_profile_id: string
          name: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          late_profile_id: string
          name: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          late_profile_id?: string
          name?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_subscriptions: {
        Row: {
          activated_at: string | null
          cancelled_at: string | null
          created_at: string | null
          deleted_zernio_at: string | null
          grace_ends_at: string | null
          grace_started_at: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string
          zernio_profile_created_at: string | null
          zernio_profile_id: string | null
        }
        Insert: {
          activated_at?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          deleted_zernio_at?: string | null
          grace_ends_at?: string | null
          grace_started_at?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id: string
          zernio_profile_created_at?: string | null
          zernio_profile_id?: string | null
        }
        Update: {
          activated_at?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          deleted_zernio_at?: string | null
          grace_ends_at?: string | null
          grace_started_at?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
          zernio_profile_created_at?: string | null
          zernio_profile_id?: string | null
        }
        Relationships: []
      }
      social_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          name: string
          platforms: Json
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          name: string
          platforms?: Json
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          name?: string
          platforms?: Json
          user_id?: string
        }
        Relationships: []
      }
      task_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          sort_order: number
          task_id: string
          title: string
          workspace_id: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          task_id: string
          title: string
          workspace_id?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          task_id?: string
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_subtasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          google_task_id: string | null
          google_tasklist_id: string | null
          id: string
          priority: string
          project: string | null
          recurrence: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          google_task_id?: string | null
          google_tasklist_id?: string | null
          id?: string
          priority?: string
          project?: string | null
          recurrence?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          google_task_id?: string | null
          google_tasklist_id?: string | null
          id?: string
          priority?: string
          project?: string | null
          recurrence?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_jobs: {
        Row: {
          batch_id: string
          completed_at: string | null
          conversation_id: string | null
          created_at: string | null
          error: string | null
          id: string
          result: string | null
          retry_count: number
          status: string
          tool_args: Json
          tool_name: string
          user_id: string
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          result?: string | null
          retry_count?: number
          status?: string
          tool_args?: Json
          tool_name: string
          user_id: string
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          result?: string | null
          retry_count?: number
          status?: string
          tool_args?: Json
          tool_name?: string
          user_id?: string
        }
        Relationships: []
      }
      unsubscribe_history: {
        Row: {
          category: string
          created_at: string
          emails_affected: number
          id: string
          method: string
          safety_score: number
          sender_email: string
          sender_name: string
          success: boolean
          trashed: boolean
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          emails_affected?: number
          id?: string
          method?: string
          safety_score?: number
          sender_email: string
          sender_name: string
          success?: boolean
          trashed?: boolean
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          emails_affected?: number
          id?: string
          method?: string
          safety_score?: number
          sender_email?: string
          sender_name?: string
          success?: boolean
          trashed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          action: string
          category: string
          created_at: string
          details: Json | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_data: {
        Row: {
          created_at: string
          data: Json
          data_type: string
          id: string
          updated_at: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          data_type: string
          id?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          data_type?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_data_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_files: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          name: string
          size_bytes?: number
          storage_path: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "user_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gateway_api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_workspace_preferences: {
        Row: {
          all_mode_behavior: string | null
          created_at: string | null
          favorite_workspace_id: string | null
          id: string
          show_all_mode: boolean | null
          updated_at: string | null
          user_id: string
          workspace_order: string[] | null
        }
        Insert: {
          all_mode_behavior?: string | null
          created_at?: string | null
          favorite_workspace_id?: string | null
          id?: string
          show_all_mode?: boolean | null
          updated_at?: string | null
          user_id: string
          workspace_order?: string[] | null
        }
        Update: {
          all_mode_behavior?: string | null
          created_at?: string | null
          favorite_workspace_id?: string | null
          id?: string
          show_all_mode?: boolean | null
          updated_at?: string | null
          user_id?: string
          workspace_order?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_workspace_preferences_favorite_workspace_id_fkey"
            columns: ["favorite_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          category: string
          connection_id: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          object_type: string
          payload: Json
          processed: boolean
          processing_time_ms: number | null
          source: string | null
          trigger_slug: string | null
          user_id: string
        }
        Insert: {
          category: string
          connection_id: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          object_type: string
          payload?: Json
          processed?: boolean
          processing_time_ms?: number | null
          source?: string | null
          trigger_slug?: string | null
          user_id: string
        }
        Update: {
          category?: string
          connection_id?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          object_type?: string
          payload?: Json
          processed?: boolean
          processing_time_ms?: number | null
          source?: string | null
          trigger_slug?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_ai_settings: {
        Row: {
          active_hours_end: number
          active_hours_start: number
          allowed_numbers: string[]
          created_at: string
          enabled: boolean
          greeting_message: string | null
          id: string
          preferred_model: string | null
          updated_at: string
          use_mcp: boolean
          user_id: string
          verified_numbers: string[] | null
          workspace_id: string | null
        }
        Insert: {
          active_hours_end?: number
          active_hours_start?: number
          allowed_numbers?: string[]
          created_at?: string
          enabled?: boolean
          greeting_message?: string | null
          id?: string
          preferred_model?: string | null
          updated_at?: string
          use_mcp?: boolean
          user_id: string
          verified_numbers?: string[] | null
          workspace_id?: string | null
        }
        Update: {
          active_hours_end?: number
          active_hours_start?: number
          allowed_numbers?: string[]
          created_at?: string
          enabled?: boolean
          greeting_message?: string | null
          id?: string
          preferred_model?: string | null
          updated_at?: string
          use_mcp?: boolean
          user_id?: string
          verified_numbers?: string[] | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          created_at: string
          id: string
          meta_access_token: string
          phone_number: string
          phone_number_id: string
          status: string
          updated_at: string
          user_id: string
          waba_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_access_token: string
          phone_number: string
          phone_number_id: string
          status?: string
          updated_at?: string
          user_id: string
          waba_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_access_token?: string
          phone_number?: string
          phone_number_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          waba_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          channel: string
          external_contact_id: string
          id: string
          labels: Json
          last_message_at: string
          profile_picture_url: string | null
          title: string | null
          unread_count: number
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          channel?: string
          external_contact_id: string
          id?: string
          labels?: Json
          last_message_at?: string
          profile_picture_url?: string | null
          title?: string | null
          unread_count?: number
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          channel?: string
          external_contact_id?: string
          id?: string
          labels?: Json
          last_message_at?: string
          profile_picture_url?: string | null
          title?: string | null
          unread_count?: number
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content_raw: Json
          content_text: string | null
          conversation_id: string
          deleted_for_everyone: boolean | null
          direction: string
          id: string
          reactions: Json | null
          sent_at: string
          starred: boolean | null
          status: string
          type: string
        }
        Insert: {
          content_raw?: Json
          content_text?: string | null
          conversation_id: string
          deleted_for_everyone?: boolean | null
          direction: string
          id?: string
          reactions?: Json | null
          sent_at?: string
          starred?: boolean | null
          status?: string
          type?: string
        }
        Update: {
          content_raw?: Json
          content_text?: string | null
          conversation_id?: string
          deleted_for_everyone?: boolean | null
          direction?: string
          id?: string
          reactions?: Json | null
          sent_at?: string
          starred?: boolean | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_presence: {
        Row: {
          contact_jid: string
          id: string
          last_seen_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_jid: string
          id?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_jid?: string
          id?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_proxy_logs: {
        Row: {
          action: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          external_url: string
          id: string
          method: string
          request_body: Json | null
          response_body: Json | null
          response_status: number | null
          response_text: string | null
          route_path: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          external_url: string
          id?: string
          method: string
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
          response_text?: string | null
          route_path: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          external_url?: string
          id?: string
          method?: string
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
          response_text?: string | null
          route_path?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      whatsapp_send_logs: {
        Row: {
          account_id: string
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          latency_ms: number | null
          message_preview: string | null
          message_type: string
          read_at: string | null
          status: string
          template_language: string | null
          template_name: string | null
          to_phone: string
          user_id: string
          webhook_payload: Json | null
          workspace_id: string | null
          zernio_message_id: string | null
        }
        Insert: {
          account_id: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          latency_ms?: number | null
          message_preview?: string | null
          message_type: string
          read_at?: string | null
          status: string
          template_language?: string | null
          template_name?: string | null
          to_phone: string
          user_id: string
          webhook_payload?: Json | null
          workspace_id?: string | null
          zernio_message_id?: string | null
        }
        Update: {
          account_id?: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          latency_ms?: number | null
          message_preview?: string | null
          message_type?: string
          read_at?: string | null
          status?: string
          template_language?: string | null
          template_name?: string | null
          to_phone?: string
          user_id?: string
          webhook_payload?: Json | null
          workspace_id?: string | null
          zernio_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_session_logs: {
        Row: {
          created_at: string
          event: string
          id: string
          meta: Json
          session_id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          meta?: Json
          session_id: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          meta?: Json
          session_id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_sync_jobs: {
        Row: {
          chats_done: number | null
          chats_total: number | null
          completed_at: string | null
          created_at: string | null
          current_chat: string | null
          error_message: string | null
          id: string
          messages_synced: number | null
          pending_chats: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          chats_done?: number | null
          chats_total?: number | null
          completed_at?: string | null
          created_at?: string | null
          current_chat?: string | null
          error_message?: string | null
          id?: string
          messages_synced?: number | null
          pending_chats?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          chats_done?: number | null
          chats_total?: number | null
          completed_at?: string | null
          created_at?: string | null
          current_chat?: string | null
          error_message?: string | null
          id?: string
          messages_synced?: number | null
          pending_chats?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_web_session_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          new_status: string
          old_status: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          new_status: string
          old_status?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          new_status?: string
          old_status?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_web_sessions: {
        Row: {
          auto_reconnect: boolean
          created_at: string
          gateway_url: string | null
          id: string
          last_connected_at: string | null
          last_error: string | null
          last_qr_code: string | null
          max_reconnect_attempts: number
          next_reconnect_at: string | null
          reconnect_attempt_count: number
          reconnect_interval_minutes: number
          session_id: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          auto_reconnect?: boolean
          created_at?: string
          gateway_url?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          last_qr_code?: string | null
          max_reconnect_attempts?: number
          next_reconnect_at?: string | null
          reconnect_attempt_count?: number
          reconnect_interval_minutes?: number
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          auto_reconnect?: boolean
          created_at?: string
          gateway_url?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          last_qr_code?: string | null
          max_reconnect_attempts?: number
          next_reconnect_at?: string | null
          reconnect_attempt_count?: number
          reconnect_interval_minutes?: number
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_web_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_shares: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          permission: string
          shared_with: string
          status: string
          updated_at: string
          widget_type: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          permission?: string
          shared_with: string
          status?: string
          updated_at?: string
          widget_type: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          permission?: string
          shared_with?: string
          status?: string
          updated_at?: string
          widget_type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_shares_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_documents: {
        Row: {
          content: string
          created_at: string | null
          doc_type: string
          id: string
          is_active: boolean | null
          title: string
          token_estimate: number | null
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          doc_type: string
          id?: string
          is_active?: boolean | null
          title: string
          token_estimate?: number | null
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          doc_type?: string
          id?: string
          is_active?: boolean | null
          title?: string
          token_estimate?: number | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_shares: {
        Row: {
          created_at: string
          id: string
          modules: string[]
          owner_id: string
          permission: string
          share_all: boolean
          shared_with: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modules?: string[]
          owner_id: string
          permission?: string
          share_all?: boolean
          shared_with: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modules?: string[]
          owner_id?: string
          permission?: string
          share_all?: boolean
          shared_with?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_shares_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          color: string
          context_summary: string | null
          created_at: string
          default_agent_id: string | null
          default_model: string | null
          description: string | null
          icon: string
          id: string
          industry: string | null
          is_default: boolean
          is_personal: boolean | null
          metadata: Json | null
          name: string
          onboarding_completed: boolean | null
          sort_order: number
          system_prompt_override: string | null
          user_id: string
        }
        Insert: {
          color?: string
          context_summary?: string | null
          created_at?: string
          default_agent_id?: string | null
          default_model?: string | null
          description?: string | null
          icon?: string
          id?: string
          industry?: string | null
          is_default?: boolean
          is_personal?: boolean | null
          metadata?: Json | null
          name?: string
          onboarding_completed?: boolean | null
          sort_order?: number
          system_prompt_override?: string | null
          user_id: string
        }
        Update: {
          color?: string
          context_summary?: string | null
          created_at?: string
          default_agent_id?: string | null
          default_model?: string | null
          description?: string | null
          icon?: string
          id?: string
          industry?: string | null
          is_default?: boolean
          is_personal?: boolean | null
          metadata?: Json | null
          name?: string
          onboarding_completed?: boolean | null
          sort_order?: number
          system_prompt_override?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_default_agent_id_fkey"
            columns: ["default_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      coupons_public: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          max_uses: number | null
          type: string | null
          used_count: number | null
          value: number | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          max_uses?: number | null
          type?: string | null
          used_count?: number | null
          value?: number | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          max_uses?: number | null
          type?: string | null
          used_count?: number | null
          value?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_friend_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      accept_widget_share: { Args: { _share_id: string }; Returns: undefined }
      accept_workspace_share: {
        Args: { _share_id: string }
        Returns: undefined
      }
      add_credits:
        | {
            Args: {
              _action: string
              _amount: number
              _description?: string
              _user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _action: string
              _amount: number
              _description?: string
              _user_id: string
            }
            Returns: undefined
          }
      admin_archive_user: {
        Args: { _reason?: string; _target_user_id: string }
        Returns: undefined
      }
      admin_ban_user: {
        Args: { _reason?: string; _target_user_id: string }
        Returns: undefined
      }
      admin_bulk_set_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _user_ids: string[]
        }
        Returns: undefined
      }
      admin_bulk_suspend: {
        Args: { _reason?: string; _user_ids: string[] }
        Returns: undefined
      }
      admin_get_billing_stats: { Args: never; Returns: Json }
      admin_get_email_stats: { Args: never; Returns: Json }
      admin_get_pending_deletions: { Args: never; Returns: Json }
      admin_get_user_details: {
        Args: { _target_user_id: string }
        Returns: Json
      }
      admin_get_user_sessions: {
        Args: { _target_user_id: string }
        Returns: Json
      }
      admin_get_user_stats: { Args: never; Returns: Json }
      admin_grant_credits: {
        Args: { _amount: number; _reason?: string; _target_user_id: string }
        Returns: undefined
      }
      admin_list_users: { Args: never; Returns: Json }
      admin_set_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      admin_suspend_user: {
        Args: { _reason?: string; _target_user_id: string }
        Returns: undefined
      }
      admin_unarchive_user: {
        Args: { _target_user_id: string }
        Returns: undefined
      }
      admin_unban_user: {
        Args: { _target_user_id: string }
        Returns: undefined
      }
      admin_unsuspend_user: {
        Args: { _target_user_id: string }
        Returns: undefined
      }
      cancel_friend_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      cleanup_pandora_locks: { Args: never; Returns: undefined }
      cleanup_stale_note_presence: { Args: never; Returns: undefined }
      cleanup_whatsapp_proxy_logs: { Args: never; Returns: undefined }
      consume_credits: {
        Args: {
          _action: string
          _amount: number
          _description?: string
          _user_id: string
        }
        Returns: Json
      }
      create_workspace_share: {
        Args: {
          _modules: string[]
          _permission: string
          _share_all: boolean
          _shared_with: string
          _workspace_id: string
        }
        Returns: string
      }
      delete_widget_share: { Args: { _share_id: string }; Returns: undefined }
      delete_workspace_share: {
        Args: { _share_id: string }
        Returns: undefined
      }
      ensure_default_workspace: { Args: { _user_id: string }; Returns: string }
      expire_inactive_whatsapp_sessions: {
        Args: { p_threshold_minutes?: number }
        Returns: number
      }
      find_user_by_email: { Args: { _email: string }; Returns: Json }
      find_user_by_friend_code: { Args: { _code: string }; Returns: Json }
      generate_gateway_api_key: { Args: { _label: string }; Returns: string }
      get_file_storage_stats: { Args: { _user_id: string }; Returns: Json }
      get_last_messages: {
        Args: { _conv_ids: string[] }
        Returns: {
          content_raw: Json
          content_text: string
          conversation_id: string
          direction: string
          sent_at: string
          type: string
        }[]
      }
      get_or_create_pandora_session: {
        Args: { p_channel?: string; p_user_id: string; p_workspace_id?: string }
        Returns: {
          active_channel: string
          context_snapshot: Json
          created_at: string
          id: string
          last_activity_at: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pandora_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_profiles_with_email: { Args: { _user_ids: string[] }; Returns: Json }
      get_shared_widget_data: {
        Args: { _share_id: string; _widget_type: string }
        Returns: Json
      }
      get_shared_workspace_data: { Args: { _share_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_view: { Args: { _slug: string }; Returns: undefined }
      move_financial_connection: {
        Args: { _connection_id: string; _target_workspace_id: string }
        Returns: undefined
      }
      redeem_coupon: { Args: { _code: string }; Returns: Json }
      register_tool_call: {
        Args: {
          p_channel: string
          p_input_params?: Json
          p_session_id: string
          p_tool_category: string
          p_tool_name: string
          p_user_id: string
        }
        Returns: {
          channel: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input_params: Json | null
          max_retries: number
          output_result: Json | null
          retry_count: number
          session_id: string | null
          started_at: string | null
          status: string
          tool_category: string
          tool_name: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "pandora_tool_calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_friend_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      reject_widget_share: { Args: { _share_id: string }; Returns: undefined }
      reject_workspace_share: {
        Args: { _share_id: string }
        Returns: undefined
      }
      remove_friend: { Args: { _friend_user_id: string }; Returns: undefined }
      revoke_gateway_api_key: { Args: { _key_id: string }; Returns: undefined }
      revoke_widget_share: { Args: { _share_id: string }; Returns: undefined }
      revoke_workspace_share: {
        Args: { _share_id: string }
        Returns: undefined
      }
      run_db_maintenance: { Args: never; Returns: Json }
      send_friend_request: { Args: { _to_user_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_widget_share_permission: {
        Args: { _permission: string; _share_id: string }
        Returns: undefined
      }
      update_workspace_share_modules: {
        Args: { _modules: string[]; _share_all: boolean; _share_id: string }
        Returns: undefined
      }
      update_workspace_share_permission: {
        Args: { _permission: string; _share_id: string }
        Returns: undefined
      }
      validate_coupon: {
        Args: { _code: string }
        Returns: {
          code: string
          id: string
          reason: string
          type: string
          valid: boolean
          value: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      subscription_plan: "trial" | "pro" | "credits"
      subscription_status: "active" | "past_due" | "canceled" | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      subscription_plan: ["trial", "pro", "credits"],
      subscription_status: ["active", "past_due", "canceled", "expired"],
    },
  },
} as const
