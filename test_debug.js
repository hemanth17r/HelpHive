import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yylquyddiipqkpxjjdkz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const userId = '023288da-7cab-4bc7-99ef-affe319e3513';

async function debugOffers() {
  const { data: offers, error } = await supabase
    .from('job_offers')
    .select('id, job_id, tasker_id, status')
    .eq('tasker_id', userId);
    
  console.log("All offers for user:", offers);
  if (error) console.error("Error fetching offers:", error);
}

debugOffers();
