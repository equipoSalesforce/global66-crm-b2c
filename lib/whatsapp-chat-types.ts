export type CrmQuickMessage = {
  id: string;
  title: string;
  content: string;
  channel: string | null;
  category: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type QuickMessageInput = {
  title: string;
  content: string;
  channel?: string | null;
  category?: string | null;
  is_active?: boolean;
};

export type CrmUserChatSettings = {
  id?: string;
  user_id?: string;
  enter_to_send: boolean;
  my_conversation_border_color: string;
  my_conversation_text_color: string;
  my_notes_border_color: string;
  my_notes_text_color: string;
  customer_conversation_border_color: string;
  customer_conversation_text_color: string;
  created_at?: string;
  updated_at?: string;
};

export const defaultChatSettings: CrmUserChatSettings = {
  enter_to_send: false,
  my_conversation_border_color: "#22BA48",
  my_conversation_text_color: "#FFFFFF",
  my_notes_border_color: "#08DEFA",
  my_notes_text_color: "#FFFFFF",
  customer_conversation_border_color: "#D7D7D7",
  customer_conversation_text_color: "#000000",
};
