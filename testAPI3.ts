import http from 'http';

http.get('http://localhost:3000/api/sheets/load?hotel=VILLAGE&forceSheets=true', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const parsed = JSON.parse(data);
    console.log('LOGS:', parsed.data?._logs?.join('\n'));
    console.log('Apartments keys:', Object.keys(parsed.data?.apartments || {}));
    console.log('Apartment 200 data:', parsed.data?.apartments?.['200'] || parsed.data?.apartments?.['VILAGE_200']);
  });
});
