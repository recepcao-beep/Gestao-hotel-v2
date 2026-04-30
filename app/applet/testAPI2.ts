import http from 'http';

http.get('http://localhost:3000/api/sheets/load?hotel=VILA&forceSheets=true', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('DEBUG_colMap:', parsed.data?.DEBUG_colMap);
      console.log('DEBUG_firstRow:', parsed.data?.DEBUG_firstRow);
      console.log('Keys in data:', Object.keys(parsed.data || {}));
      console.log('Apartments keys:', Object.keys(parsed.data?.apartments || {}));
      console.log('Apartment 200 data:', parsed.data?.apartments?.['200'] || parsed.data?.apartments?.['VILA_200']);
    } catch(e) {
      console.log('Error parsing response:', e);
      console.log(data);
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
