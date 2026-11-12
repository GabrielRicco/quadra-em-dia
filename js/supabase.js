// Único lugar que cria o cliente do Supabase; as abas importam daqui.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_CHAVE } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_CHAVE);
