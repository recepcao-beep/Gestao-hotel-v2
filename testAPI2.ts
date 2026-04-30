import http from 'http';

http.get('http://localhost:3000/api/sheets/load?hotel=VILAGE&forceSheets=true', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('DEBUG_colMap:', parsed.data?.DEBUG_colMap);
      console.log('DEBUG_firstRow:', parsed.data?.DEBUG_firstRow);
      console.log('Apartment 200 data:', parsed.data?.apartments?.['200'] || parsed.data?.apartments?.['VILAGE_200']);
    } catch(e) {
      console.log('Error parsing response:', e);
      console.log(data);
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
