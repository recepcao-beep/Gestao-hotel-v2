import http from 'http';

http.get('http://localhost:3000/api/sheets/load?hotel=VILA', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Apartments keys:', Object.keys(parsed.data?.apartments || {}).slice(0, 10));
      console.log('Apartment 200 data:', parsed.data?.apartments?.['200'] || parsed.data?.apartments?.['VILLAGE_200']);
    } catch(e) {
      console.log('Error parsing response:', e);
      console.log(data);
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
