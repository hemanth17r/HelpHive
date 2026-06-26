import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yylquyddiipqkpxjjdkz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHF1eWRkaWlwcWtweGpqZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Njg4ODksImV4cCI6MjA5NTQ0NDg4OX0.POdn0bLx9V_0UxRzikTccNOrrtCViCtVwFDTQnqZdU0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectOffers() {
  const result = await supabase.from('job_offers').select('*');
  console.log("Job offers result:", result);
}

inspectOffers();
