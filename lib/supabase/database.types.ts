
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "addresses": {
                  Row: {
                    "cep": string,"city": string,"complement": string | null,"created_at": string,"district": string,"id": string,"is_default": boolean,"label": string | null,"number": string,"state": string,"street": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cep": string,"city": string,"complement"?: string | null,"created_at"?: string,"district": string,"id"?: string,"is_default"?: boolean,"label"?: string | null,"number": string,"state": string,"street": string,"user_id": string
                  }
                  Update: {
                    "cep"?: string,"city"?: string,"complement"?: string | null,"created_at"?: string,"district"?: string,"id"?: string,"is_default"?: boolean,"label"?: string | null,"number"?: string,"state"?: string,"street"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admins": {
                  Row: {
                    "user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "granted": boolean,"granted_at": string,"id": string,"revoked_at": string | null,"type": string,"user_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted": boolean,"granted_at"?: string,"id"?: string,"revoked_at"?: string | null,"type": string,"user_id": string,"version": string
                  }
                  Update: {
                    "granted"?: boolean,"granted_at"?: string,"id"?: string,"revoked_at"?: string | null,"type"?: string,"user_id"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"newsletter_subscriptions": {
                  Row: {
                    "consent_version": string,"consented_at": string,"email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_version": string,"consented_at"?: string,"email": string
                  }
                  Update: {
                    "consent_version"?: string,"consented_at"?: string,"email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"products": {
                  Row: {
                    "art": Json | null,"bead_count": number | null,"categories": (string)[],"category_label": string,"colors": (string)[],"created_at": string,"description": string,"featured_rank": number | null,"id": string,"illustrative": boolean,"images": NonNullable<Json>,"is_new": boolean,"name": string,"options": NonNullable<Json>,"price_cents": number | null,"published": boolean,"rarity": string | null,"search": unknown,"size_cm": number | null,"slug": string,"stock": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "art"?: Json | null,"bead_count"?: number | null,"categories"?: (string)[],"category_label": string,"colors"?: (string)[],"created_at"?: string,"description"?: string,"featured_rank"?: number | null,"id"?: string,"illustrative"?: boolean,"images"?: NonNullable<Json>,"is_new"?: boolean,"name": string,"options"?: NonNullable<Json>,"price_cents"?: number | null,"published"?: boolean,"rarity"?: string | null,"search"?: never,"size_cm"?: number | null,"slug": string,"stock"?: number,"updated_at"?: string
                  }
                  Update: {
                    "art"?: Json | null,"bead_count"?: number | null,"categories"?: (string)[],"category_label"?: string,"colors"?: (string)[],"created_at"?: string,"description"?: string,"featured_rank"?: number | null,"id"?: string,"illustrative"?: boolean,"images"?: NonNullable<Json>,"is_new"?: boolean,"name"?: string,"options"?: NonNullable<Json>,"price_cents"?: number | null,"published"?: boolean,"rarity"?: string | null,"search"?: never,"size_cm"?: number | null,"slug"?: string,"stock"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"cpf": string | null,"id": string,"name": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"cpf"?: string | null,"id": string,"name"?: string,"phone"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"cpf"?: string | null,"id"?: string,"name"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"saved_carts": {
                  Row: {
                    "data": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data": NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stock_alerts": {
                  Row: {
                    "consented_at": string,"email": string,"id": string,"notified_at": string | null,"product_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "consented_at": string,"email": string,"id"?: string,"notified_at"?: string | null,"product_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "consented_at"?: string,"email"?: string,"id"?: string,"notified_at"?: string | null,"product_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_alerts_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "escape_like":
{ Args: { "": string }; Returns: string
                           },
"immutable_unaccent":
{ Args: { "": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"request_stock_alert":
{ Args: { "p_consented_at": string,"p_email": string,"p_product_id": string }; Returns: undefined
                           },
"search_products":
{ Args: { "p_categoria": string,"p_cores": (string)[],"p_disponivel": boolean,"p_ordem": string,"p_page_size": number,"p_pagina": number,"p_q": string }; Returns: {
              "item": Json,"total": number
            }[]
                           },
"subscribe_newsletter":
{ Args: { "p_consent_version": string,"p_email": string }; Returns: string
                           },
"toggle_favorite":
{ Args: { "p_product_id": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
