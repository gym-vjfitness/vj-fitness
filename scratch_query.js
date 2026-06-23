const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://udwffdykphhicnhiyeoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkd2ZmZHlrcGhoaWNuaGl5ZW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Njk1MjIsImV4cCI6MjA4NjQ0NTUyMn0.3K164niwX6KjiNXjbT44BgMnm_U0GLe2oLvMYe70WCc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPermissions() {
  const { data, error } = await supabase
    .from('trainer_permissions')
    .select('*');
  
  if (error) {
    console.error('Error fetching permissions:', error);
  } else {
    console.log('Trainer Permissions Table Data:', JSON.stringify(data, null, 2));
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, user_role')
    .eq('user_role', 'trainer');
  
  if (profileError) {
    console.error('Error fetching profiles:', profileError);
  } else {
    console.log('Trainers in profiles table:', JSON.stringify(profiles, null, 2));
  }
}

checkPermissions();
