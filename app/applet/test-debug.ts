import http from 'http';

http.get('http://localhost:3000/api/supabase/debug', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      console.log('Result:', JSON.stringify(JSON.parse(data), null, 2));
    } catch(e) {
      console.log('Error parsing response:', e);
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
