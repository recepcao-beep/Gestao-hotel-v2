import http from 'http';

http.get('http://localhost:3000/api/sheets/load?hotel=VILA&forceSheets=true', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const parsed = JSON.parse(data);
    console.log('RAW JSON:', JSON.stringify(parsed).substring(0, 500));
    console.log('DEBUG_colMap:', parsed.data?.DEBUG_colMap);
    console.log('DEBUG_firstRow:', parsed.data?.DEBUG_firstRow);
    console.log('Apartment 200 data:', parsed.data?.apartments?.['200']);
  });
});
