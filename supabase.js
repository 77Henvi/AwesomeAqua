const SUPABASE_URL = 'https://vfihczafjrkcyncnosgj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmaWhjemFmanJrY3luY25vc2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjEzODIsImV4cCI6MjA5MTMzNzM4Mn0.x2XF1GzfAUu_o-l6acRQtl6k6DTY-GsG_JHnEOm-eLA';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);