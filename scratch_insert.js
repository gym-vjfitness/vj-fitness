const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://udwffdykphhicnhiyeoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkd2ZmZHlrcGhoaWNuaGl5ZW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Njk1MjIsImV4cCI6MjA4NjQ0NTUyMn0.3K164niwX6KjiNXjbT44BgMnm_U0GLe2oLvMYe70WCc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  // We can query the postgres system catalog using a simple RPC if available,
  // or we can try to insert an empty object to trainer_permissions table
  // and see what columns are created/defaulted.
  // Note: we might get a foreign key violation if trainer_id doesn't exist,
  // but it will tell us the column names or we can use a dummy UUID.
  const dummyId = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await supabase
    .from('trainer_permissions')
    .insert({ trainer_id: dummyId })
    .select();

  console.log('Insert Result:', data);
  console.log('Insert Error:', error);
}

checkSchema();
