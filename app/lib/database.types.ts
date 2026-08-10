export type Database = {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string;
          channel: string;
          session_id: string;
          username: string;
          color: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id: string;
          channel?: string;
          session_id: string;
          username: string;
          color: string;
          content: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
